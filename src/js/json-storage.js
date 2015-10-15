/* jshint -W097 */

'use strict';

/* global angular */
/* global console */
/* global document */
/* global module */
/* global require */
/* global window */

/* global DropboxBackend */
/* global KeychainBackend */
/* global LocalBackend */
/* global MemoryBackend */

var backends = {},
	defaultBackend,
	options = {debug:false},
	_initialized = false;

function assertInitialized() {
	if (_initialized) { return; }
	_initialized = true;

	console.log('JSONStorage: Initializing.');

	var attemptedBackends = [
		new DropboxBackend(options),
		new KeychainBackend(options),
		new LocalBackend(options),
		new MemoryBackend(options)
	], i, len = attemptedBackends.length, be;

	if (options.debug) {
		console.log('JSONStorage: Attempting backends: ' + attemptedBackends.map(function(entry){return entry.name;}).join(', '));
	}
	for (i=0; i < len; i++) {
		be = attemptedBackends[i];
		if (be && be.name) {
			if (options.debug) {
				console.log('JSONStorage: Checking plugin "' + be.name + '".');
			}
			if (be.isValid && be.isValid()) {
				if (options.debug) {
					console.log('JSONStorage: Backend "' + be.name + '" is valid.');
				}
				backends[be.name] = be;
			} else {
				console.log('JSONStorage: Backend "' + be.name + '" is not valid.');
			}
		}
	}
	console.log('JSONStorage: Configured backends: ' + Object.keys(backends));

	if (backends.keychain) {
		defaultBackend = 'keychain';
	} else {
		defaultBackend = 'local';
	}
	return true;
}

var getBackend = function(b) {
	if (backends[b]) {
		return backends[b];
	} else if (b !== undefined) {
		console.log('JSONStorage: Unknown backend "' + b + '": falling back to default ("' + defaultBackend + '")');
	}
	return backends[defaultBackend];
};

var JSONStorage = {
	/* only for testing, do not use */
	'_': {
		init: assertInitialized,
		getBackend: function(b) {
			return backends[b];
		},
		getBackends: function() {
			return backends;
		}
	},
	setDebug: function(d) {
		options.debug = !!d;
		return options.debug;
	},
	setOptions: function(o) {
		options = o;
		return options;
	},
	getDefaultBackend: function() {
		return defaultBackend;
	},
	setDefaultBackend: function(b, success, failure) {
		assertInitialized();
		if (backends[b]) {
			if (options.debug) { console.log('JSONStorage: setting backend to ' + b); }
			defaultBackend = b;
			if (success) {
				success(b);
			}
		} else {
			var error = 'Unknown backend "' + b + '"';
			console.log('JSONStorage: WARNING: ' + error);
			console.log('JSONStorage: available backends: ' + Object.keys(backends).join(', '));
			if (failure) {
				failure(error);
			}
		}
	},
	readFile: function(filename, success, failure, backend) {
		assertInitialized();
		var be = getBackend(backend);
		if (options.debug) { console.log('JSONStorage: ' + be.name + '.readFile(' + filename + ')'); }
		be.readFile(filename, success, failure);
	},
	writeFile: function(filename, data, success, failure, backend) {
		assertInitialized();
		var be = getBackend(backend);
		if (options.debug) { console.log('JSONStorage: ' + be.name + '.writeFile(' + filename + ', ...)'); }
		be.writeFile(filename, data, success, failure);
	},
	removeFile: function(filename, success, failure, backend) {
		assertInitialized();
		var be = getBackend(backend);
		if (options.debug) { console.log('JSONStorage: ' + be.name + '.removeFile(' + filename + ')'); }
		be.removeFile(filename, success, failure);
	},
	listFiles: function(path, success, failure, backend) {
		assertInitialized();
		var be = getBackend(backend);
		if (options.debug) { console.log('JSONStorage: ' + be.name + '.listFiles(' + path + ')'); }
		be.listFiles(path, success, failure);
	},
	wipeData: function(success, failure, backend) {
		assertInitialized();
		var be = getBackend(backend);
		if (options.debug) { console.log('JSONStorage: ' + be.name + '.wipeData()'); }
		be.wipeData(success, failure);
	},
};

if (typeof angular !== "undefined") {
	console.log('JSONStorage: Angular is available.  Registering Angular module.');
	angular.module('JSONStorage', []).factory('JSONStorage', function($timeout, $q) {
		function makePromise(fn, args, async, hasBackend) {
			var deferred = $q.defer();

			var success = function(response) {
				if (options.debug) { console.log('JSONStorage: success: ' + angular.toJson(response)); }
				if (async) {
					$timeout(function() {
						deferred.resolve(response);
					});
				} else {
					deferred.resolve(response);
				}
			};

			var fail = function(response) {
				if (options.debug) { console.log('JSONStorage: failure: ' + angular.toJson(response)); }
				if (async) {
					$timeout(function() {
						deferred.reject(response);
					});
				} else {
					deferred.reject(response);
				}
			};

			var backend;
			if (hasBackend) {
				// pull the (optional) backend off the arg list, since it's always last
				backend = args.pop();
			}
			args.push(success);
			args.push(fail);
			if (hasBackend) {
				args.push(backend);
			}

			fn.apply(JSONStorage, args);

			return deferred.promise;
		}

		return {
			setDebug: function(debug) {
				return JSONStorage.setDebug(debug);
			},
			setOptions: function(options) {
				return JSONStorage.setOptions(options);
			},
			setDefaultBackend: function(backend) {
				return makePromise(JSONStorage.setDefaultBackend, [backend]);
			},
			readFile: function(filename, backend) {
				return makePromise(JSONStorage.readFile, [filename, backend], false, true);
			},
			writeFile: function(filename, data, backend) {
				return makePromise(JSONStorage.writeFile, [filename, data, backend], false, true);
			},
			removeFile: function(filename, backend) {
				return makePromise(JSONStorage.removeFile, [filename, backend], false, true);
			},
			listFiles: function(path, backend) {
				return makePromise(JSONStorage.listFiles, [path, backend], false, true);
			},
			wipeData: function(backend) {
				return makePromise(JSONStorage.wipeData, [backend], false, true);
			},
		};
	});
} else {
	console.log('JSONStorage: Angular is not available.  Skipping Angular support.');
}

module.exports = JSONStorage;

if (!window.plugins) {
	window.plugins = {};
}
if (!window.plugins.JSONStorage) {
	window.plugins.JSONStorage = JSONStorage;
}
