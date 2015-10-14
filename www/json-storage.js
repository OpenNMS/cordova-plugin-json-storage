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
/* global MemoryBackend */

var debug = false;
var backends = {};
var defaultBackend;

var _initialized = false;
function assertInitialized() {
	if (_initialized) { return; }
	_initialized = true;

	console.log('JSONStorage: Initializing.');

	var attemptedBackends = [
		new KeychainBackend(),
		new LocalBackend(),
		new MemoryBackend()
	], i, len = attemptedBackends.length, be;

	if (debug) {
		console.log('JSONStorage: Attempting backends: ' + attemptedBackends.map(function(entry){return entry.name;}).join(', '));
	}
	for (i=0; i < len; i++) {
		be = attemptedBackends[i];
		if (be && be.name) {
			if (debug) {
				console.log('JSONStorage: Checking plugin "' + be.name + '".');
			}
			if (be.isValid && be.isValid()) {
				if (debug) {
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
			if (debug) { console.log('JSONStorage: setting backend to ' + b); }
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
		if (debug) { console.log('JSONStorage: ' + be.name + '.readFile(' + filename + ')'); }
		be.readFile(filename, success, failure);
	},
	writeFile: function(filename, data, success, failure, backend) {
		assertInitialized();
		var be = getBackend(backend);
		if (debug) { console.log('JSONStorage: ' + be.name + '.writeFile(' + filename + ', ...)'); }
		be.writeFile(filename, data, success, failure);
	},
	removeFile: function(filename, success, failure, backend) {
		assertInitialized();
		var be = getBackend(backend);
		if (debug) { console.log('JSONStorage: ' + be.name + '.removeFile(' + filename + ')'); }
		be.removeFile(filename, success, failure);
	},
	listFiles: function(path, success, failure, backend) {
		assertInitialized();
		var be = getBackend(backend);
		if (debug) { console.log('JSONStorage: ' + be.name + '.listFiles(' + path + ')'); }
		be.listFiles(path, success, failure);
	},
	wipeData: function(success, failure, backend) {
		assertInitialized();
		var be = getBackend(backend);
		if (debug) { console.log('JSONStorage: ' + be.name + '.wipeData()'); }
		be.wipeData(success, failure);
	},
};

if (typeof angular !== "undefined") {
	console.log('JSONStorage: Angular is available.  Registering Angular module.');
	angular.module('JSONStorage', []).factory('JSONStorage', function($timeout, $q) {
		function makePromise(fn, args, async, hasBackend) {
			var deferred = $q.defer();

			var success = function(response) {
				if (debug) { console.log('JSONStorage: success: ' + angular.toJson(response)); }
				if (async) {
					$timeout(function() {
						deferred.resolve(response);
					});
				} else {
					deferred.resolve(response);
				}
			};

			var fail = function(response) {
				if (debug) { console.log('JSONStorage: failure: ' + angular.toJson(response)); }
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

/* jshint -W097 */

'use strict';

/* global console */
/* global require */
/* global window */

var CordovaKeychain = require('cordova-plugin-keychain');

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
	var kc = new CordovaKeychain();
	var serviceName = 'CordovaJSONStorage';

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
	exec(success, failure, 'JSONStorage', 'onmsGetJsonFileContents', [filename]);
};
LocalBackend.prototype.writeFile = function(filename, data, success, failure) {
	exec(success, failure, 'JSONStorage', 'onmsSetJsonFileContents', [filename, data]);
};
LocalBackend.prototype.removeFile = function(filename, success, failure) {
	exec(success, failure, 'JSONStorage', 'onmsRemoveJsonFile', [filename]);
};
LocalBackend.prototype.listFiles = function(path, success, failure) {
	exec(success, failure, 'JSONStorage', 'onmsListJsonFiles', [path]);
};
LocalBackend.prototype.wipeData = function(success, failure) {
	exec(success, failure, 'JSONStorage', 'onmsWipe', []);
};

/* jshint -W097 */

'use strict';

/* global require */

var exec = require('cordova/exec');

function MemoryBackend() {
	this.data = {};
}
MemoryBackend.prototype.name = 'memory';
MemoryBackend.prototype.isValid = function() {
	return true;
};
MemoryBackend.prototype.readFile = function(filename, success, failure) {
	var self = this;
	if (self.data[filename] && self.data[filename] !== "\0") {
		success({
			success: true,
			contents: self.data[filename]
		});
	} else {
		failure({
			success: false,
			reason: 'File does not exist.',
			error: 'File "' + filename + '" does not exist.',
			contents: undefined
		});
	}
};
MemoryBackend.prototype.writeFile = function(filename, data, success, failure) {
	var self = this;
	self.data[filename] = data;
	success({
		success: true,
		contents: data
	});
};
MemoryBackend.prototype.removeFile = function(filename, success, failure) {
	var self = this,
		oldData;
	if (self.data[filename]) {
		oldData = self.data[filename];
		self.data[filename] = "\0";
	}
	success({
		success: true,
		contents: oldData
	});
};
MemoryBackend.prototype.listFiles = function(path, success, failure) {
	if (path && path.length > 0 && path.charAt(path.length-1) !== '/') {
		path += '/';
	}
	var self = this,
		file,
		found = false,
		files = Object.keys(self.data),
		ret = [];

	for (var i=0, len=files.length; i < len; i++) {
		file = files[i];
		if (file.indexOf(path) === 0) {
			found = true;
			if (self.data[file] !== "\0") {
				ret.push(file.substr(path.length));
			}
		}
	}

	if (!found) {
		failure({
			success: false,
			reason: 'Directory does not exist.',
			error: 'Directory "' + path + '" does not exist.'
		});
	} else {
		success({
			success: true,
			contents: ret
		});
	}
};
MemoryBackend.prototype.wipeData = function(success, failure) {
	var self = this;
	self.data = {};
	success({
		success: true,
		contents: undefined
	});
};

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImpzb24tc3RvcmFnZS5qcyIsImJhY2tlbmRzL2tleWNoYWluLmpzIiwiYmFja2VuZHMvbG9jYWwuanMiLCJiYWNrZW5kcy9tZW1vcnkuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDdk5BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUMvUUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQzVCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoianNvbi1zdG9yYWdlLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyoganNoaW50IC1XMDk3ICovXG5cbid1c2Ugc3RyaWN0JztcblxuLyogZ2xvYmFsIGFuZ3VsYXIgKi9cbi8qIGdsb2JhbCBjb25zb2xlICovXG4vKiBnbG9iYWwgZG9jdW1lbnQgKi9cbi8qIGdsb2JhbCBtb2R1bGUgKi9cbi8qIGdsb2JhbCByZXF1aXJlICovXG4vKiBnbG9iYWwgd2luZG93ICovXG5cbi8qIGdsb2JhbCBLZXljaGFpbkJhY2tlbmQgKi9cbi8qIGdsb2JhbCBMb2NhbEJhY2tlbmQgKi9cbi8qIGdsb2JhbCBNZW1vcnlCYWNrZW5kICovXG5cbnZhciBkZWJ1ZyA9IGZhbHNlO1xudmFyIGJhY2tlbmRzID0ge307XG52YXIgZGVmYXVsdEJhY2tlbmQ7XG5cbnZhciBfaW5pdGlhbGl6ZWQgPSBmYWxzZTtcbmZ1bmN0aW9uIGFzc2VydEluaXRpYWxpemVkKCkge1xuXHRpZiAoX2luaXRpYWxpemVkKSB7IHJldHVybjsgfVxuXHRfaW5pdGlhbGl6ZWQgPSB0cnVlO1xuXG5cdGNvbnNvbGUubG9nKCdKU09OU3RvcmFnZTogSW5pdGlhbGl6aW5nLicpO1xuXG5cdHZhciBhdHRlbXB0ZWRCYWNrZW5kcyA9IFtcblx0XHRuZXcgS2V5Y2hhaW5CYWNrZW5kKCksXG5cdFx0bmV3IExvY2FsQmFja2VuZCgpLFxuXHRcdG5ldyBNZW1vcnlCYWNrZW5kKClcblx0XSwgaSwgbGVuID0gYXR0ZW1wdGVkQmFja2VuZHMubGVuZ3RoLCBiZTtcblxuXHRpZiAoZGVidWcpIHtcblx0XHRjb25zb2xlLmxvZygnSlNPTlN0b3JhZ2U6IEF0dGVtcHRpbmcgYmFja2VuZHM6ICcgKyBhdHRlbXB0ZWRCYWNrZW5kcy5tYXAoZnVuY3Rpb24oZW50cnkpe3JldHVybiBlbnRyeS5uYW1lO30pLmpvaW4oJywgJykpO1xuXHR9XG5cdGZvciAoaT0wOyBpIDwgbGVuOyBpKyspIHtcblx0XHRiZSA9IGF0dGVtcHRlZEJhY2tlbmRzW2ldO1xuXHRcdGlmIChiZSAmJiBiZS5uYW1lKSB7XG5cdFx0XHRpZiAoZGVidWcpIHtcblx0XHRcdFx0Y29uc29sZS5sb2coJ0pTT05TdG9yYWdlOiBDaGVja2luZyBwbHVnaW4gXCInICsgYmUubmFtZSArICdcIi4nKTtcblx0XHRcdH1cblx0XHRcdGlmIChiZS5pc1ZhbGlkICYmIGJlLmlzVmFsaWQoKSkge1xuXHRcdFx0XHRpZiAoZGVidWcpIHtcblx0XHRcdFx0XHRjb25zb2xlLmxvZygnSlNPTlN0b3JhZ2U6IEJhY2tlbmQgXCInICsgYmUubmFtZSArICdcIiBpcyB2YWxpZC4nKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRiYWNrZW5kc1tiZS5uYW1lXSA9IGJlO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29uc29sZS5sb2coJ0pTT05TdG9yYWdlOiBCYWNrZW5kIFwiJyArIGJlLm5hbWUgKyAnXCIgaXMgbm90IHZhbGlkLicpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXHRjb25zb2xlLmxvZygnSlNPTlN0b3JhZ2U6IENvbmZpZ3VyZWQgYmFja2VuZHM6ICcgKyBPYmplY3Qua2V5cyhiYWNrZW5kcykpO1xuXG5cdGlmIChiYWNrZW5kcy5rZXljaGFpbikge1xuXHRcdGRlZmF1bHRCYWNrZW5kID0gJ2tleWNoYWluJztcblx0fSBlbHNlIHtcblx0XHRkZWZhdWx0QmFja2VuZCA9ICdsb2NhbCc7XG5cdH1cblx0cmV0dXJuIHRydWU7XG59XG5cbnZhciBnZXRCYWNrZW5kID0gZnVuY3Rpb24oYikge1xuXHRpZiAoYmFja2VuZHNbYl0pIHtcblx0XHRyZXR1cm4gYmFja2VuZHNbYl07XG5cdH0gZWxzZSBpZiAoYiAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0Y29uc29sZS5sb2coJ0pTT05TdG9yYWdlOiBVbmtub3duIGJhY2tlbmQgXCInICsgYiArICdcIjogZmFsbGluZyBiYWNrIHRvIGRlZmF1bHQgKFwiJyArIGRlZmF1bHRCYWNrZW5kICsgJ1wiKScpO1xuXHR9XG5cdHJldHVybiBiYWNrZW5kc1tkZWZhdWx0QmFja2VuZF07XG59O1xuXG52YXIgSlNPTlN0b3JhZ2UgPSB7XG5cdCdfJzoge1xuXHRcdGluaXQ6IGFzc2VydEluaXRpYWxpemVkLFxuXHRcdGdldEJhY2tlbmQ6IGZ1bmN0aW9uKGIpIHtcblx0XHRcdHJldHVybiBiYWNrZW5kc1tiXTtcblx0XHR9LFxuXHRcdGdldEJhY2tlbmRzOiBmdW5jdGlvbigpIHtcblx0XHRcdHJldHVybiBiYWNrZW5kcztcblx0XHR9XG5cdH0sXG5cdHNldERlYnVnOiBmdW5jdGlvbihkKSB7XG5cdFx0ZGVidWcgPSAhIWQ7XG5cdH0sXG5cdGdldERlZmF1bHRCYWNrZW5kOiBmdW5jdGlvbigpIHtcblx0XHRyZXR1cm4gZGVmYXVsdEJhY2tlbmQ7XG5cdH0sXG5cdHNldERlZmF1bHRCYWNrZW5kOiBmdW5jdGlvbihiLCBzdWNjZXNzLCBmYWlsdXJlKSB7XG5cdFx0YXNzZXJ0SW5pdGlhbGl6ZWQoKTtcblx0XHRpZiAoYmFja2VuZHNbYl0pIHtcblx0XHRcdGlmIChkZWJ1ZykgeyBjb25zb2xlLmxvZygnSlNPTlN0b3JhZ2U6IHNldHRpbmcgYmFja2VuZCB0byAnICsgYik7IH1cblx0XHRcdGRlZmF1bHRCYWNrZW5kID0gYjtcblx0XHRcdGlmIChzdWNjZXNzKSB7XG5cdFx0XHRcdHN1Y2Nlc3MoYik7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdHZhciBlcnJvciA9ICdVbmtub3duIGJhY2tlbmQgXCInICsgYiArICdcIic7XG5cdFx0XHRjb25zb2xlLmxvZygnSlNPTlN0b3JhZ2U6IFdBUk5JTkc6ICcgKyBlcnJvcik7XG5cdFx0XHRjb25zb2xlLmxvZygnSlNPTlN0b3JhZ2U6IGF2YWlsYWJsZSBiYWNrZW5kczogJyArIE9iamVjdC5rZXlzKGJhY2tlbmRzKS5qb2luKCcsICcpKTtcblx0XHRcdGlmIChmYWlsdXJlKSB7XG5cdFx0XHRcdGZhaWx1cmUoZXJyb3IpO1xuXHRcdFx0fVxuXHRcdH1cblx0fSxcblx0cmVhZEZpbGU6IGZ1bmN0aW9uKGZpbGVuYW1lLCBzdWNjZXNzLCBmYWlsdXJlLCBiYWNrZW5kKSB7XG5cdFx0YXNzZXJ0SW5pdGlhbGl6ZWQoKTtcblx0XHR2YXIgYmUgPSBnZXRCYWNrZW5kKGJhY2tlbmQpO1xuXHRcdGlmIChkZWJ1ZykgeyBjb25zb2xlLmxvZygnSlNPTlN0b3JhZ2U6ICcgKyBiZS5uYW1lICsgJy5yZWFkRmlsZSgnICsgZmlsZW5hbWUgKyAnKScpOyB9XG5cdFx0YmUucmVhZEZpbGUoZmlsZW5hbWUsIHN1Y2Nlc3MsIGZhaWx1cmUpO1xuXHR9LFxuXHR3cml0ZUZpbGU6IGZ1bmN0aW9uKGZpbGVuYW1lLCBkYXRhLCBzdWNjZXNzLCBmYWlsdXJlLCBiYWNrZW5kKSB7XG5cdFx0YXNzZXJ0SW5pdGlhbGl6ZWQoKTtcblx0XHR2YXIgYmUgPSBnZXRCYWNrZW5kKGJhY2tlbmQpO1xuXHRcdGlmIChkZWJ1ZykgeyBjb25zb2xlLmxvZygnSlNPTlN0b3JhZ2U6ICcgKyBiZS5uYW1lICsgJy53cml0ZUZpbGUoJyArIGZpbGVuYW1lICsgJywgLi4uKScpOyB9XG5cdFx0YmUud3JpdGVGaWxlKGZpbGVuYW1lLCBkYXRhLCBzdWNjZXNzLCBmYWlsdXJlKTtcblx0fSxcblx0cmVtb3ZlRmlsZTogZnVuY3Rpb24oZmlsZW5hbWUsIHN1Y2Nlc3MsIGZhaWx1cmUsIGJhY2tlbmQpIHtcblx0XHRhc3NlcnRJbml0aWFsaXplZCgpO1xuXHRcdHZhciBiZSA9IGdldEJhY2tlbmQoYmFja2VuZCk7XG5cdFx0aWYgKGRlYnVnKSB7IGNvbnNvbGUubG9nKCdKU09OU3RvcmFnZTogJyArIGJlLm5hbWUgKyAnLnJlbW92ZUZpbGUoJyArIGZpbGVuYW1lICsgJyknKTsgfVxuXHRcdGJlLnJlbW92ZUZpbGUoZmlsZW5hbWUsIHN1Y2Nlc3MsIGZhaWx1cmUpO1xuXHR9LFxuXHRsaXN0RmlsZXM6IGZ1bmN0aW9uKHBhdGgsIHN1Y2Nlc3MsIGZhaWx1cmUsIGJhY2tlbmQpIHtcblx0XHRhc3NlcnRJbml0aWFsaXplZCgpO1xuXHRcdHZhciBiZSA9IGdldEJhY2tlbmQoYmFja2VuZCk7XG5cdFx0aWYgKGRlYnVnKSB7IGNvbnNvbGUubG9nKCdKU09OU3RvcmFnZTogJyArIGJlLm5hbWUgKyAnLmxpc3RGaWxlcygnICsgcGF0aCArICcpJyk7IH1cblx0XHRiZS5saXN0RmlsZXMocGF0aCwgc3VjY2VzcywgZmFpbHVyZSk7XG5cdH0sXG5cdHdpcGVEYXRhOiBmdW5jdGlvbihzdWNjZXNzLCBmYWlsdXJlLCBiYWNrZW5kKSB7XG5cdFx0YXNzZXJ0SW5pdGlhbGl6ZWQoKTtcblx0XHR2YXIgYmUgPSBnZXRCYWNrZW5kKGJhY2tlbmQpO1xuXHRcdGlmIChkZWJ1ZykgeyBjb25zb2xlLmxvZygnSlNPTlN0b3JhZ2U6ICcgKyBiZS5uYW1lICsgJy53aXBlRGF0YSgpJyk7IH1cblx0XHRiZS53aXBlRGF0YShzdWNjZXNzLCBmYWlsdXJlKTtcblx0fSxcbn07XG5cbmlmICh0eXBlb2YgYW5ndWxhciAhPT0gXCJ1bmRlZmluZWRcIikge1xuXHRjb25zb2xlLmxvZygnSlNPTlN0b3JhZ2U6IEFuZ3VsYXIgaXMgYXZhaWxhYmxlLiAgUmVnaXN0ZXJpbmcgQW5ndWxhciBtb2R1bGUuJyk7XG5cdGFuZ3VsYXIubW9kdWxlKCdKU09OU3RvcmFnZScsIFtdKS5mYWN0b3J5KCdKU09OU3RvcmFnZScsIGZ1bmN0aW9uKCR0aW1lb3V0LCAkcSkge1xuXHRcdGZ1bmN0aW9uIG1ha2VQcm9taXNlKGZuLCBhcmdzLCBhc3luYywgaGFzQmFja2VuZCkge1xuXHRcdFx0dmFyIGRlZmVycmVkID0gJHEuZGVmZXIoKTtcblxuXHRcdFx0dmFyIHN1Y2Nlc3MgPSBmdW5jdGlvbihyZXNwb25zZSkge1xuXHRcdFx0XHRpZiAoZGVidWcpIHsgY29uc29sZS5sb2coJ0pTT05TdG9yYWdlOiBzdWNjZXNzOiAnICsgYW5ndWxhci50b0pzb24ocmVzcG9uc2UpKTsgfVxuXHRcdFx0XHRpZiAoYXN5bmMpIHtcblx0XHRcdFx0XHQkdGltZW91dChmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRcdGRlZmVycmVkLnJlc29sdmUocmVzcG9uc2UpO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGRlZmVycmVkLnJlc29sdmUocmVzcG9uc2UpO1xuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXG5cdFx0XHR2YXIgZmFpbCA9IGZ1bmN0aW9uKHJlc3BvbnNlKSB7XG5cdFx0XHRcdGlmIChkZWJ1ZykgeyBjb25zb2xlLmxvZygnSlNPTlN0b3JhZ2U6IGZhaWx1cmU6ICcgKyBhbmd1bGFyLnRvSnNvbihyZXNwb25zZSkpOyB9XG5cdFx0XHRcdGlmIChhc3luYykge1xuXHRcdFx0XHRcdCR0aW1lb3V0KGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdFx0ZGVmZXJyZWQucmVqZWN0KHJlc3BvbnNlKTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRkZWZlcnJlZC5yZWplY3QocmVzcG9uc2UpO1xuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXG5cdFx0XHR2YXIgYmFja2VuZDtcblx0XHRcdGlmIChoYXNCYWNrZW5kKSB7XG5cdFx0XHRcdC8vIHB1bGwgdGhlIChvcHRpb25hbCkgYmFja2VuZCBvZmYgdGhlIGFyZyBsaXN0LCBzaW5jZSBpdCdzIGFsd2F5cyBsYXN0XG5cdFx0XHRcdGJhY2tlbmQgPSBhcmdzLnBvcCgpO1xuXHRcdFx0fVxuXHRcdFx0YXJncy5wdXNoKHN1Y2Nlc3MpO1xuXHRcdFx0YXJncy5wdXNoKGZhaWwpO1xuXHRcdFx0aWYgKGhhc0JhY2tlbmQpIHtcblx0XHRcdFx0YXJncy5wdXNoKGJhY2tlbmQpO1xuXHRcdFx0fVxuXG5cdFx0XHRmbi5hcHBseShKU09OU3RvcmFnZSwgYXJncyk7XG5cblx0XHRcdHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xuXHRcdH1cblxuXHRcdHJldHVybiB7XG5cdFx0XHRzZXREZWJ1ZzogZnVuY3Rpb24oZGVidWcpIHtcblx0XHRcdFx0cmV0dXJuIEpTT05TdG9yYWdlLnNldERlYnVnKGRlYnVnKTtcblx0XHRcdH0sXG5cdFx0XHRzZXREZWZhdWx0QmFja2VuZDogZnVuY3Rpb24oYmFja2VuZCkge1xuXHRcdFx0XHRyZXR1cm4gbWFrZVByb21pc2UoSlNPTlN0b3JhZ2Uuc2V0RGVmYXVsdEJhY2tlbmQsIFtiYWNrZW5kXSk7XG5cdFx0XHR9LFxuXHRcdFx0cmVhZEZpbGU6IGZ1bmN0aW9uKGZpbGVuYW1lLCBiYWNrZW5kKSB7XG5cdFx0XHRcdHJldHVybiBtYWtlUHJvbWlzZShKU09OU3RvcmFnZS5yZWFkRmlsZSwgW2ZpbGVuYW1lLCBiYWNrZW5kXSwgZmFsc2UsIHRydWUpO1xuXHRcdFx0fSxcblx0XHRcdHdyaXRlRmlsZTogZnVuY3Rpb24oZmlsZW5hbWUsIGRhdGEsIGJhY2tlbmQpIHtcblx0XHRcdFx0cmV0dXJuIG1ha2VQcm9taXNlKEpTT05TdG9yYWdlLndyaXRlRmlsZSwgW2ZpbGVuYW1lLCBkYXRhLCBiYWNrZW5kXSwgZmFsc2UsIHRydWUpO1xuXHRcdFx0fSxcblx0XHRcdHJlbW92ZUZpbGU6IGZ1bmN0aW9uKGZpbGVuYW1lLCBiYWNrZW5kKSB7XG5cdFx0XHRcdHJldHVybiBtYWtlUHJvbWlzZShKU09OU3RvcmFnZS5yZW1vdmVGaWxlLCBbZmlsZW5hbWUsIGJhY2tlbmRdLCBmYWxzZSwgdHJ1ZSk7XG5cdFx0XHR9LFxuXHRcdFx0bGlzdEZpbGVzOiBmdW5jdGlvbihwYXRoLCBiYWNrZW5kKSB7XG5cdFx0XHRcdHJldHVybiBtYWtlUHJvbWlzZShKU09OU3RvcmFnZS5saXN0RmlsZXMsIFtwYXRoLCBiYWNrZW5kXSwgZmFsc2UsIHRydWUpO1xuXHRcdFx0fSxcblx0XHRcdHdpcGVEYXRhOiBmdW5jdGlvbihiYWNrZW5kKSB7XG5cdFx0XHRcdHJldHVybiBtYWtlUHJvbWlzZShKU09OU3RvcmFnZS53aXBlRGF0YSwgW2JhY2tlbmRdLCBmYWxzZSwgdHJ1ZSk7XG5cdFx0XHR9LFxuXHRcdH07XG5cdH0pO1xufSBlbHNlIHtcblx0Y29uc29sZS5sb2coJ0pTT05TdG9yYWdlOiBBbmd1bGFyIGlzIG5vdCBhdmFpbGFibGUuICBTa2lwcGluZyBBbmd1bGFyIHN1cHBvcnQuJyk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gSlNPTlN0b3JhZ2U7XG5cbmlmICghd2luZG93LnBsdWdpbnMpIHtcblx0d2luZG93LnBsdWdpbnMgPSB7fTtcbn1cbmlmICghd2luZG93LnBsdWdpbnMuSlNPTlN0b3JhZ2UpIHtcblx0d2luZG93LnBsdWdpbnMuSlNPTlN0b3JhZ2UgPSBKU09OU3RvcmFnZTtcbn1cbiIsIi8qIGpzaGludCAtVzA5NyAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbi8qIGdsb2JhbCBjb25zb2xlICovXG4vKiBnbG9iYWwgcmVxdWlyZSAqL1xuLyogZ2xvYmFsIHdpbmRvdyAqL1xuXG52YXIgQ29yZG92YUtleWNoYWluID0gcmVxdWlyZSgnY29yZG92YS1wbHVnaW4ta2V5Y2hhaW4nKTtcblxuaWYgKHR5cGVvZiBTdHJpbmcucHJvdG90eXBlLnN0YXJ0c1dpdGggIT09ICdmdW5jdGlvbicpIHtcblx0U3RyaW5nLnByb3RvdHlwZS5zdGFydHNXaXRoID0gZnVuY3Rpb24oc3RyKSB7XG5cdFx0cmV0dXJuIHRoaXMubGFzdEluZGV4T2Yoc3RyLCAwKSA9PT0gMDtcblx0fTtcbn1cbmlmICh0eXBlb2YgU3RyaW5nLnByb3RvdHlwZS5lbmRzV2l0aCAhPT0gJ2Z1bmN0aW9uJykge1xuXHRTdHJpbmcucHJvdG90eXBlLmVuZHNXaXRoID0gZnVuY3Rpb24oc3VmZml4KSB7XG5cdFx0cmV0dXJuIHRoaXMuaW5kZXhPZihzdWZmaXgsIHRoaXMubGVuZ3RoIC0gc3VmZml4Lmxlbmd0aCkgIT09IC0xO1xuXHR9O1xufVxuXG5mdW5jdGlvbiBLZXljaGFpbkJhY2tlbmQoKSB7XG5cdHZhciBrYyA9IG5ldyBDb3Jkb3ZhS2V5Y2hhaW4oKTtcblx0dmFyIHNlcnZpY2VOYW1lID0gJ0NvcmRvdmFKU09OU3RvcmFnZSc7XG5cblx0dmFyIGVuY29kZUtleSA9IGZ1bmN0aW9uKHN0cikge1xuXHRcdHJldHVybiB3aW5kb3cuYnRvYShzdHIpO1xuXHRcdC8qXG5cdFx0cmV0dXJuIHN0clxuXHRcdFx0LnJlcGxhY2UoL1tcXFxcXS9nLCAnXFxcXFxcXFwnKVxuXHRcdFx0LnJlcGxhY2UoL1tcXFwiXS9nLCAnXFxcXFxcXCInKVxuXHRcdFx0LnJlcGxhY2UoL1tcXC9dL2csICdcXFxcLycpXG5cdFx0XHQucmVwbGFjZSgvW1xcYl0vZywgJ1xcXFxiJylcblx0XHRcdC5yZXBsYWNlKC9bXFxmXS9nLCAnXFxcXGYnKVxuXHRcdFx0LnJlcGxhY2UoL1tcXG5dL2csICdcXFxcbicpXG5cdFx0XHQucmVwbGFjZSgvW1xccl0vZywgJ1xcXFxyJylcblx0XHRcdC5yZXBsYWNlKC9bXFx0XS9nLCAnXFxcXHQnKTtcblx0XHQqL1xuICBcdH07XG5cblx0dmFyIGVuY29kZSA9IGZ1bmN0aW9uKHN0cikge1xuXHRcdHJldHVybiBKU09OLnN0cmluZ2lmeShzdHIpO1xuXHR9O1xuXG5cdHZhciBkZWNvZGUgPSBmdW5jdGlvbihzdHIpIHtcblx0XHRyZXR1cm4gSlNPTi5wYXJzZShzdHIpO1xuXHR9O1xuXG5cdHZhciBjYWxsU3VjY2VzcyA9IGZ1bmN0aW9uKGNiLCBkYXRhKSB7XG5cdFx0dmFyIHJldCA9IHsgc3VjY2VzczogdHJ1ZSB9O1xuXHRcdGlmIChkYXRhKSB7XG5cdFx0XHRyZXQuY29udGVudHMgPSBkYXRhO1xuXHRcdH1cblx0XHRjYihyZXQpO1xuXHR9O1xuXHR2YXIgY2FsbEVycm9yID0gZnVuY3Rpb24oY2IsIGVycikge1xuXHRcdHZhciByZXQgPSB7IHN1Y2Nlc3M6IGZhbHNlIH07XG5cdFx0aWYgKGVycikge1xuXHRcdFx0cmV0LmVycm9yID0gZXJyO1xuXHRcdH1cblx0XHRjYihyZXQpO1xuXHR9O1xuXG5cdHZhciBjbGVhckluZGV4ID0gZnVuY3Rpb24oY2IpIHtcblx0XHRrYy5yZW1vdmVGb3JLZXkoZnVuY3Rpb24gc3VjY2VzcyhyZXN1bHQpIHtcblx0XHRcdGNiKHRydWUpO1xuXHRcdH0sIGZ1bmN0aW9uIGZhaWx1cmUoZXJyKSB7XG5cdFx0XHRpZiAoZXJyLmluZGV4T2YoJy0yNTMwMCcpID49IDApIHtcblx0XHRcdFx0Ly8gbm90IGZvdW5kIGVycm9yLCBjb25zaWRlciBpdCBjbGVhcmVkXG5cdFx0XHRcdGNiKHRydWUpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29uc29sZS5sb2coJ0tleWNoYWluQmFja2VuZC5jbGVhckluZGV4OiBXQVJOSU5HOiBmYWlsZWQ6ICcgKyBKU09OLnN0cmluZ2lmeShlcnIpKTtcblx0XHRcdFx0Y2IoZmFsc2UpO1xuXHRcdFx0fVxuXHRcdH0sICdfaW5kZXgnLCBzZXJ2aWNlTmFtZSk7XG5cdH07XG5cdHZhciBnZXRJbmRleCA9IGZ1bmN0aW9uKHMsIGYpIHtcblx0XHRrYy5nZXRGb3JLZXkoZnVuY3Rpb24gc3VjY2VzcyhyZXN1bHQpIHtcblx0XHRcdHMoZGVjb2RlKHJlc3VsdCkpO1xuXHRcdH0sIGZ1bmN0aW9uIGZhaWx1cmUoZXJyKSB7XG5cdFx0XHRjb25zb2xlLmxvZygnS2V5Y2hhaW5CYWNrZW5kLmdldEluZGV4OiBXQVJOSU5HOiBmYWlsZWQ6ICcgKyBKU09OLnN0cmluZ2lmeShlcnIpKTtcblx0XHRcdGYoZXJyKTtcblx0XHR9LCAnX2luZGV4Jywgc2VydmljZU5hbWUpO1xuXHR9O1xuXHR2YXIgdXBkYXRlSW5kZXggPSBmdW5jdGlvbihpbmRleCwgcywgZikge1xuXHRcdGtjLnNldEZvcktleShmdW5jdGlvbiBzdWNjZXNzKCkge1xuXHRcdFx0Ly9jb25zb2xlLmxvZygnS2V5Y2hhaW5CYWNrZW5kLnVwZGF0ZUluZGV4OiAnICsgSlNPTi5zdHJpbmdpZnkoaW5kZXgpKTtcblx0XHRcdHModHJ1ZSk7XG5cdFx0fSwgZnVuY3Rpb24gZmFpbHVyZShlcnIpIHtcblx0XHRcdGNvbnNvbGUubG9nKCdLZXljaGFpbkJhY2tlbmQudXBkYXRlSW5kZXg6IFdBUk5JTkc6IGZhaWxlZDogJyArIEpTT04uc3RyaW5naWZ5KGVycikpO1xuXHRcdFx0ZihlcnIpO1xuXHRcdH0sICdfaW5kZXgnLCBzZXJ2aWNlTmFtZSwgZW5jb2RlKGluZGV4KSk7XG5cdH07XG5cblx0dGhpcy5pc1ZhbGlkID0gZnVuY3Rpb24oKSB7XG5cdFx0aWYgKGtjICYmIGtjLmdldEZvcktleSkge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdH07XG5cblx0dGhpcy5yZWFkRmlsZSA9IGZ1bmN0aW9uKGZpbGVuYW1lLCBzLCBmKSB7XG5cdFx0a2MuZ2V0Rm9yS2V5KGZ1bmN0aW9uIHN1Y2Nlc3MocmVzdWx0KSB7XG5cdFx0XHQvL2NvbnNvbGUubG9nKCdLZXljaGFpbkJhY2tlbmQucmVhZEZpbGU6IHJlYWQgJyArIGZpbGVuYW1lICsgJzogJyArIHJlc3VsdCk7XG5cdFx0XHRjYWxsU3VjY2VzcyhzLCBkZWNvZGUocmVzdWx0KSk7XG5cdFx0fSwgZnVuY3Rpb24gZmFpbHVyZShlcnIpIHtcblx0XHRcdGNvbnNvbGUubG9nKCdLZXljaGFpbkJhY2tlbmQucmVhZEZpbGU6ICcgKyBmaWxlbmFtZSArICcgZmFpbHVyZTogJyArIEpTT04uc3RyaW5naWZ5KGVycikpO1xuXHRcdFx0Y2FsbEVycm9yKGYsIGVycik7XG5cdFx0fSwgZW5jb2RlS2V5KGZpbGVuYW1lKSwgc2VydmljZU5hbWUpO1xuXHR9O1xuXG5cdHRoaXMud3JpdGVGaWxlID0gZnVuY3Rpb24oZmlsZW5hbWUsIGRhdGEsIHMsIGYpIHtcblx0XHRkYXRhID0gZW5jb2RlKGRhdGEpO1xuXG5cdFx0a2Muc2V0Rm9yS2V5KGZ1bmN0aW9uIHN1Y2Nlc3MoKSB7XG5cdFx0XHQvL2NvbnNvbGUubG9nKCdLZXljaGFpbkJhY2tlbmQud3JpdGVGaWxlOiB3cm90ZSAnICsgZmlsZW5hbWUpO1xuXHRcdFx0Z2V0SW5kZXgoZnVuY3Rpb24gc3VjY2VzcyhpbmRleCkge1xuXHRcdFx0XHRpZiAoaW5kZXguaW5kZXhPZihmaWxlbmFtZSkgPT09IC0xKSB7XG5cdFx0XHRcdFx0aW5kZXgucHVzaChmaWxlbmFtZSk7XG5cdFx0XHRcdFx0aW5kZXguc29ydCgpO1xuXHRcdFx0XHRcdHVwZGF0ZUluZGV4KGluZGV4LCBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRcdGNhbGxTdWNjZXNzKHMsIGRhdGEpO1xuXHRcdFx0XHRcdH0sIGZ1bmN0aW9uKGVycikge1xuXHRcdFx0XHRcdFx0Y2FsbEVycm9yKGYsIGVycik7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Y2FsbFN1Y2Nlc3MocywgdHJ1ZSk7XG5cdFx0XHRcdH1cblx0XHRcdH0sIGZ1bmN0aW9uIGZhaWx1cmUoZXJyKSB7XG5cdFx0XHRcdHVwZGF0ZUluZGV4KFtmaWxlbmFtZV0sIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdGNhbGxTdWNjZXNzKHMsIGRhdGEpO1xuXHRcdFx0XHR9LCBmdW5jdGlvbihlcnIpIHtcblx0XHRcdFx0XHRjYWxsRXJyb3IoZiwgZXJyKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHR9LCBmdW5jdGlvbiBmYWlsdXJlKGVycikge1xuXHRcdFx0Y29uc29sZS5sb2coJ0tleWNoYWluQmFja2VuZC53cml0ZUZpbGU6ICcgKyBmaWxlbmFtZSArICcgZmFpbHVyZTogJyArIGVycik7XG5cdFx0XHRjYWxsRXJyb3IoZiwgZXJyKTtcblx0XHR9LCBlbmNvZGVLZXkoZmlsZW5hbWUpLCBzZXJ2aWNlTmFtZSwgZGF0YSk7XG5cdH07XG5cblx0dGhpcy5yZW1vdmVGaWxlID0gZnVuY3Rpb24oZmlsZW5hbWUsIHMsIGYpIHtcblx0XHR2YXIgZG9SZW1vdmUgPSBmdW5jdGlvbigpIHtcblx0XHRcdGtjLnJlbW92ZUZvcktleShmdW5jdGlvbiBzdWNjZXNzKCkge1xuXHRcdFx0XHQvL2NvbnNvbGUubG9nKCdLZXljaGFpbkJhY2tlbmQucmVtb3ZlRmlsZTogcmVtb3ZlZCAnICsgZmlsZW5hbWUpO1xuXHRcdFx0XHRjYWxsU3VjY2VzcyhzLCB0cnVlKTtcblx0XHRcdH0sIGZ1bmN0aW9uIGZhaWx1cmUoZXJyKSB7XG5cdFx0XHRcdGNvbnNvbGUubG9nKCdLZXljaGFpbkJhY2tlbmQucmVtb3ZlRmlsZTogJyArIGZpbGVuYW1lICsgJyBmYWlsdXJlOiAnICsgZXJyKTtcblx0XHRcdFx0Y2FsbEVycm9yKGYsIGVycik7XG5cdFx0XHR9LCBlbmNvZGVLZXkoZmlsZW5hbWUpLCBzZXJ2aWNlTmFtZSk7XG5cdFx0fTtcblxuXHRcdGdldEluZGV4KGZ1bmN0aW9uIHN1Y2Nlc3MoaW5kZXgpIHtcblx0XHRcdHZhciBsb2MgPSBpbmRleC5pbmRleE9mKGZpbGVuYW1lKTtcblx0XHRcdGlmIChsb2MgIT09IC0xKSB7XG5cdFx0XHRcdGluZGV4LnNwbGljZShsb2MsIDEpO1xuXHRcdFx0XHR1cGRhdGVJbmRleChpbmRleCwgZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0ZG9SZW1vdmUoKTtcblx0XHRcdFx0fSwgZnVuY3Rpb24oZXJyKSB7XG5cdFx0XHRcdFx0Y2FsbEVycm9yKGYsIGVycik7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0ZG9SZW1vdmUoKTtcblx0XHRcdH1cblx0XHR9LCBmdW5jdGlvbiBmYWlsdXJlKGVycikge1xuXHRcdFx0Y2FsbEVycm9yKGYsIGVycik7XG5cdFx0fSk7XG5cdH07XG5cblx0dGhpcy5saXN0RmlsZXMgPSBmdW5jdGlvbihwYXRoLCBzLCBmKSB7XG5cdFx0Z2V0SW5kZXgoZnVuY3Rpb24gc3VjY2VzcyhpbmRleCkge1xuXHRcdFx0dmFyIGksIGxlbiA9IGluZGV4Lmxlbmd0aCwgZW50cnksIHJldCA9IFtdLCBwcmVmaXggPSBwYXRoO1xuXHRcdFx0aWYgKCFwcmVmaXguZW5kc1dpdGgoJy8nKSkge1xuXHRcdFx0XHRwcmVmaXggPSBwcmVmaXggKyAnLyc7XG5cdFx0XHR9XG5cblx0XHRcdHZhciByZXBsYWNlID0gbmV3IFJlZ0V4cCgnXicgKyBwcmVmaXgucmVwbGFjZSgvWy4qKz9eJHt9KCl8W1xcXVxcXFxdL2csIFwiXFxcXCQmXCIpKTtcblx0XHRcdGZvciAoaT0wOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdFx0ZW50cnkgPSBpbmRleFtpXTtcblx0XHRcdFx0aWYgKHBhdGggPT09ICcnICYmICFlbnRyeS5zdGFydHNXaXRoKCcvJykpIHtcblx0XHRcdFx0XHRyZXQucHVzaChlbnRyeSk7XG5cdFx0XHRcdH0gZWxzZSBpZiAoZW50cnkuc3RhcnRzV2l0aChwcmVmaXgpKSB7XG5cdFx0XHRcdFx0cmV0LnB1c2goZW50cnkucmVwbGFjZShyZXBsYWNlLCAnJykpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdC8vY29uc29sZS5sb2coJ0tleWNoYWluQmFja2VuZC5saXN0RmlsZXM6IGxpc3RGaWxlcygnK3BhdGgrJyk6IGJlZm9yZSA9ICcgKyBKU09OLnN0cmluZ2lmeShpbmRleCwgdHJ1ZSkpO1xuXHRcdFx0Ly9jb25zb2xlLmxvZygnS2V5Y2hhaW5CYWNrZW5kLmxpc3RGaWxlczogbGlzdEZpbGVzKCcrcGF0aCsnKTogYWZ0ZXIgID0gJyArIEpTT04uc3RyaW5naWZ5KHJldCwgdHJ1ZSkpO1xuXHRcdFx0Y2FsbFN1Y2Nlc3MocywgcmV0KTtcblx0XHR9LCBmdW5jdGlvbiBmYWlsdXJlKGVycikge1xuXHRcdFx0Y2FsbEVycm9yKGYsIGVycik7XG5cdFx0fSk7XG5cdH07XG5cblx0dGhpcy53aXBlRGF0YSA9IGZ1bmN0aW9uKHMsIGYpIHtcblx0XHR2YXIgY2xlYXIgPSBmdW5jdGlvbihpbmRleCkge1xuXHRcdFx0dmFyIGksIGxlbiwgZW50cnk7XG5cblx0XHRcdHZhciBwZW5kaW5nVHJhbnNhY3Rpb25zID0ge307XG5cblx0XHRcdHZhciByZW1vdmVJdGVtID0gZnVuY3Rpb24oaXRlbSkge1xuXHRcdFx0XHQvL2NvbnNvbGUubG9nKCdLZXljaGFpbkJhY2tlbmQud2lwZURhdGE6IHJlbW92aW5nICcgKyBpdGVtKTtcblx0XHRcdFx0cGVuZGluZ1RyYW5zYWN0aW9uc1tpdGVtXSA9IHVuZGVmaW5lZDtcblx0XHRcdFx0a2MucmVtb3ZlRm9yS2V5KGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdHBlbmRpbmdUcmFuc2FjdGlvbnNbaXRlbV0gPSB0cnVlO1xuXHRcdFx0XHR9LCBmdW5jdGlvbiBlcnIoZSkge1xuXHRcdFx0XHRcdGNvbnNvbGUubG9nKCdLZXljaGFpbkJhY2tlbmQud2lwZURhdGE6IFdBUk5JTkc6IHVuYWJsZSB0byByZW1vdmUgJyArIGl0ZW0gKyAnOiAnICsgZSk7XG5cdFx0XHRcdFx0cGVuZGluZ1RyYW5zYWN0aW9uc1tpdGVtXSA9IGZhbHNlO1xuXHRcdFx0XHR9LCBlbmNvZGVLZXkoaXRlbSksIHNlcnZpY2VOYW1lKTtcblx0XHRcdH07XG5cblx0XHRcdHZhciB0aW1lb3V0SUQ7XG5cdFx0XHR2YXIgd2FpdEZvckNvbXBsZXRpb24gPSBmdW5jdGlvbigpIHtcblx0XHRcdFx0dmFyIGZpbmlzaGVkID0gdHJ1ZSxcblx0XHRcdFx0XHRmYWlsZWQgPSBbXSxcblx0XHRcdFx0XHRrZXlzID0gT2JqZWN0LmtleXMocGVuZGluZ1RyYW5zYWN0aW9ucyksXG5cdFx0XHRcdFx0aSwgbGVuID0ga2V5cy5sZW5ndGgsIGZpbGVuYW1lO1xuXG5cdFx0XHRcdGZvciAoaT0wOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdFx0XHRmaWxlbmFtZSA9IGtleXNbaV07XG5cdFx0XHRcdFx0aWYgKHBlbmRpbmdUcmFuc2FjdGlvbnNbZmlsZW5hbWVdID09PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRcdGZpbmlzaGVkID0gZmFsc2U7XG5cblx0XHRcdFx0XHR9IGVsc2UgaWYgKCFwZW5kaW5nVHJhbnNhY3Rpb25zW2ZpbGVuYW1lXSkge1xuXHRcdFx0XHRcdFx0ZmFpbGVkLnB1c2goZmlsZW5hbWUpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmICh0aW1lb3V0SUQpIHtcblx0XHRcdFx0XHR3aW5kb3cuY2xlYXJUaW1lb3V0KHRpbWVvdXRJRCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKGZpbmlzaGVkKSB7XG5cdFx0XHRcdFx0aWYgKGZhaWxlZC5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdFx0XHRjYWxsRXJyb3IoZiwgJ0ZhaWxlZCB0byByZW1vdmUgZmlsZXM6ICcgKyBmYWlsZWQuam9pbignLCAnKSk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdGNhbGxTdWNjZXNzKHMpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR3aW5kb3cuc2V0VGltZW91dCh3YWl0Rm9yQ29tcGxldGlvbiwgMTAwKTtcblx0XHRcdFx0fVxuXHRcdFx0fTtcblxuXHRcdFx0Y2xlYXJJbmRleChmdW5jdGlvbiBjbGVhckNhbGxiYWNrKHN1Y2Nlc3MpIHtcblx0XHRcdFx0Ly9jb25zb2xlLmxvZygnS2V5Y2hhaW5CYWNrZW5kLndpcGVEYXRhOiBjbGVhckluZGV4OiAnICsgc3VjY2Vzcyk7XG5cdFx0XHRcdGlmIChzdWNjZXNzKSB7XG5cdFx0XHRcdFx0aWYgKGluZGV4KSB7XG5cdFx0XHRcdFx0XHRsZW4gPSBpbmRleC5sZW5ndGg7XG5cdFx0XHRcdFx0XHRmb3IgKGk9MDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0XHRcdFx0XHRcdGVudHJ5ID0gaW5kZXhbaV07XG5cdFx0XHRcdFx0XHRcdHJlbW92ZUl0ZW0oZW50cnkpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHR3YWl0Rm9yQ29tcGxldGlvbigpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGNhbGxFcnJvcihmKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fTtcblxuXHRcdGdldEluZGV4KGZ1bmN0aW9uIHN1Y2Nlc3MoaW5kZXgpIHtcblx0XHRcdC8vY29uc29sZS5sb2coJ0tleWNoYWluQmFja2VuZC53aXBlRGF0YTogJyArIEpTT04uc3RyaW5naWZ5KGluZGV4KSk7XG5cdFx0XHRjbGVhcihpbmRleCk7XG5cdFx0fSwgZnVuY3Rpb24gZmFpbHVyZShlcnIpIHtcblx0XHRcdGNvbnNvbGUubG9nKCdLZXljaGFpbkJhY2tlbmQud2lwZURhdGE6IFdBUk5JTkc6ICcgKyBlcnIpO1xuXHRcdFx0Y2xlYXIoKTtcblx0XHR9KTtcblx0fTtcbn1cblxuS2V5Y2hhaW5CYWNrZW5kLnByb3RvdHlwZS5uYW1lID0gJ2tleWNoYWluJztcbiIsIi8qIGpzaGludCAtVzA5NyAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbi8qIGdsb2JhbCByZXF1aXJlICovXG5cbnZhciBleGVjID0gcmVxdWlyZSgnY29yZG92YS9leGVjJyk7XG5cbmZ1bmN0aW9uIExvY2FsQmFja2VuZCgpIHt9XG5Mb2NhbEJhY2tlbmQucHJvdG90eXBlLm5hbWUgPSAnbG9jYWwnO1xuTG9jYWxCYWNrZW5kLnByb3RvdHlwZS5pc1ZhbGlkID0gZnVuY3Rpb24oKSB7XG5cdHJldHVybiB0cnVlO1xufTtcbkxvY2FsQmFja2VuZC5wcm90b3R5cGUucmVhZEZpbGUgPSBmdW5jdGlvbihmaWxlbmFtZSwgc3VjY2VzcywgZmFpbHVyZSkge1xuXHRleGVjKHN1Y2Nlc3MsIGZhaWx1cmUsICdKU09OU3RvcmFnZScsICdvbm1zR2V0SnNvbkZpbGVDb250ZW50cycsIFtmaWxlbmFtZV0pO1xufTtcbkxvY2FsQmFja2VuZC5wcm90b3R5cGUud3JpdGVGaWxlID0gZnVuY3Rpb24oZmlsZW5hbWUsIGRhdGEsIHN1Y2Nlc3MsIGZhaWx1cmUpIHtcblx0ZXhlYyhzdWNjZXNzLCBmYWlsdXJlLCAnSlNPTlN0b3JhZ2UnLCAnb25tc1NldEpzb25GaWxlQ29udGVudHMnLCBbZmlsZW5hbWUsIGRhdGFdKTtcbn07XG5Mb2NhbEJhY2tlbmQucHJvdG90eXBlLnJlbW92ZUZpbGUgPSBmdW5jdGlvbihmaWxlbmFtZSwgc3VjY2VzcywgZmFpbHVyZSkge1xuXHRleGVjKHN1Y2Nlc3MsIGZhaWx1cmUsICdKU09OU3RvcmFnZScsICdvbm1zUmVtb3ZlSnNvbkZpbGUnLCBbZmlsZW5hbWVdKTtcbn07XG5Mb2NhbEJhY2tlbmQucHJvdG90eXBlLmxpc3RGaWxlcyA9IGZ1bmN0aW9uKHBhdGgsIHN1Y2Nlc3MsIGZhaWx1cmUpIHtcblx0ZXhlYyhzdWNjZXNzLCBmYWlsdXJlLCAnSlNPTlN0b3JhZ2UnLCAnb25tc0xpc3RKc29uRmlsZXMnLCBbcGF0aF0pO1xufTtcbkxvY2FsQmFja2VuZC5wcm90b3R5cGUud2lwZURhdGEgPSBmdW5jdGlvbihzdWNjZXNzLCBmYWlsdXJlKSB7XG5cdGV4ZWMoc3VjY2VzcywgZmFpbHVyZSwgJ0pTT05TdG9yYWdlJywgJ29ubXNXaXBlJywgW10pO1xufTtcbiIsIi8qIGpzaGludCAtVzA5NyAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbi8qIGdsb2JhbCByZXF1aXJlICovXG5cbnZhciBleGVjID0gcmVxdWlyZSgnY29yZG92YS9leGVjJyk7XG5cbmZ1bmN0aW9uIE1lbW9yeUJhY2tlbmQoKSB7XG5cdHRoaXMuZGF0YSA9IHt9O1xufVxuTWVtb3J5QmFja2VuZC5wcm90b3R5cGUubmFtZSA9ICdtZW1vcnknO1xuTWVtb3J5QmFja2VuZC5wcm90b3R5cGUuaXNWYWxpZCA9IGZ1bmN0aW9uKCkge1xuXHRyZXR1cm4gdHJ1ZTtcbn07XG5NZW1vcnlCYWNrZW5kLnByb3RvdHlwZS5yZWFkRmlsZSA9IGZ1bmN0aW9uKGZpbGVuYW1lLCBzdWNjZXNzLCBmYWlsdXJlKSB7XG5cdHZhciBzZWxmID0gdGhpcztcblx0aWYgKHNlbGYuZGF0YVtmaWxlbmFtZV0gJiYgc2VsZi5kYXRhW2ZpbGVuYW1lXSAhPT0gXCJcXDBcIikge1xuXHRcdHN1Y2Nlc3Moe1xuXHRcdFx0c3VjY2VzczogdHJ1ZSxcblx0XHRcdGNvbnRlbnRzOiBzZWxmLmRhdGFbZmlsZW5hbWVdXG5cdFx0fSk7XG5cdH0gZWxzZSB7XG5cdFx0ZmFpbHVyZSh7XG5cdFx0XHRzdWNjZXNzOiBmYWxzZSxcblx0XHRcdHJlYXNvbjogJ0ZpbGUgZG9lcyBub3QgZXhpc3QuJyxcblx0XHRcdGVycm9yOiAnRmlsZSBcIicgKyBmaWxlbmFtZSArICdcIiBkb2VzIG5vdCBleGlzdC4nLFxuXHRcdFx0Y29udGVudHM6IHVuZGVmaW5lZFxuXHRcdH0pO1xuXHR9XG59O1xuTWVtb3J5QmFja2VuZC5wcm90b3R5cGUud3JpdGVGaWxlID0gZnVuY3Rpb24oZmlsZW5hbWUsIGRhdGEsIHN1Y2Nlc3MsIGZhaWx1cmUpIHtcblx0dmFyIHNlbGYgPSB0aGlzO1xuXHRzZWxmLmRhdGFbZmlsZW5hbWVdID0gZGF0YTtcblx0c3VjY2Vzcyh7XG5cdFx0c3VjY2VzczogdHJ1ZSxcblx0XHRjb250ZW50czogZGF0YVxuXHR9KTtcbn07XG5NZW1vcnlCYWNrZW5kLnByb3RvdHlwZS5yZW1vdmVGaWxlID0gZnVuY3Rpb24oZmlsZW5hbWUsIHN1Y2Nlc3MsIGZhaWx1cmUpIHtcblx0dmFyIHNlbGYgPSB0aGlzLFxuXHRcdG9sZERhdGE7XG5cdGlmIChzZWxmLmRhdGFbZmlsZW5hbWVdKSB7XG5cdFx0b2xkRGF0YSA9IHNlbGYuZGF0YVtmaWxlbmFtZV07XG5cdFx0c2VsZi5kYXRhW2ZpbGVuYW1lXSA9IFwiXFwwXCI7XG5cdH1cblx0c3VjY2Vzcyh7XG5cdFx0c3VjY2VzczogdHJ1ZSxcblx0XHRjb250ZW50czogb2xkRGF0YVxuXHR9KTtcbn07XG5NZW1vcnlCYWNrZW5kLnByb3RvdHlwZS5saXN0RmlsZXMgPSBmdW5jdGlvbihwYXRoLCBzdWNjZXNzLCBmYWlsdXJlKSB7XG5cdGlmIChwYXRoICYmIHBhdGgubGVuZ3RoID4gMCAmJiBwYXRoLmNoYXJBdChwYXRoLmxlbmd0aC0xKSAhPT0gJy8nKSB7XG5cdFx0cGF0aCArPSAnLyc7XG5cdH1cblx0dmFyIHNlbGYgPSB0aGlzLFxuXHRcdGZpbGUsXG5cdFx0Zm91bmQgPSBmYWxzZSxcblx0XHRmaWxlcyA9IE9iamVjdC5rZXlzKHNlbGYuZGF0YSksXG5cdFx0cmV0ID0gW107XG5cblx0Zm9yICh2YXIgaT0wLCBsZW49ZmlsZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRmaWxlID0gZmlsZXNbaV07XG5cdFx0aWYgKGZpbGUuaW5kZXhPZihwYXRoKSA9PT0gMCkge1xuXHRcdFx0Zm91bmQgPSB0cnVlO1xuXHRcdFx0aWYgKHNlbGYuZGF0YVtmaWxlXSAhPT0gXCJcXDBcIikge1xuXHRcdFx0XHRyZXQucHVzaChmaWxlLnN1YnN0cihwYXRoLmxlbmd0aCkpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdGlmICghZm91bmQpIHtcblx0XHRmYWlsdXJlKHtcblx0XHRcdHN1Y2Nlc3M6IGZhbHNlLFxuXHRcdFx0cmVhc29uOiAnRGlyZWN0b3J5IGRvZXMgbm90IGV4aXN0LicsXG5cdFx0XHRlcnJvcjogJ0RpcmVjdG9yeSBcIicgKyBwYXRoICsgJ1wiIGRvZXMgbm90IGV4aXN0Lidcblx0XHR9KTtcblx0fSBlbHNlIHtcblx0XHRzdWNjZXNzKHtcblx0XHRcdHN1Y2Nlc3M6IHRydWUsXG5cdFx0XHRjb250ZW50czogcmV0XG5cdFx0fSk7XG5cdH1cbn07XG5NZW1vcnlCYWNrZW5kLnByb3RvdHlwZS53aXBlRGF0YSA9IGZ1bmN0aW9uKHN1Y2Nlc3MsIGZhaWx1cmUpIHtcblx0dmFyIHNlbGYgPSB0aGlzO1xuXHRzZWxmLmRhdGEgPSB7fTtcblx0c3VjY2Vzcyh7XG5cdFx0c3VjY2VzczogdHJ1ZSxcblx0XHRjb250ZW50czogdW5kZWZpbmVkXG5cdH0pO1xufTtcbiJdLCJzb3VyY2VSb290IjoiL3NvdXJjZS8ifQ==