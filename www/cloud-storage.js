'use strict';

/*global angular*/

var exec = require('cordova/exec');

var backends = {};
var backend = undefined;

var _initialized = false;
function assertInitialized() {
	if (_initialized) { return; }
	_initialized = true;

	var attemptedBackends = [
		require('org.opennms.cordova.storage.backends.local'),
		require('org.opennms.cordova.storage.backends.icloud')
	], i, len = attemptedBackends.length, be;

	for (i=0; i < len; i++) {
		be = attemptedBackends[i];
		if (be && be.name) {
			console.log('CloudStorage: checking plugin: ' + be.name);
			if (be.isValid && be.isValid()) {
				console.log('CloudStorage: ' + be.name + ' is valid.');
				backends[be.name] = be; 
			} else {
				console.log('CloudStorage: ' + be.name + ' is not valid.');
			}
		}
	}

	if (backends.icloud) {
		backend = 'icloud';
	} else {
		backend = 'local';
	}
}
assertInitialized();

var CloudStorage = {
	setBackend: function(b, success, failure) {
		assertInitialized();
		if (backends[b]) {
			backend = b;
			success(b);
		} else {
			var error = 'Unknown backend "' + b + '"';
			console.log('CloudStorage: WARNING: ' + error);
			console.log('CloudStorage: available backends: ' + Object.keys(backends).join(', '));
			failure(error);
		}
	},
	readFile: function(filename, success, failure) {
		assertInitialized();
		console.log('CloudStorage: ' + backend + '.readFile(' + filename + ')');
		backends[backend].readFile(filename, success, failure);
	},
	writeFile: function(filename, data, success, failure) {
		assertInitialized();
		console.log('CloudStorage: ' + backend + '.writeFile(' + filename + ', ...)');
		backends[backend].writeFile(filename, data, success, failure);
	},
	removeFile: function(filename, success, failure) {
		assertInitialized();
		console.log('CloudStorage: ' + backend + '.removeFile(' + filename + ')');
		backends[backend].removeFile(filename, success, failure);
	},
	listFiles: function(path, success, failure) {
		assertInitialized();
		console.log('CloudStorage: ' + backend + '.listFiles(' + path + ')');
		backends[backend].listFiles(path, success, failure);
	},
};

if (typeof angular !== "undefined") {
	console.log('CloudStorage: Angular is available.  Registering Angular module.');
	angular.module('CloudStorage', []).factory('CloudStorage', function($timeout, $q) {
		function makePromise(fn, args, async) {
			var deferred = $q.defer();
			
			var success = function(response) {
				if (async) {
					$timeout(function() {
						deferred.resolve(response.contents);
					});
				} else {
					deferred.resolve(response.contents);
				}
			};
			
			var fail = function(response) {
				if (async) {
					$timeout(function() {
						deferred.reject(response);
					});
				} else {
					deferred.reject(response);
				}
			};
			
			args.push(success);
			args.push(fail);
			
			fn.apply(CloudStorage, args);
			
			return deferred.promise;
		}
		
		return {
			setBackend: function(backend) {
				makePromise(CloudStorage.setBackend, [backend]);
			},
			readFile: function(filename) {
				makePromise(CloudStorage.readFile, [filename]);
			},
			writeFile: function(filename, data) {
				makePromise(CloudStorage.writeFile, [filename, data]);
			},
			removeFile: function(filename) {
				makePromise(CloudStorage.removeFile, [filename]);
			},
			listFiles: function(path) {
				makePromise(CloudStorage.listFiles, [path]);
			},
		};
	});
} else {
	console.log('CloudStorage: Angular is not available.  Skipping Angular support.');
}

module.exports = CloudStorage;

if (!window.plugins) {
	window.plugins = {};
}
if (!window.plugins.CloudStorage) {
	window.plugins.CloudStorage = CloudStorage;
}

