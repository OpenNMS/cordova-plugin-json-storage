/* jshint -W097 */

'use strict';

/* global angular */
/* global console */
/* global document */
/* global module */
/* global require */
/* global window */

/* global KeychainBackend */
/* global LocalBackend */

var debug = false;
var backends = {};
var defaultBackend;

var _initialized = false;
function assertInitialized() {
	if (_initialized) { return; }
	_initialized = true;

	console.log('CloudStorage: Initializing.');

	var attemptedBackends = [
		new KeychainBackend(),
		new LocalBackend()
	], i, len = attemptedBackends.length, be;

	if (debug) {
		console.log('CloudStorage: Attempting backends: ' + attemptedBackends.map(function(entry){return entry.name;}).join(', '));
	}
	for (i=0; i < len; i++) {
		be = attemptedBackends[i];
		if (be && be.name) {
			if (debug) {
				console.log('CloudStorage: Checking plugin "' + be.name + '".');
			}
			if (be.isValid && be.isValid()) {
				if (debug) {
					console.log('CloudStorage: Backend "' + be.name + '" is valid.');
				}
				backends[be.name] = be;
			} else {
				console.log('CloudStorage: Backend "' + be.name + '" is not valid.');
			}
		}
	}
	console.log('CloudStorage: Configured backends: ' + Object.keys(backends));

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
		console.log('CloudStorage: Unknown backend "' + b + '": falling back to default ("' + defaultBackend + '")');
	}
	return backends[defaultBackend];
};

var CloudStorage = {
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
		debug = !!d;
	},
	getDefaultBackend: function() {
		return defaultBackend;
	},
	setDefaultBackend: function(b, success, failure) {
		assertInitialized();
		if (backends[b]) {
			if (debug) { console.log('CloudStorage: setting backend to ' + b); }
			defaultBackend = b;
			success(b);
		} else {
			var error = 'Unknown backend "' + b + '"';
			console.log('CloudStorage: WARNING: ' + error);
			console.log('CloudStorage: available backends: ' + Object.keys(backends).join(', '));
			failure(error);
		}
	},
	readFile: function(filename, success, failure, backend) {
		assertInitialized();
		var be = getBackend(backend);
		if (debug) { console.log('CloudStorage: ' + be.name + '.readFile(' + filename + ')'); }
		be.readFile(filename, success, failure);
	},
	writeFile: function(filename, data, success, failure, backend) {
		assertInitialized();
		var be = getBackend(backend);
		if (debug) { console.log('CloudStorage: ' + be.name + '.writeFile(' + filename + ', ...)'); }
		be.writeFile(filename, data, success, failure);
	},
	removeFile: function(filename, success, failure, backend) {
		assertInitialized();
		var be = getBackend(backend);
		if (debug) { console.log('CloudStorage: ' + be.name + '.removeFile(' + filename + ')'); }
		be.removeFile(filename, success, failure);
	},
	listFiles: function(path, success, failure, backend) {
		assertInitialized();
		var be = getBackend(backend);
		if (debug) { console.log('CloudStorage: ' + be.name + '.listFiles(' + path + ')'); }
		be.listFiles(path, success, failure);
	},
	wipeData: function(success, failure, backend) {
		assertInitialized();
		var be = getBackend(backend);
		if (debug) { console.log('CloudStorage: ' + be.name + '.wipeData()'); }
		be.wipeData(success, failure);
	},
};

if (typeof angular !== "undefined") {
	console.log('CloudStorage: Angular is available.  Registering Angular module.');
	angular.module('CloudStorage', []).factory('CloudStorage', function($timeout, $q) {
		function makePromise(fn, args, async, hasBackend) {
			var deferred = $q.defer();

			var success = function(response) {
				if (debug) { console.log('CloudStorage: success: ' + angular.toJson(response)); }
				if (async) {
					$timeout(function() {
						deferred.resolve(response);
					});
				} else {
					deferred.resolve(response);
				}
			};

			var fail = function(response) {
				if (debug) { console.log('CloudStorage: failure: ' + angular.toJson(response)); }
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

			fn.apply(CloudStorage, args);

			return deferred.promise;
		}

		return {
			setDebug: function(debug) {
				return CloudStorage.setDebug(debug);
			},
			setDefaultBackend: function(backend) {
				return makePromise(CloudStorage.setDefaultBackend, [backend]);
			},
			readFile: function(filename, backend) {
				return makePromise(CloudStorage.readFile, [filename, backend], false, true);
			},
			writeFile: function(filename, data, backend) {
				return makePromise(CloudStorage.writeFile, [filename, data, backend], false, true);
			},
			removeFile: function(filename, backend) {
				return makePromise(CloudStorage.removeFile, [filename, backend], false, true);
			},
			listFiles: function(path, backend) {
				return makePromise(CloudStorage.listFiles, [path, backend], false, true);
			},
			wipeData: function(backend) {
				return makePromise(CloudStorage.wipeData, [backend], false, true);
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

/* jshint -W097 */

'use strict';

/* global console */
/* global require */
/* global window */

var Keychain = require('com.shazron.cordova.plugin.keychainutil.Keychain');

if (typeof String.prototype.startsWith !== 'function') {
	String.prototype.startsWith = function(str) {
		return this.lastIndexOf(str, 0) === 0;
	};
}
if (typeof String.prototype.endsWith !== 'function') {
	String.prototype.endsWith = function(suffix) {
		return this.indexOf(suffix, this.length - suffix.length) !== -1;
	};
}

function KeychainBackend() {
	var kc = new Keychain();
	var serviceName = 'CordovaCloudStorage';

	var encodeKey = function(str) {
		return window.btoa(str);
		/*
		return str
			.replace(/[\\]/g, '\\\\')
			.replace(/[\"]/g, '\\\"')
			.replace(/[\/]/g, '\\/')
			.replace(/[\b]/g, '\\b')
			.replace(/[\f]/g, '\\f')
			.replace(/[\n]/g, '\\n')
			.replace(/[\r]/g, '\\r')
			.replace(/[\t]/g, '\\t');
		*/
  	};

	var encode = function(str) {
		return JSON.stringify(str);
	};

	var decode = function(str) {
		return JSON.parse(str);
	};

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

	var clearIndex = function(cb) {
		kc.removeForKey(function success(result) {
			cb(true);
		}, function failure(err) {
			if (err.indexOf('-25300') >= 0) {
				// not found error, consider it cleared
				cb(true);
			} else {
				console.log('KeychainBackend.clearIndex: WARNING: failed: ' + JSON.stringify(err));
				cb(false);
			}
		}, '_index', serviceName);
	};
	var getIndex = function(s, f) {
		kc.getForKey(function success(result) {
			s(decode(result));
		}, function failure(err) {
			console.log('KeychainBackend.getIndex: WARNING: failed: ' + JSON.stringify(err));
			f(err);
		}, '_index', serviceName);
	};
	var updateIndex = function(index, s, f) {
		kc.setForKey(function success() {
			//console.log('KeychainBackend.updateIndex: ' + JSON.stringify(index));
			s(true);
		}, function failure(err) {
			console.log('KeychainBackend.updateIndex: WARNING: failed: ' + JSON.stringify(err));
			f(err);
		}, '_index', serviceName, encode(index));
	};

	this.isValid = function() {
		if (kc && kc.getForKey) {
			return true;
		} else {
			return false;
		}
	};

	this.readFile = function(filename, s, f) {
		kc.getForKey(function success(result) {
			//console.log('KeychainBackend.readFile: read ' + filename + ': ' + result);
			callSuccess(s, decode(result));
		}, function failure(err) {
			console.log('KeychainBackend.readFile: ' + filename + ' failure: ' + JSON.stringify(err));
			callError(f, err);
		}, encodeKey(filename), serviceName);
	};

	this.writeFile = function(filename, data, s, f) {
		data = encode(data);

		kc.setForKey(function success() {
			//console.log('KeychainBackend.writeFile: wrote ' + filename);
			getIndex(function success(index) {
				if (index.indexOf(filename) === -1) {
					index.push(filename);
					index.sort();
					updateIndex(index, function() {
						callSuccess(s, data);
					}, function(err) {
						callError(f, err);
					});
				} else {
					callSuccess(s, true);
				}
			}, function failure(err) {
				updateIndex([filename], function() {
					callSuccess(s, data);
				}, function(err) {
					callError(f, err);
				});
			});
		}, function failure(err) {
			console.log('KeychainBackend.writeFile: ' + filename + ' failure: ' + err);
			callError(f, err);
		}, encodeKey(filename), serviceName, data);
	};

	this.removeFile = function(filename, s, f) {
		var doRemove = function() {
			kc.removeForKey(function success() {
				//console.log('KeychainBackend.removeFile: removed ' + filename);
				callSuccess(s, true);
			}, function failure(err) {
				console.log('KeychainBackend.removeFile: ' + filename + ' failure: ' + err);
				callError(f, err);
			}, encodeKey(filename), serviceName);
		};

		getIndex(function success(index) {
			var loc = index.indexOf(filename);
			if (loc !== -1) {
				index.splice(loc, 1);
				updateIndex(index, function() {
					doRemove();
				}, function(err) {
					callError(f, err);
				});
			} else {
				doRemove();
			}
		}, function failure(err) {
			callError(f, err);
		});
	};

	this.listFiles = function(path, s, f) {
		getIndex(function success(index) {
			var i, len = index.length, entry, ret = [], prefix = path;
			if (!prefix.endsWith('/')) {
				prefix = prefix + '/';
			}

			var replace = new RegExp('^' + prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
			for (i=0; i < len; i++) {
				entry = index[i];
				if (path === '' && !entry.startsWith('/')) {
					ret.push(entry);
				} else if (entry.startsWith(prefix)) {
					ret.push(entry.replace(replace, ''));
				}
			}

			//console.log('KeychainBackend.listFiles: listFiles('+path+'): before = ' + JSON.stringify(index, true));
			//console.log('KeychainBackend.listFiles: listFiles('+path+'): after  = ' + JSON.stringify(ret, true));
			callSuccess(s, ret);
		}, function failure(err) {
			callError(f, err);
		});
	};

	this.wipeData = function(s, f) {
		var clear = function(index) {
			var i, len, entry;

			var pendingTransactions = {};

			var removeItem = function(item) {
				//console.log('KeychainBackend.wipeData: removing ' + item);
				pendingTransactions[item] = undefined;
				kc.removeForKey(function() {
					pendingTransactions[item] = true;
				}, function err(e) {
					console.log('KeychainBackend.wipeData: WARNING: unable to remove ' + item + ': ' + e);
					pendingTransactions[item] = false;
				}, encodeKey(item), serviceName);
			};

			var timeoutID;
			var waitForCompletion = function() {
				var finished = true,
					failed = [],
					keys = Object.keys(pendingTransactions),
					i, len = keys.length, filename;

				for (i=0; i < len; i++) {
					filename = keys[i];
					if (pendingTransactions[filename] === undefined) {
						finished = false;

					} else if (!pendingTransactions[filename]) {
						failed.push(filename);
					}
				}

				if (timeoutID) {
					window.clearTimeout(timeoutID);
				}
				if (finished) {
					if (failed.length > 0) {
						callError(f, 'Failed to remove files: ' + failed.join(', '));
					} else {
						callSuccess(s);
					}
				} else {
					window.setTimeout(waitForCompletion, 100);
				}
			};

			clearIndex(function clearCallback(success) {
				//console.log('KeychainBackend.wipeData: clearIndex: ' + success);
				if (success) {
					if (index) {
						len = index.length;
						for (i=0; i < len; i++) {
							entry = index[i];
							removeItem(entry);
						}
					}
					waitForCompletion();
				} else {
					callError(f);
				}
			});
		};

		getIndex(function success(index) {
			//console.log('KeychainBackend.wipeData: ' + JSON.stringify(index));
			clear(index);
		}, function failure(err) {
			console.log('KeychainBackend.wipeData: WARNING: ' + err);
			clear();
		});
	};
}

KeychainBackend.prototype.name = 'keychain';

/* jshint -W097 */

'use strict';

/* global require */

var exec = require('cordova/exec');

function LocalBackend() {}
LocalBackend.prototype.name = 'local';
LocalBackend.prototype.isValid = function() {
	return true;
};
LocalBackend.prototype.readFile = function(filename, success, failure) {
	exec(success, failure, 'CloudStorage', 'onmsGetJsonFileContents', [filename]);
};
LocalBackend.prototype.writeFile = function(filename, data, success, failure) {
	exec(success, failure, 'CloudStorage', 'onmsSetJsonFileContents', [filename, data]);
};
LocalBackend.prototype.removeFile = function(filename, success, failure) {
	exec(success, failure, 'CloudStorage', 'onmsRemoveJsonFile', [filename]);
};
LocalBackend.prototype.listFiles = function(path, success, failure) {
	exec(success, failure, 'CloudStorage', 'onmsListJsonFiles', [path]);
};
LocalBackend.prototype.wipeData = function(success, failure) {
	exec(success, failure, 'CloudStorage', 'onmsWipe', []);
};

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImNsb3VkLXN0b3JhZ2UuanMiLCJiYWNrZW5kcy9rZXljaGFpbi5qcyIsImJhY2tlbmRzL2xvY2FsLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ2pOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDL1FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiY2xvdWQtc3RvcmFnZS5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qIGpzaGludCAtVzA5NyAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbi8qIGdsb2JhbCBhbmd1bGFyICovXG4vKiBnbG9iYWwgY29uc29sZSAqL1xuLyogZ2xvYmFsIGRvY3VtZW50ICovXG4vKiBnbG9iYWwgbW9kdWxlICovXG4vKiBnbG9iYWwgcmVxdWlyZSAqL1xuLyogZ2xvYmFsIHdpbmRvdyAqL1xuXG4vKiBnbG9iYWwgS2V5Y2hhaW5CYWNrZW5kICovXG4vKiBnbG9iYWwgTG9jYWxCYWNrZW5kICovXG5cbnZhciBkZWJ1ZyA9IGZhbHNlO1xudmFyIGJhY2tlbmRzID0ge307XG52YXIgZGVmYXVsdEJhY2tlbmQ7XG5cbnZhciBfaW5pdGlhbGl6ZWQgPSBmYWxzZTtcbmZ1bmN0aW9uIGFzc2VydEluaXRpYWxpemVkKCkge1xuXHRpZiAoX2luaXRpYWxpemVkKSB7IHJldHVybjsgfVxuXHRfaW5pdGlhbGl6ZWQgPSB0cnVlO1xuXG5cdGNvbnNvbGUubG9nKCdDbG91ZFN0b3JhZ2U6IEluaXRpYWxpemluZy4nKTtcblxuXHR2YXIgYXR0ZW1wdGVkQmFja2VuZHMgPSBbXG5cdFx0bmV3IEtleWNoYWluQmFja2VuZCgpLFxuXHRcdG5ldyBMb2NhbEJhY2tlbmQoKVxuXHRdLCBpLCBsZW4gPSBhdHRlbXB0ZWRCYWNrZW5kcy5sZW5ndGgsIGJlO1xuXG5cdGlmIChkZWJ1Zykge1xuXHRcdGNvbnNvbGUubG9nKCdDbG91ZFN0b3JhZ2U6IEF0dGVtcHRpbmcgYmFja2VuZHM6ICcgKyBhdHRlbXB0ZWRCYWNrZW5kcy5tYXAoZnVuY3Rpb24oZW50cnkpe3JldHVybiBlbnRyeS5uYW1lO30pLmpvaW4oJywgJykpO1xuXHR9XG5cdGZvciAoaT0wOyBpIDwgbGVuOyBpKyspIHtcblx0XHRiZSA9IGF0dGVtcHRlZEJhY2tlbmRzW2ldO1xuXHRcdGlmIChiZSAmJiBiZS5uYW1lKSB7XG5cdFx0XHRpZiAoZGVidWcpIHtcblx0XHRcdFx0Y29uc29sZS5sb2coJ0Nsb3VkU3RvcmFnZTogQ2hlY2tpbmcgcGx1Z2luIFwiJyArIGJlLm5hbWUgKyAnXCIuJyk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoYmUuaXNWYWxpZCAmJiBiZS5pc1ZhbGlkKCkpIHtcblx0XHRcdFx0aWYgKGRlYnVnKSB7XG5cdFx0XHRcdFx0Y29uc29sZS5sb2coJ0Nsb3VkU3RvcmFnZTogQmFja2VuZCBcIicgKyBiZS5uYW1lICsgJ1wiIGlzIHZhbGlkLicpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGJhY2tlbmRzW2JlLm5hbWVdID0gYmU7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb25zb2xlLmxvZygnQ2xvdWRTdG9yYWdlOiBCYWNrZW5kIFwiJyArIGJlLm5hbWUgKyAnXCIgaXMgbm90IHZhbGlkLicpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXHRjb25zb2xlLmxvZygnQ2xvdWRTdG9yYWdlOiBDb25maWd1cmVkIGJhY2tlbmRzOiAnICsgT2JqZWN0LmtleXMoYmFja2VuZHMpKTtcblxuXHRpZiAoYmFja2VuZHMua2V5Y2hhaW4pIHtcblx0XHRkZWZhdWx0QmFja2VuZCA9ICdrZXljaGFpbic7XG5cdH0gZWxzZSB7XG5cdFx0ZGVmYXVsdEJhY2tlbmQgPSAnbG9jYWwnO1xuXHR9XG5cdHJldHVybiB0cnVlO1xufVxuXG52YXIgZ2V0QmFja2VuZCA9IGZ1bmN0aW9uKGIpIHtcblx0aWYgKGJhY2tlbmRzW2JdKSB7XG5cdFx0cmV0dXJuIGJhY2tlbmRzW2JdO1xuXHR9IGVsc2UgaWYgKGIgIT09IHVuZGVmaW5lZCkge1xuXHRcdGNvbnNvbGUubG9nKCdDbG91ZFN0b3JhZ2U6IFVua25vd24gYmFja2VuZCBcIicgKyBiICsgJ1wiOiBmYWxsaW5nIGJhY2sgdG8gZGVmYXVsdCAoXCInICsgZGVmYXVsdEJhY2tlbmQgKyAnXCIpJyk7XG5cdH1cblx0cmV0dXJuIGJhY2tlbmRzW2RlZmF1bHRCYWNrZW5kXTtcbn07XG5cbnZhciBDbG91ZFN0b3JhZ2UgPSB7XG5cdCdfJzoge1xuXHRcdGluaXQ6IGFzc2VydEluaXRpYWxpemVkLFxuXHRcdGdldEJhY2tlbmQ6IGZ1bmN0aW9uKGIpIHtcblx0XHRcdHJldHVybiBiYWNrZW5kc1tiXTtcblx0XHR9LFxuXHRcdGdldEJhY2tlbmRzOiBmdW5jdGlvbigpIHtcblx0XHRcdHJldHVybiBiYWNrZW5kcztcblx0XHR9XG5cdH0sXG5cdHNldERlYnVnOiBmdW5jdGlvbihkKSB7XG5cdFx0ZGVidWcgPSAhIWQ7XG5cdH0sXG5cdGdldERlZmF1bHRCYWNrZW5kOiBmdW5jdGlvbigpIHtcblx0XHRyZXR1cm4gZGVmYXVsdEJhY2tlbmQ7XG5cdH0sXG5cdHNldERlZmF1bHRCYWNrZW5kOiBmdW5jdGlvbihiLCBzdWNjZXNzLCBmYWlsdXJlKSB7XG5cdFx0YXNzZXJ0SW5pdGlhbGl6ZWQoKTtcblx0XHRpZiAoYmFja2VuZHNbYl0pIHtcblx0XHRcdGlmIChkZWJ1ZykgeyBjb25zb2xlLmxvZygnQ2xvdWRTdG9yYWdlOiBzZXR0aW5nIGJhY2tlbmQgdG8gJyArIGIpOyB9XG5cdFx0XHRkZWZhdWx0QmFja2VuZCA9IGI7XG5cdFx0XHRzdWNjZXNzKGIpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR2YXIgZXJyb3IgPSAnVW5rbm93biBiYWNrZW5kIFwiJyArIGIgKyAnXCInO1xuXHRcdFx0Y29uc29sZS5sb2coJ0Nsb3VkU3RvcmFnZTogV0FSTklORzogJyArIGVycm9yKTtcblx0XHRcdGNvbnNvbGUubG9nKCdDbG91ZFN0b3JhZ2U6IGF2YWlsYWJsZSBiYWNrZW5kczogJyArIE9iamVjdC5rZXlzKGJhY2tlbmRzKS5qb2luKCcsICcpKTtcblx0XHRcdGZhaWx1cmUoZXJyb3IpO1xuXHRcdH1cblx0fSxcblx0cmVhZEZpbGU6IGZ1bmN0aW9uKGZpbGVuYW1lLCBzdWNjZXNzLCBmYWlsdXJlLCBiYWNrZW5kKSB7XG5cdFx0YXNzZXJ0SW5pdGlhbGl6ZWQoKTtcblx0XHR2YXIgYmUgPSBnZXRCYWNrZW5kKGJhY2tlbmQpO1xuXHRcdGlmIChkZWJ1ZykgeyBjb25zb2xlLmxvZygnQ2xvdWRTdG9yYWdlOiAnICsgYmUubmFtZSArICcucmVhZEZpbGUoJyArIGZpbGVuYW1lICsgJyknKTsgfVxuXHRcdGJlLnJlYWRGaWxlKGZpbGVuYW1lLCBzdWNjZXNzLCBmYWlsdXJlKTtcblx0fSxcblx0d3JpdGVGaWxlOiBmdW5jdGlvbihmaWxlbmFtZSwgZGF0YSwgc3VjY2VzcywgZmFpbHVyZSwgYmFja2VuZCkge1xuXHRcdGFzc2VydEluaXRpYWxpemVkKCk7XG5cdFx0dmFyIGJlID0gZ2V0QmFja2VuZChiYWNrZW5kKTtcblx0XHRpZiAoZGVidWcpIHsgY29uc29sZS5sb2coJ0Nsb3VkU3RvcmFnZTogJyArIGJlLm5hbWUgKyAnLndyaXRlRmlsZSgnICsgZmlsZW5hbWUgKyAnLCAuLi4pJyk7IH1cblx0XHRiZS53cml0ZUZpbGUoZmlsZW5hbWUsIGRhdGEsIHN1Y2Nlc3MsIGZhaWx1cmUpO1xuXHR9LFxuXHRyZW1vdmVGaWxlOiBmdW5jdGlvbihmaWxlbmFtZSwgc3VjY2VzcywgZmFpbHVyZSwgYmFja2VuZCkge1xuXHRcdGFzc2VydEluaXRpYWxpemVkKCk7XG5cdFx0dmFyIGJlID0gZ2V0QmFja2VuZChiYWNrZW5kKTtcblx0XHRpZiAoZGVidWcpIHsgY29uc29sZS5sb2coJ0Nsb3VkU3RvcmFnZTogJyArIGJlLm5hbWUgKyAnLnJlbW92ZUZpbGUoJyArIGZpbGVuYW1lICsgJyknKTsgfVxuXHRcdGJlLnJlbW92ZUZpbGUoZmlsZW5hbWUsIHN1Y2Nlc3MsIGZhaWx1cmUpO1xuXHR9LFxuXHRsaXN0RmlsZXM6IGZ1bmN0aW9uKHBhdGgsIHN1Y2Nlc3MsIGZhaWx1cmUsIGJhY2tlbmQpIHtcblx0XHRhc3NlcnRJbml0aWFsaXplZCgpO1xuXHRcdHZhciBiZSA9IGdldEJhY2tlbmQoYmFja2VuZCk7XG5cdFx0aWYgKGRlYnVnKSB7IGNvbnNvbGUubG9nKCdDbG91ZFN0b3JhZ2U6ICcgKyBiZS5uYW1lICsgJy5saXN0RmlsZXMoJyArIHBhdGggKyAnKScpOyB9XG5cdFx0YmUubGlzdEZpbGVzKHBhdGgsIHN1Y2Nlc3MsIGZhaWx1cmUpO1xuXHR9LFxuXHR3aXBlRGF0YTogZnVuY3Rpb24oc3VjY2VzcywgZmFpbHVyZSwgYmFja2VuZCkge1xuXHRcdGFzc2VydEluaXRpYWxpemVkKCk7XG5cdFx0dmFyIGJlID0gZ2V0QmFja2VuZChiYWNrZW5kKTtcblx0XHRpZiAoZGVidWcpIHsgY29uc29sZS5sb2coJ0Nsb3VkU3RvcmFnZTogJyArIGJlLm5hbWUgKyAnLndpcGVEYXRhKCknKTsgfVxuXHRcdGJlLndpcGVEYXRhKHN1Y2Nlc3MsIGZhaWx1cmUpO1xuXHR9LFxufTtcblxuaWYgKHR5cGVvZiBhbmd1bGFyICE9PSBcInVuZGVmaW5lZFwiKSB7XG5cdGNvbnNvbGUubG9nKCdDbG91ZFN0b3JhZ2U6IEFuZ3VsYXIgaXMgYXZhaWxhYmxlLiAgUmVnaXN0ZXJpbmcgQW5ndWxhciBtb2R1bGUuJyk7XG5cdGFuZ3VsYXIubW9kdWxlKCdDbG91ZFN0b3JhZ2UnLCBbXSkuZmFjdG9yeSgnQ2xvdWRTdG9yYWdlJywgZnVuY3Rpb24oJHRpbWVvdXQsICRxKSB7XG5cdFx0ZnVuY3Rpb24gbWFrZVByb21pc2UoZm4sIGFyZ3MsIGFzeW5jLCBoYXNCYWNrZW5kKSB7XG5cdFx0XHR2YXIgZGVmZXJyZWQgPSAkcS5kZWZlcigpO1xuXG5cdFx0XHR2YXIgc3VjY2VzcyA9IGZ1bmN0aW9uKHJlc3BvbnNlKSB7XG5cdFx0XHRcdGlmIChkZWJ1ZykgeyBjb25zb2xlLmxvZygnQ2xvdWRTdG9yYWdlOiBzdWNjZXNzOiAnICsgYW5ndWxhci50b0pzb24ocmVzcG9uc2UpKTsgfVxuXHRcdFx0XHRpZiAoYXN5bmMpIHtcblx0XHRcdFx0XHQkdGltZW91dChmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRcdGRlZmVycmVkLnJlc29sdmUocmVzcG9uc2UpO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGRlZmVycmVkLnJlc29sdmUocmVzcG9uc2UpO1xuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXG5cdFx0XHR2YXIgZmFpbCA9IGZ1bmN0aW9uKHJlc3BvbnNlKSB7XG5cdFx0XHRcdGlmIChkZWJ1ZykgeyBjb25zb2xlLmxvZygnQ2xvdWRTdG9yYWdlOiBmYWlsdXJlOiAnICsgYW5ndWxhci50b0pzb24ocmVzcG9uc2UpKTsgfVxuXHRcdFx0XHRpZiAoYXN5bmMpIHtcblx0XHRcdFx0XHQkdGltZW91dChmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRcdGRlZmVycmVkLnJlamVjdChyZXNwb25zZSk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0ZGVmZXJyZWQucmVqZWN0KHJlc3BvbnNlKTtcblx0XHRcdFx0fVxuXHRcdFx0fTtcblxuXHRcdFx0dmFyIGJhY2tlbmQ7XG5cdFx0XHRpZiAoaGFzQmFja2VuZCkge1xuXHRcdFx0XHQvLyBwdWxsIHRoZSAob3B0aW9uYWwpIGJhY2tlbmQgb2ZmIHRoZSBhcmcgbGlzdCwgc2luY2UgaXQncyBhbHdheXMgbGFzdFxuXHRcdFx0XHRiYWNrZW5kID0gYXJncy5wb3AoKTtcblx0XHRcdH1cblx0XHRcdGFyZ3MucHVzaChzdWNjZXNzKTtcblx0XHRcdGFyZ3MucHVzaChmYWlsKTtcblx0XHRcdGlmIChoYXNCYWNrZW5kKSB7XG5cdFx0XHRcdGFyZ3MucHVzaChiYWNrZW5kKTtcblx0XHRcdH1cblxuXHRcdFx0Zm4uYXBwbHkoQ2xvdWRTdG9yYWdlLCBhcmdzKTtcblxuXHRcdFx0cmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHtcblx0XHRcdHNldERlYnVnOiBmdW5jdGlvbihkZWJ1Zykge1xuXHRcdFx0XHRyZXR1cm4gQ2xvdWRTdG9yYWdlLnNldERlYnVnKGRlYnVnKTtcblx0XHRcdH0sXG5cdFx0XHRzZXREZWZhdWx0QmFja2VuZDogZnVuY3Rpb24oYmFja2VuZCkge1xuXHRcdFx0XHRyZXR1cm4gbWFrZVByb21pc2UoQ2xvdWRTdG9yYWdlLnNldERlZmF1bHRCYWNrZW5kLCBbYmFja2VuZF0pO1xuXHRcdFx0fSxcblx0XHRcdHJlYWRGaWxlOiBmdW5jdGlvbihmaWxlbmFtZSwgYmFja2VuZCkge1xuXHRcdFx0XHRyZXR1cm4gbWFrZVByb21pc2UoQ2xvdWRTdG9yYWdlLnJlYWRGaWxlLCBbZmlsZW5hbWUsIGJhY2tlbmRdLCBmYWxzZSwgdHJ1ZSk7XG5cdFx0XHR9LFxuXHRcdFx0d3JpdGVGaWxlOiBmdW5jdGlvbihmaWxlbmFtZSwgZGF0YSwgYmFja2VuZCkge1xuXHRcdFx0XHRyZXR1cm4gbWFrZVByb21pc2UoQ2xvdWRTdG9yYWdlLndyaXRlRmlsZSwgW2ZpbGVuYW1lLCBkYXRhLCBiYWNrZW5kXSwgZmFsc2UsIHRydWUpO1xuXHRcdFx0fSxcblx0XHRcdHJlbW92ZUZpbGU6IGZ1bmN0aW9uKGZpbGVuYW1lLCBiYWNrZW5kKSB7XG5cdFx0XHRcdHJldHVybiBtYWtlUHJvbWlzZShDbG91ZFN0b3JhZ2UucmVtb3ZlRmlsZSwgW2ZpbGVuYW1lLCBiYWNrZW5kXSwgZmFsc2UsIHRydWUpO1xuXHRcdFx0fSxcblx0XHRcdGxpc3RGaWxlczogZnVuY3Rpb24ocGF0aCwgYmFja2VuZCkge1xuXHRcdFx0XHRyZXR1cm4gbWFrZVByb21pc2UoQ2xvdWRTdG9yYWdlLmxpc3RGaWxlcywgW3BhdGgsIGJhY2tlbmRdLCBmYWxzZSwgdHJ1ZSk7XG5cdFx0XHR9LFxuXHRcdFx0d2lwZURhdGE6IGZ1bmN0aW9uKGJhY2tlbmQpIHtcblx0XHRcdFx0cmV0dXJuIG1ha2VQcm9taXNlKENsb3VkU3RvcmFnZS53aXBlRGF0YSwgW2JhY2tlbmRdLCBmYWxzZSwgdHJ1ZSk7XG5cdFx0XHR9LFxuXHRcdH07XG5cdH0pO1xufSBlbHNlIHtcblx0Y29uc29sZS5sb2coJ0Nsb3VkU3RvcmFnZTogQW5ndWxhciBpcyBub3QgYXZhaWxhYmxlLiAgU2tpcHBpbmcgQW5ndWxhciBzdXBwb3J0LicpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IENsb3VkU3RvcmFnZTtcblxuaWYgKCF3aW5kb3cucGx1Z2lucykge1xuXHR3aW5kb3cucGx1Z2lucyA9IHt9O1xufVxuaWYgKCF3aW5kb3cucGx1Z2lucy5DbG91ZFN0b3JhZ2UpIHtcblx0d2luZG93LnBsdWdpbnMuQ2xvdWRTdG9yYWdlID0gQ2xvdWRTdG9yYWdlO1xufVxuIiwiLyoganNoaW50IC1XMDk3ICovXG5cbid1c2Ugc3RyaWN0JztcblxuLyogZ2xvYmFsIGNvbnNvbGUgKi9cbi8qIGdsb2JhbCByZXF1aXJlICovXG4vKiBnbG9iYWwgd2luZG93ICovXG5cbnZhciBLZXljaGFpbiA9IHJlcXVpcmUoJ2NvbS5zaGF6cm9uLmNvcmRvdmEucGx1Z2luLmtleWNoYWludXRpbC5LZXljaGFpbicpO1xuXG5pZiAodHlwZW9mIFN0cmluZy5wcm90b3R5cGUuc3RhcnRzV2l0aCAhPT0gJ2Z1bmN0aW9uJykge1xuXHRTdHJpbmcucHJvdG90eXBlLnN0YXJ0c1dpdGggPSBmdW5jdGlvbihzdHIpIHtcblx0XHRyZXR1cm4gdGhpcy5sYXN0SW5kZXhPZihzdHIsIDApID09PSAwO1xuXHR9O1xufVxuaWYgKHR5cGVvZiBTdHJpbmcucHJvdG90eXBlLmVuZHNXaXRoICE9PSAnZnVuY3Rpb24nKSB7XG5cdFN0cmluZy5wcm90b3R5cGUuZW5kc1dpdGggPSBmdW5jdGlvbihzdWZmaXgpIHtcblx0XHRyZXR1cm4gdGhpcy5pbmRleE9mKHN1ZmZpeCwgdGhpcy5sZW5ndGggLSBzdWZmaXgubGVuZ3RoKSAhPT0gLTE7XG5cdH07XG59XG5cbmZ1bmN0aW9uIEtleWNoYWluQmFja2VuZCgpIHtcblx0dmFyIGtjID0gbmV3IEtleWNoYWluKCk7XG5cdHZhciBzZXJ2aWNlTmFtZSA9ICdDb3Jkb3ZhQ2xvdWRTdG9yYWdlJztcblxuXHR2YXIgZW5jb2RlS2V5ID0gZnVuY3Rpb24oc3RyKSB7XG5cdFx0cmV0dXJuIHdpbmRvdy5idG9hKHN0cik7XG5cdFx0Lypcblx0XHRyZXR1cm4gc3RyXG5cdFx0XHQucmVwbGFjZSgvW1xcXFxdL2csICdcXFxcXFxcXCcpXG5cdFx0XHQucmVwbGFjZSgvW1xcXCJdL2csICdcXFxcXFxcIicpXG5cdFx0XHQucmVwbGFjZSgvW1xcL10vZywgJ1xcXFwvJylcblx0XHRcdC5yZXBsYWNlKC9bXFxiXS9nLCAnXFxcXGInKVxuXHRcdFx0LnJlcGxhY2UoL1tcXGZdL2csICdcXFxcZicpXG5cdFx0XHQucmVwbGFjZSgvW1xcbl0vZywgJ1xcXFxuJylcblx0XHRcdC5yZXBsYWNlKC9bXFxyXS9nLCAnXFxcXHInKVxuXHRcdFx0LnJlcGxhY2UoL1tcXHRdL2csICdcXFxcdCcpO1xuXHRcdCovXG4gIFx0fTtcblxuXHR2YXIgZW5jb2RlID0gZnVuY3Rpb24oc3RyKSB7XG5cdFx0cmV0dXJuIEpTT04uc3RyaW5naWZ5KHN0cik7XG5cdH07XG5cblx0dmFyIGRlY29kZSA9IGZ1bmN0aW9uKHN0cikge1xuXHRcdHJldHVybiBKU09OLnBhcnNlKHN0cik7XG5cdH07XG5cblx0dmFyIGNhbGxTdWNjZXNzID0gZnVuY3Rpb24oY2IsIGRhdGEpIHtcblx0XHR2YXIgcmV0ID0geyBzdWNjZXNzOiB0cnVlIH07XG5cdFx0aWYgKGRhdGEpIHtcblx0XHRcdHJldC5jb250ZW50cyA9IGRhdGE7XG5cdFx0fVxuXHRcdGNiKHJldCk7XG5cdH07XG5cdHZhciBjYWxsRXJyb3IgPSBmdW5jdGlvbihjYiwgZXJyKSB7XG5cdFx0dmFyIHJldCA9IHsgc3VjY2VzczogZmFsc2UgfTtcblx0XHRpZiAoZXJyKSB7XG5cdFx0XHRyZXQuZXJyb3IgPSBlcnI7XG5cdFx0fVxuXHRcdGNiKHJldCk7XG5cdH07XG5cblx0dmFyIGNsZWFySW5kZXggPSBmdW5jdGlvbihjYikge1xuXHRcdGtjLnJlbW92ZUZvcktleShmdW5jdGlvbiBzdWNjZXNzKHJlc3VsdCkge1xuXHRcdFx0Y2IodHJ1ZSk7XG5cdFx0fSwgZnVuY3Rpb24gZmFpbHVyZShlcnIpIHtcblx0XHRcdGlmIChlcnIuaW5kZXhPZignLTI1MzAwJykgPj0gMCkge1xuXHRcdFx0XHQvLyBub3QgZm91bmQgZXJyb3IsIGNvbnNpZGVyIGl0IGNsZWFyZWRcblx0XHRcdFx0Y2IodHJ1ZSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb25zb2xlLmxvZygnS2V5Y2hhaW5CYWNrZW5kLmNsZWFySW5kZXg6IFdBUk5JTkc6IGZhaWxlZDogJyArIEpTT04uc3RyaW5naWZ5KGVycikpO1xuXHRcdFx0XHRjYihmYWxzZSk7XG5cdFx0XHR9XG5cdFx0fSwgJ19pbmRleCcsIHNlcnZpY2VOYW1lKTtcblx0fTtcblx0dmFyIGdldEluZGV4ID0gZnVuY3Rpb24ocywgZikge1xuXHRcdGtjLmdldEZvcktleShmdW5jdGlvbiBzdWNjZXNzKHJlc3VsdCkge1xuXHRcdFx0cyhkZWNvZGUocmVzdWx0KSk7XG5cdFx0fSwgZnVuY3Rpb24gZmFpbHVyZShlcnIpIHtcblx0XHRcdGNvbnNvbGUubG9nKCdLZXljaGFpbkJhY2tlbmQuZ2V0SW5kZXg6IFdBUk5JTkc6IGZhaWxlZDogJyArIEpTT04uc3RyaW5naWZ5KGVycikpO1xuXHRcdFx0ZihlcnIpO1xuXHRcdH0sICdfaW5kZXgnLCBzZXJ2aWNlTmFtZSk7XG5cdH07XG5cdHZhciB1cGRhdGVJbmRleCA9IGZ1bmN0aW9uKGluZGV4LCBzLCBmKSB7XG5cdFx0a2Muc2V0Rm9yS2V5KGZ1bmN0aW9uIHN1Y2Nlc3MoKSB7XG5cdFx0XHQvL2NvbnNvbGUubG9nKCdLZXljaGFpbkJhY2tlbmQudXBkYXRlSW5kZXg6ICcgKyBKU09OLnN0cmluZ2lmeShpbmRleCkpO1xuXHRcdFx0cyh0cnVlKTtcblx0XHR9LCBmdW5jdGlvbiBmYWlsdXJlKGVycikge1xuXHRcdFx0Y29uc29sZS5sb2coJ0tleWNoYWluQmFja2VuZC51cGRhdGVJbmRleDogV0FSTklORzogZmFpbGVkOiAnICsgSlNPTi5zdHJpbmdpZnkoZXJyKSk7XG5cdFx0XHRmKGVycik7XG5cdFx0fSwgJ19pbmRleCcsIHNlcnZpY2VOYW1lLCBlbmNvZGUoaW5kZXgpKTtcblx0fTtcblxuXHR0aGlzLmlzVmFsaWQgPSBmdW5jdGlvbigpIHtcblx0XHRpZiAoa2MgJiYga2MuZ2V0Rm9yS2V5KSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0fTtcblxuXHR0aGlzLnJlYWRGaWxlID0gZnVuY3Rpb24oZmlsZW5hbWUsIHMsIGYpIHtcblx0XHRrYy5nZXRGb3JLZXkoZnVuY3Rpb24gc3VjY2VzcyhyZXN1bHQpIHtcblx0XHRcdC8vY29uc29sZS5sb2coJ0tleWNoYWluQmFja2VuZC5yZWFkRmlsZTogcmVhZCAnICsgZmlsZW5hbWUgKyAnOiAnICsgcmVzdWx0KTtcblx0XHRcdGNhbGxTdWNjZXNzKHMsIGRlY29kZShyZXN1bHQpKTtcblx0XHR9LCBmdW5jdGlvbiBmYWlsdXJlKGVycikge1xuXHRcdFx0Y29uc29sZS5sb2coJ0tleWNoYWluQmFja2VuZC5yZWFkRmlsZTogJyArIGZpbGVuYW1lICsgJyBmYWlsdXJlOiAnICsgSlNPTi5zdHJpbmdpZnkoZXJyKSk7XG5cdFx0XHRjYWxsRXJyb3IoZiwgZXJyKTtcblx0XHR9LCBlbmNvZGVLZXkoZmlsZW5hbWUpLCBzZXJ2aWNlTmFtZSk7XG5cdH07XG5cblx0dGhpcy53cml0ZUZpbGUgPSBmdW5jdGlvbihmaWxlbmFtZSwgZGF0YSwgcywgZikge1xuXHRcdGRhdGEgPSBlbmNvZGUoZGF0YSk7XG5cblx0XHRrYy5zZXRGb3JLZXkoZnVuY3Rpb24gc3VjY2VzcygpIHtcblx0XHRcdC8vY29uc29sZS5sb2coJ0tleWNoYWluQmFja2VuZC53cml0ZUZpbGU6IHdyb3RlICcgKyBmaWxlbmFtZSk7XG5cdFx0XHRnZXRJbmRleChmdW5jdGlvbiBzdWNjZXNzKGluZGV4KSB7XG5cdFx0XHRcdGlmIChpbmRleC5pbmRleE9mKGZpbGVuYW1lKSA9PT0gLTEpIHtcblx0XHRcdFx0XHRpbmRleC5wdXNoKGZpbGVuYW1lKTtcblx0XHRcdFx0XHRpbmRleC5zb3J0KCk7XG5cdFx0XHRcdFx0dXBkYXRlSW5kZXgoaW5kZXgsIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdFx0Y2FsbFN1Y2Nlc3MocywgZGF0YSk7XG5cdFx0XHRcdFx0fSwgZnVuY3Rpb24oZXJyKSB7XG5cdFx0XHRcdFx0XHRjYWxsRXJyb3IoZiwgZXJyKTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRjYWxsU3VjY2VzcyhzLCB0cnVlKTtcblx0XHRcdFx0fVxuXHRcdFx0fSwgZnVuY3Rpb24gZmFpbHVyZShlcnIpIHtcblx0XHRcdFx0dXBkYXRlSW5kZXgoW2ZpbGVuYW1lXSwgZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0Y2FsbFN1Y2Nlc3MocywgZGF0YSk7XG5cdFx0XHRcdH0sIGZ1bmN0aW9uKGVycikge1xuXHRcdFx0XHRcdGNhbGxFcnJvcihmLCBlcnIpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdH0sIGZ1bmN0aW9uIGZhaWx1cmUoZXJyKSB7XG5cdFx0XHRjb25zb2xlLmxvZygnS2V5Y2hhaW5CYWNrZW5kLndyaXRlRmlsZTogJyArIGZpbGVuYW1lICsgJyBmYWlsdXJlOiAnICsgZXJyKTtcblx0XHRcdGNhbGxFcnJvcihmLCBlcnIpO1xuXHRcdH0sIGVuY29kZUtleShmaWxlbmFtZSksIHNlcnZpY2VOYW1lLCBkYXRhKTtcblx0fTtcblxuXHR0aGlzLnJlbW92ZUZpbGUgPSBmdW5jdGlvbihmaWxlbmFtZSwgcywgZikge1xuXHRcdHZhciBkb1JlbW92ZSA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0a2MucmVtb3ZlRm9yS2V5KGZ1bmN0aW9uIHN1Y2Nlc3MoKSB7XG5cdFx0XHRcdC8vY29uc29sZS5sb2coJ0tleWNoYWluQmFja2VuZC5yZW1vdmVGaWxlOiByZW1vdmVkICcgKyBmaWxlbmFtZSk7XG5cdFx0XHRcdGNhbGxTdWNjZXNzKHMsIHRydWUpO1xuXHRcdFx0fSwgZnVuY3Rpb24gZmFpbHVyZShlcnIpIHtcblx0XHRcdFx0Y29uc29sZS5sb2coJ0tleWNoYWluQmFja2VuZC5yZW1vdmVGaWxlOiAnICsgZmlsZW5hbWUgKyAnIGZhaWx1cmU6ICcgKyBlcnIpO1xuXHRcdFx0XHRjYWxsRXJyb3IoZiwgZXJyKTtcblx0XHRcdH0sIGVuY29kZUtleShmaWxlbmFtZSksIHNlcnZpY2VOYW1lKTtcblx0XHR9O1xuXG5cdFx0Z2V0SW5kZXgoZnVuY3Rpb24gc3VjY2VzcyhpbmRleCkge1xuXHRcdFx0dmFyIGxvYyA9IGluZGV4LmluZGV4T2YoZmlsZW5hbWUpO1xuXHRcdFx0aWYgKGxvYyAhPT0gLTEpIHtcblx0XHRcdFx0aW5kZXguc3BsaWNlKGxvYywgMSk7XG5cdFx0XHRcdHVwZGF0ZUluZGV4KGluZGV4LCBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRkb1JlbW92ZSgpO1xuXHRcdFx0XHR9LCBmdW5jdGlvbihlcnIpIHtcblx0XHRcdFx0XHRjYWxsRXJyb3IoZiwgZXJyKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRkb1JlbW92ZSgpO1xuXHRcdFx0fVxuXHRcdH0sIGZ1bmN0aW9uIGZhaWx1cmUoZXJyKSB7XG5cdFx0XHRjYWxsRXJyb3IoZiwgZXJyKTtcblx0XHR9KTtcblx0fTtcblxuXHR0aGlzLmxpc3RGaWxlcyA9IGZ1bmN0aW9uKHBhdGgsIHMsIGYpIHtcblx0XHRnZXRJbmRleChmdW5jdGlvbiBzdWNjZXNzKGluZGV4KSB7XG5cdFx0XHR2YXIgaSwgbGVuID0gaW5kZXgubGVuZ3RoLCBlbnRyeSwgcmV0ID0gW10sIHByZWZpeCA9IHBhdGg7XG5cdFx0XHRpZiAoIXByZWZpeC5lbmRzV2l0aCgnLycpKSB7XG5cdFx0XHRcdHByZWZpeCA9IHByZWZpeCArICcvJztcblx0XHRcdH1cblxuXHRcdFx0dmFyIHJlcGxhY2UgPSBuZXcgUmVnRXhwKCdeJyArIHByZWZpeC5yZXBsYWNlKC9bLiorP14ke30oKXxbXFxdXFxcXF0vZywgXCJcXFxcJCZcIikpO1xuXHRcdFx0Zm9yIChpPTA7IGkgPCBsZW47IGkrKykge1xuXHRcdFx0XHRlbnRyeSA9IGluZGV4W2ldO1xuXHRcdFx0XHRpZiAocGF0aCA9PT0gJycgJiYgIWVudHJ5LnN0YXJ0c1dpdGgoJy8nKSkge1xuXHRcdFx0XHRcdHJldC5wdXNoKGVudHJ5KTtcblx0XHRcdFx0fSBlbHNlIGlmIChlbnRyeS5zdGFydHNXaXRoKHByZWZpeCkpIHtcblx0XHRcdFx0XHRyZXQucHVzaChlbnRyeS5yZXBsYWNlKHJlcGxhY2UsICcnKSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Ly9jb25zb2xlLmxvZygnS2V5Y2hhaW5CYWNrZW5kLmxpc3RGaWxlczogbGlzdEZpbGVzKCcrcGF0aCsnKTogYmVmb3JlID0gJyArIEpTT04uc3RyaW5naWZ5KGluZGV4LCB0cnVlKSk7XG5cdFx0XHQvL2NvbnNvbGUubG9nKCdLZXljaGFpbkJhY2tlbmQubGlzdEZpbGVzOiBsaXN0RmlsZXMoJytwYXRoKycpOiBhZnRlciAgPSAnICsgSlNPTi5zdHJpbmdpZnkocmV0LCB0cnVlKSk7XG5cdFx0XHRjYWxsU3VjY2VzcyhzLCByZXQpO1xuXHRcdH0sIGZ1bmN0aW9uIGZhaWx1cmUoZXJyKSB7XG5cdFx0XHRjYWxsRXJyb3IoZiwgZXJyKTtcblx0XHR9KTtcblx0fTtcblxuXHR0aGlzLndpcGVEYXRhID0gZnVuY3Rpb24ocywgZikge1xuXHRcdHZhciBjbGVhciA9IGZ1bmN0aW9uKGluZGV4KSB7XG5cdFx0XHR2YXIgaSwgbGVuLCBlbnRyeTtcblxuXHRcdFx0dmFyIHBlbmRpbmdUcmFuc2FjdGlvbnMgPSB7fTtcblxuXHRcdFx0dmFyIHJlbW92ZUl0ZW0gPSBmdW5jdGlvbihpdGVtKSB7XG5cdFx0XHRcdC8vY29uc29sZS5sb2coJ0tleWNoYWluQmFja2VuZC53aXBlRGF0YTogcmVtb3ZpbmcgJyArIGl0ZW0pO1xuXHRcdFx0XHRwZW5kaW5nVHJhbnNhY3Rpb25zW2l0ZW1dID0gdW5kZWZpbmVkO1xuXHRcdFx0XHRrYy5yZW1vdmVGb3JLZXkoZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0cGVuZGluZ1RyYW5zYWN0aW9uc1tpdGVtXSA9IHRydWU7XG5cdFx0XHRcdH0sIGZ1bmN0aW9uIGVycihlKSB7XG5cdFx0XHRcdFx0Y29uc29sZS5sb2coJ0tleWNoYWluQmFja2VuZC53aXBlRGF0YTogV0FSTklORzogdW5hYmxlIHRvIHJlbW92ZSAnICsgaXRlbSArICc6ICcgKyBlKTtcblx0XHRcdFx0XHRwZW5kaW5nVHJhbnNhY3Rpb25zW2l0ZW1dID0gZmFsc2U7XG5cdFx0XHRcdH0sIGVuY29kZUtleShpdGVtKSwgc2VydmljZU5hbWUpO1xuXHRcdFx0fTtcblxuXHRcdFx0dmFyIHRpbWVvdXRJRDtcblx0XHRcdHZhciB3YWl0Rm9yQ29tcGxldGlvbiA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgZmluaXNoZWQgPSB0cnVlLFxuXHRcdFx0XHRcdGZhaWxlZCA9IFtdLFxuXHRcdFx0XHRcdGtleXMgPSBPYmplY3Qua2V5cyhwZW5kaW5nVHJhbnNhY3Rpb25zKSxcblx0XHRcdFx0XHRpLCBsZW4gPSBrZXlzLmxlbmd0aCwgZmlsZW5hbWU7XG5cblx0XHRcdFx0Zm9yIChpPTA7IGkgPCBsZW47IGkrKykge1xuXHRcdFx0XHRcdGZpbGVuYW1lID0ga2V5c1tpXTtcblx0XHRcdFx0XHRpZiAocGVuZGluZ1RyYW5zYWN0aW9uc1tmaWxlbmFtZV0gPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdFx0ZmluaXNoZWQgPSBmYWxzZTtcblxuXHRcdFx0XHRcdH0gZWxzZSBpZiAoIXBlbmRpbmdUcmFuc2FjdGlvbnNbZmlsZW5hbWVdKSB7XG5cdFx0XHRcdFx0XHRmYWlsZWQucHVzaChmaWxlbmFtZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKHRpbWVvdXRJRCkge1xuXHRcdFx0XHRcdHdpbmRvdy5jbGVhclRpbWVvdXQodGltZW91dElEKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoZmluaXNoZWQpIHtcblx0XHRcdFx0XHRpZiAoZmFpbGVkLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0XHRcdGNhbGxFcnJvcihmLCAnRmFpbGVkIHRvIHJlbW92ZSBmaWxlczogJyArIGZhaWxlZC5qb2luKCcsICcpKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0Y2FsbFN1Y2Nlc3Mocyk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHdpbmRvdy5zZXRUaW1lb3V0KHdhaXRGb3JDb21wbGV0aW9uLCAxMDApO1xuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXG5cdFx0XHRjbGVhckluZGV4KGZ1bmN0aW9uIGNsZWFyQ2FsbGJhY2soc3VjY2Vzcykge1xuXHRcdFx0XHQvL2NvbnNvbGUubG9nKCdLZXljaGFpbkJhY2tlbmQud2lwZURhdGE6IGNsZWFySW5kZXg6ICcgKyBzdWNjZXNzKTtcblx0XHRcdFx0aWYgKHN1Y2Nlc3MpIHtcblx0XHRcdFx0XHRpZiAoaW5kZXgpIHtcblx0XHRcdFx0XHRcdGxlbiA9IGluZGV4Lmxlbmd0aDtcblx0XHRcdFx0XHRcdGZvciAoaT0wOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdFx0XHRcdFx0ZW50cnkgPSBpbmRleFtpXTtcblx0XHRcdFx0XHRcdFx0cmVtb3ZlSXRlbShlbnRyeSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHdhaXRGb3JDb21wbGV0aW9uKCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Y2FsbEVycm9yKGYpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9O1xuXG5cdFx0Z2V0SW5kZXgoZnVuY3Rpb24gc3VjY2VzcyhpbmRleCkge1xuXHRcdFx0Ly9jb25zb2xlLmxvZygnS2V5Y2hhaW5CYWNrZW5kLndpcGVEYXRhOiAnICsgSlNPTi5zdHJpbmdpZnkoaW5kZXgpKTtcblx0XHRcdGNsZWFyKGluZGV4KTtcblx0XHR9LCBmdW5jdGlvbiBmYWlsdXJlKGVycikge1xuXHRcdFx0Y29uc29sZS5sb2coJ0tleWNoYWluQmFja2VuZC53aXBlRGF0YTogV0FSTklORzogJyArIGVycik7XG5cdFx0XHRjbGVhcigpO1xuXHRcdH0pO1xuXHR9O1xufVxuXG5LZXljaGFpbkJhY2tlbmQucHJvdG90eXBlLm5hbWUgPSAna2V5Y2hhaW4nO1xuIiwiLyoganNoaW50IC1XMDk3ICovXG5cbid1c2Ugc3RyaWN0JztcblxuLyogZ2xvYmFsIHJlcXVpcmUgKi9cblxudmFyIGV4ZWMgPSByZXF1aXJlKCdjb3Jkb3ZhL2V4ZWMnKTtcblxuZnVuY3Rpb24gTG9jYWxCYWNrZW5kKCkge31cbkxvY2FsQmFja2VuZC5wcm90b3R5cGUubmFtZSA9ICdsb2NhbCc7XG5Mb2NhbEJhY2tlbmQucHJvdG90eXBlLmlzVmFsaWQgPSBmdW5jdGlvbigpIHtcblx0cmV0dXJuIHRydWU7XG59O1xuTG9jYWxCYWNrZW5kLnByb3RvdHlwZS5yZWFkRmlsZSA9IGZ1bmN0aW9uKGZpbGVuYW1lLCBzdWNjZXNzLCBmYWlsdXJlKSB7XG5cdGV4ZWMoc3VjY2VzcywgZmFpbHVyZSwgJ0Nsb3VkU3RvcmFnZScsICdvbm1zR2V0SnNvbkZpbGVDb250ZW50cycsIFtmaWxlbmFtZV0pO1xufTtcbkxvY2FsQmFja2VuZC5wcm90b3R5cGUud3JpdGVGaWxlID0gZnVuY3Rpb24oZmlsZW5hbWUsIGRhdGEsIHN1Y2Nlc3MsIGZhaWx1cmUpIHtcblx0ZXhlYyhzdWNjZXNzLCBmYWlsdXJlLCAnQ2xvdWRTdG9yYWdlJywgJ29ubXNTZXRKc29uRmlsZUNvbnRlbnRzJywgW2ZpbGVuYW1lLCBkYXRhXSk7XG59O1xuTG9jYWxCYWNrZW5kLnByb3RvdHlwZS5yZW1vdmVGaWxlID0gZnVuY3Rpb24oZmlsZW5hbWUsIHN1Y2Nlc3MsIGZhaWx1cmUpIHtcblx0ZXhlYyhzdWNjZXNzLCBmYWlsdXJlLCAnQ2xvdWRTdG9yYWdlJywgJ29ubXNSZW1vdmVKc29uRmlsZScsIFtmaWxlbmFtZV0pO1xufTtcbkxvY2FsQmFja2VuZC5wcm90b3R5cGUubGlzdEZpbGVzID0gZnVuY3Rpb24ocGF0aCwgc3VjY2VzcywgZmFpbHVyZSkge1xuXHRleGVjKHN1Y2Nlc3MsIGZhaWx1cmUsICdDbG91ZFN0b3JhZ2UnLCAnb25tc0xpc3RKc29uRmlsZXMnLCBbcGF0aF0pO1xufTtcbkxvY2FsQmFja2VuZC5wcm90b3R5cGUud2lwZURhdGEgPSBmdW5jdGlvbihzdWNjZXNzLCBmYWlsdXJlKSB7XG5cdGV4ZWMoc3VjY2VzcywgZmFpbHVyZSwgJ0Nsb3VkU3RvcmFnZScsICdvbm1zV2lwZScsIFtdKTtcbn07XG4iXSwic291cmNlUm9vdCI6Ii9zb3VyY2UvIn0=