/*global angular*/

var exec = require('cordova/exec');

var backend = 'cloud';
var CloudStorage = {
	setBackend: function(b, success, failure) {
		if (b === 'cloud' || b === 'none') {
			backend = b;
			return success(b);
		} else {
			var error = 'Unknown backend "' + b + '"';
			console.log('CloudStorage: WARNING: ' + error);
			return failure(error);
		}
	},
	readFile: function(filename, success, failure) {
		if (backend === 'cloud') {
			return exec(success, failure, 'CloudStorage', 'onmsGetJsonFileContents', [filename]);
		} else {
			return exec(success, failure, 'CloudStorage', 'onmsGetPrivateJsonFileContents', [filename]);
		}
	},
	writeFile: function(filename, data, success, failure) {
		if (backend === 'cloud') {
			return exec(success, failure, 'CloudStorage', 'onmsSetJsonFileContents', [filename, data]);
		} else {
			return exec(success, failure, 'CloudStorage', 'onmsSetPrivateJsonFileContents', [filename, data]);
		}
	},
	removeFile: function(filename, success, failure) {
		if (backend === 'cloud') {
			return exec(success, failure, 'CloudStorage', 'onmsRemoveJsonFile', [filename]);
		} else {
			return exec(success, failure, 'CloudStorage', 'onmsRemovePrivateJsonFile', [filename]);
		}
	},
	listFiles: function(path, success, failure) {
		if (backend === 'cloud') {
			return exec(success, failure, 'CloudStorage', 'onmsListJsonFiles', [path]);
		} else {
			return exec(success, failure, 'CloudStorage', 'onmsListPrivateJsonFiles', [path]);
		}
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
				return makePromise(CloudStorage.setBackend, [backend]);
			},
			readFile: function(filename) {
				return makePromise(CloudStorage.readFile, [filename]);
			},
			writeFile: function(filename, data) {
				return makePromise(CloudStorage.writeFile, [filename, data]);
			},
			removeFile: function(filename) {
				return makePromise(CloudStorage.removeFile, [filename]);
			},
			listFiles: function(path) {
				return makePromise(CloudStorage.listFiles, [path]);
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
