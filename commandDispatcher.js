/* jshint -W083 */

//const Permission = require('./permission');

/**
 * @class
 */
class Command {
	/** @param {string} name Nom de la commande */
	constructor(name) {
		/**
		 * @type {string}
		 * @private
		 */
		this.__name__ = name;
		/**
		 * @type {Map.<string, Literal>}
		 * @private
		 */
		this.__literals__ = new Map();
		/**
		 * @type {?Argument}
		 * @private
		 */
		this.__argument__ = null;
		/**
		 * @type {boolean}
		 * @private
		 */
		this.__executable__ = false;
		/**
		 * @type {string}
		 * @private
		 */
		this.__description__ = '(aucune description disponible)';
		/**
		 * @type {string}
		 * @private
		 */
		this.__permission__ = 'basic';
	}

	/**
	 * @param {Command} command
	 * @returns {this}
	 */
	then(command) {
		if(command instanceof Literal) {
			this.__literals__.set(command.__name__, command);
		} else if(command instanceof Argument) {
			this.__argument__ = command;
		}

		return this;
	}

	/**
	 * What appens when you execute the command
	 * @param {function(any, ...string): Promise<void>} command La commande à exécuter
	 * @returns {this}
	 */
	executes(command) {
		/**
		 * @param {...string} args
		 */
		this.execute = (source, ...args) => {
			//console.log('execution of ' + command + ' with arguments [' + args + '] and permission ' + Permission[this.__permission__]);
			return new Promise((resolve, reject) => {
				if(Permission[this.__permission__].checkPermission(source)) {
					command(source, ...args)
						.then(resolve)
						.catch(reject);
				} else {
					reject(new Command.InsufficientPermissionError(command.name));
				}
			});
		};
		this.__executable__ = true;

		return this;
	}

	/**
	 * Définit la permission nécessaire pour exécuter cette commande
	 * @param {string} perm
	 * @returns {this}
	 */
	permission(perm) {
		//console.log('command ' + this.name + ' changing permission to "' + perm + '"');
		this.__permission__ = perm;

		return this;
	}

	/**
	 * Ajoute une description à la commande
	 * @param {string} text La description
	 * @returns {this}
	 */
	description(text) {
		this.__description__ = text;

		return this;
	}

	/**
	 * Name of the command
	 * @returns {string}
	 */
	getName() {
		return this.__name__;
	}

	/**
	 * @returns {Map.<string, Command>}
	 */
	getLiterals() {
		return this.__literals__;
	}

	/**
	 * @param {string} name 
	 * @returns {boolean}
	 *
	 */
	hasLiteral(name) {
		return this.__literals__.has(name);
	}

	/**
	 * 
	 * @param {tring} name 
	 * @returns {Literal}
	 */
	getLiteral(name) {
		return this.__literals__.get(name);
	}

	/**
	 * @returns {boolean}
	 */
	hasArgument() {
		return this.__argument__ !== null;
	}

	/**
	 * @returns {?Argument}
	 */
	getArgument() {
		return this.__argument__;
	}

	/**
	 * @returns {boolean}
	 */
	isExecutable() {
		return this.__executable__;
	}

	/**
	 * @returns {string}
	 */
	getDescription() {
		return this.__description__;
	}

	/**
	 * @returns {string}
	 */
	getPermission() {
		return this.__permission__;
	}

	/**
	 * @param {string} prefix 
	 * @returns {{command: Command, usage: string, description: string}[]]}
	 */
	getUsages(prefix) {
		let exploration = [{
			command: this,
			usage: this.__name__
		}];
		let result = [];

		while(exploration.length > 0) {
			let { command, usage } = exploration.shift();

			if(command.__executable__) {
				result.push({
					command,
					usage: `${prefix}${usage}`,
					description: command.__description__
				});
			}

			for(let [lname, lit] of command.__literals__) {
				exploration.push({
					command: lit,
					usage: `${usage} ${lname}`
				});
			}
			if(command.__argument__) {
				exploration.push({
					command: command.__argument__,
					usage: `${usage} <${command.__argument__.__name__}>`
				});
			}
		}

		return result.sort((u1, u2) => u1.usage < u2.usage ? -1 : (u1.usage > u2.usage ? 1 : 0));
	}
}

Command.InsufficientPermissionError = class InsufficientPermissionError extends Error {
	constructor(name) {
		super(`Insufficient permission for command ${name}`);
	}
};

/** @class */
class Literal extends Command {
	/** @param {string} name Nom de la commande */
	constructor(name) {
		super(name);
	}
}

/** @class */
class Argument extends Command {
	/**
	 * @param {string} name Nom de l'argument
	 * @param {boolean} [restString=false] Le reste de la commande est-il concatené ?
	 */
	constructor(name, restString = false) {
		super(name);
		/** @type {boolean} */
		this.__restString__ = restString;
	}

	/** @returns {boolean} */
	isRestString() {
		return this.__restString__;
	}
}

class CommandDispatcher {
	constructor() {
		/**
		 * @type {Map.<string, Literal>}
		 * @private
		 */
		this.__commands__ = new Map();
	}

	/** @returns {Map<string, Literal>} */
	/*getCommands() {
		let cmds = new Map();

		for(let [name, command] of this.__commands__)
			cmds.set(name, command);
		
		return cmds;
	}*/

	get commands() {
		return this.__commands__;
	}

	/**
	 * Enregistre une nouvelle commande
	 * @param {Literal} command Commande à ajouter
	 * @throws {Error} si la commande est déjà enregistrée
	 */
	register(command) { // Rajouter la permission
		if(command instanceof Argument)
			throw new Error('Can\'t register an argument as a command');
		
		if(this.__commands__.has(command.getName()))
			throw new CommandDispatcher.CommandAlreadyRegisteredError(command.getName());
		this.__commands__.set(command.getName(), command);
	}

	/**
	 * Analyse une commande et l'exécute si elle est bien formée
	 * @param {any} source L'environnement dont à besoin la commande
	 * @param {string} cmd La chaîne de caractères à parser
	 * @returns {Promise<void>}
	 */
	parse(source, cmd) {
		if(typeof cmd !== 'string')
			return Promise.reject(new TypeError(`Expected string, got ${typeof cmd}`));
		
		cmd = cmd.trim();
		/** @type {string[]} */
		let args = [];
		let str = '';
		let escaped = false;
		let string = false;
		for(let ch of cmd) {
			if(string) {
				if(escaped) {
					str += ch;
					escaped = false;
				} else if(ch == '\\') {
					escaped = true;
				} else if(ch == '"') {
					string = false;
				} else {
					str += ch;
				}
			} else if(ch == '"') {
				string = true;
			} else if(ch == ' ') {
				args.push(str);
				str = '';
			} else {
				str += ch;
			}
		}
		args.push(str);

		return this.__dispatch__(source, args);
	}

	/**
	 * Exécute une commande
	 * @param {string[]} args
	 * @returns {Promise<void>}
	 * @private
	 */
	__dispatch__(source, args) {
		if(args.length > 0) {
			/** @type {string} */
			let name = args.shift();
			/** @type {string[]} */
			let totalArgs = [];
			if(this.__commands__.has(name)) {
				let command = this.__commands__.get(name);

				while(args.length) {
					if(command instanceof Literal) {
						let arg = args.shift();
						totalArgs = [arg];
						if(command.hasLiteral(arg)) {
							command = command.getLiteral(arg);
						} else if(command.hasArgument()) {
							command = command.getArgument();
						} else {
							return Promise.reject(new CommandDispatcher.TooManyArgumentsError(name));
						}
					} else if(command instanceof Argument) {
						if(command.isRestString()) {
							totalArgs = totalArgs.concat(args.splice(0));
						} else if(command.hasArgument()) {
							command = command.getArgument();
							totalArgs.push(args.shift());
						} else {
							console.log('???');
						}
					} else {
						console.log('??????????????????????');
					}
				}

				if(!command.isExecutable()) {
					return Promise.reject(new CommandDispatcher.MissingArgumentError(name));
				}
				return command.execute(source, ...totalArgs);
			} else {
				return Promise.reject(new CommandDispatcher.UnknownCommandError(name));
			}
		} else {
			return Promise.reject(new CommandDispatcher.EmptyCommandError());
		}
	}
}

CommandDispatcher.EmptyCommandError = class EmptyCommandError extends Error {
	constructor() {
		super('Empty command');
	}
};

CommandDispatcher.UnknownCommandError = class UnknownCommandError extends Error {
	constructor(name) {
		super(`Unknown command ${name}`);
	}
};

CommandDispatcher.MissingArgumentError = class MissingArgumentError extends Error {
	constructor(name) {
		super(`Missing argument(s) for command ${name}`);
	}
};

CommandDispatcher.TooManyArgumentsError = class TooManyArgumentsError extends Error {
	constructor(name) {
		super(`Too many argument(s) for command ${name}`);
	}
};

CommandDispatcher.CommandAlreadyRegisteredError = class CommandAlreadyRegisteredError extends Error {
	constructor(name) {
		super(`Command ${name} already registered`);
	}
};

/**
 * @param {string} name Nom de la commande
 */
function literal(name) {
	return new Literal(name);
}

/**
 * @param {string} name Nom de l'argument
 * @param {string} [restString=false] Le reste de la commande est-il concatené ?
 */
function argument(name, restString = false) {
	return new Argument(name, restString);
}

/** @class */
class Permission {
	constructor(check) {
		/** @type {function(any): boolean} */
		this.checkPermission = check;
	}
}

Permission.basic = new Permission(() => true);

/*
// Tests
let dispatcher = new CommandDispatcher();

dispatcher.register(
	literal('foo')
		.then(
			argument('bar')
				.then(
					argument('baz')
						.executes((_, bar, baz) => {
							return new Promise((resolve, reject) => {
								//console.log(`ouioui la fonction: foo "${bar}" "${baz}"`);
								resolve(`"foo ${bar} ${baz}"`);
							});
						})
						.description('le trio fbb')
				)
				.executes((_, bar) => {
					return new Promise((resolve, reject) => {
						//console.log(`ouioui la fonction: foo ${bar}`);
						resolve(`"foo ${bar}"`);
					});
				})
				.description('foo et du bar')
		)
		.then(
			literal('blyat')
				.then(
					argument('bite', true)
						.executes((_, ...bite) => {
							return new Promise((resolve, reject) => {
								//console.log(`ouioui la fonction: foo blyat [${bite}]`);
								resolve(`"foo blyat [${bite}]"`);
							});
						})
						.description('foo puis blyat et des trucs')
				)
		)
		.executes(_ => {
			return new Promise((resolve, reject) => {
				//console.log('ouioui la fonction: foo');
				resolve('"foo"');
			});
		})
		.description('foo tout seul')
);

let source = {
	message: {
		member: null
	}
};
dispatcher.parse(source, 'foo').then(console.log).catch(console.error);
dispatcher.parse(source, 'foo aya').then(console.log).catch(console.error);
dispatcher.parse(source, 'foo 123 456').then(console.log).catch(console.error);
dispatcher.parse(source, 'foo blyat a b c').then(console.log).catch(console.error);
for(let l of dispatcher.__commands__.values())
	console.log(l.getUsages('+'));

	*/
module.exports = { Permission, CommandDispatcher, literal, argument };
