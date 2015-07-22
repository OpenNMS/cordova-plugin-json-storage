'use strict';

/*global angular*/

var exec = require('cordova/exec');

function LocalBackend() {}
LocalBackend.prototype.readFile = function(filename, success, failure) {
	exec(function s(response) { success(response.contents); }, failure, 'CloudStorage', 'onmsGetJsonFileContents', [filename]);
};
LocalBackend.prototype.writeFile = function(filename, data, success, failure) {
	exec(function s(response) { success(response.contents); }, failure, 'CloudStorage', 'onmsSetJsonFileContents', [filename, data]);
};
LocalBackend.prototype.removeFile = function(filename, success, failure) {
	exec(function s(response) { success(response.contents); }, failure, 'CloudStorage', 'onmsRemoveJsonFile', [filename]);
};
LocalBackend.prototype.listFiles = function(path, success, failure) {
	exec(function s(response) { success(response.contents); }, failure, 'CloudStorage', 'onmsListJsonFiles', [path]);
};

var backends = {
	local: new LocalBackend()
};

if (iCloudKV) {
	var callSuccess = function(cb, data) {
		var ret = { success: true };
		if (data) {
			ret.contents = data;
		}
		cb(ret);
	};
	var callError = function(cb, err) {
		var ret = { success: false };
		if (err) {
			ret.error = err;
		}
		cb(ret);
	};
	var getIndex = function(cb) {
		iCloudKV.load('_index', function success(value) {
			value = JSON.parse(value);
			cb(value);
		}, function failure(err) {
			console.log('CloudStorage: iCloud: WARNING: getIndex failed. ' + JSON.stringify(err));
			cb([]);
		});
	};
	var updateIndex = function(index, s, f) {
		iCloudKV.save('_index', JSON.stringify(index), function success() {
			console.log('CloudStorage: iCloud: updated index: ' + JSON.stringify(index));
			s(index);
		}, function failure(err) {
			console.log('CloudStorage: iCloud: WARNING: updateIndex failed. ' + JSON.stringify(err));
			callError(f, err);
		});
	};
	backends.icloud = {
		readFile: function(filename, s, f) {
			iCloudKV.load(encodeURIComponent(filename), function success(value) {
				console.log('CloudStorage: iCloud: read ' + filename + ': ' + value);
				callSuccess(s, JSON.parse(value));
			}, function failure(err) {
				console.log('CloudStorage: iCloud: ' + filename + ' failure: ' + JSON.stringify(err));
				callError(f, err);
			});
		},
		writeFile: function(filename, data, s, f) {
			data = JSON.stringify(data);

			iCloudKV.save(encodeURIComponent(filename), data, function success(value) {
				console.log('CloudStorage: iCloud: wrote ' + filename + ': ' + JSON.stringify(value));
				getIndex(function callback(index) {
					if (index.indexOf(filename) === -1) {
						index.push(filename);
						index.sort();
						updateIndex(index, function() {
							callSuccess(s, value);
						}, function(err) {
							callError(f, err);
						});
					} else {
						callSuccess(s, value);
					}
				});
			}, function failure(err) {
				console.log('CloudStorage: iCloud: ' + filename + ' failure: ' + JSON.stringify(err));
				callError(f, err);
			});
		},
		removeFile: function(filename, s, f) {
			var doRemove = function() {
				return iCloudKV.remove(encodeURIComponent(filename), function success(value) {
					console.log('CloudStorage: iCloud: removed ' + filename);
					callSuccess(s, value);
				}, function failure(err) {
					console.log('CloudStorage: iCloud: ' + filename + ' failure: ' + JSON.stringify(err));
					callError(f, err);
				});
			};

			return getIndex(function callback(index) {
				var loc = index.indexOf(filename);
				if (loc !== -1) {
					index.splice(loc, 1);
					return updateIndex(index, function() {
						return doRemove();
					}, function(err) {
						callError(f, err);
					});
				} else {
					return doRemove();
				}
			});
		},
		listFiles: function(path, s, f) {
			return getIndex(function callback(index) {
				callSuccess(s, index);
			});
		},
	};
} else {
	console.log('CloudStorage: iCloud plugin not available.');
}

console.log('CloudStorage: available backends: ' + Object.keys(backends).join(', '));

var backend = 'local';
if (backends.icloud) {
	backend = 'icloud';
}

var CloudStorage = {
	setBackend: function(b, success, failure) {
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
		console.log('CloudStorage: ' + backend + '.readFile(' + filename + ')');
		backends[backend].readFile(filename, success, failure);
	},
	writeFile: function(filename, data, success, failure) {
		console.log('CloudStorage: ' + backend + '.writeFile(' + filename + ', ...)');
		backends[backend].writeFile(filename, data, success, failure);
	},
	removeFile: function(filename, success, failure) {
		console.log('CloudStorage: ' + backend + '.removeFile(' + filename + ')');
		backends[backend].removeFile(filename, success, failure);
	},
	listFiles: function(path, success, failure) {
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

