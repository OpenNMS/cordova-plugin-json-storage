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

	console.log('CloudStorage: Initializing.');

	var attemptedBackends = [
		new KeychainBackend(),
		new LocalBackend(),
		new MemoryBackend()
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

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImNsb3VkLXN0b3JhZ2UuanMiLCJiYWNrZW5kcy9rZXljaGFpbi5qcyIsImJhY2tlbmRzL2xvY2FsLmpzIiwiYmFja2VuZHMvbWVtb3J5LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNuTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQy9RQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDNUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJjbG91ZC1zdG9yYWdlLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyoganNoaW50IC1XMDk3ICovXG5cbid1c2Ugc3RyaWN0JztcblxuLyogZ2xvYmFsIGFuZ3VsYXIgKi9cbi8qIGdsb2JhbCBjb25zb2xlICovXG4vKiBnbG9iYWwgZG9jdW1lbnQgKi9cbi8qIGdsb2JhbCBtb2R1bGUgKi9cbi8qIGdsb2JhbCByZXF1aXJlICovXG4vKiBnbG9iYWwgd2luZG93ICovXG5cbi8qIGdsb2JhbCBLZXljaGFpbkJhY2tlbmQgKi9cbi8qIGdsb2JhbCBMb2NhbEJhY2tlbmQgKi9cbi8qIGdsb2JhbCBNZW1vcnlCYWNrZW5kICovXG5cbnZhciBkZWJ1ZyA9IGZhbHNlO1xudmFyIGJhY2tlbmRzID0ge307XG52YXIgZGVmYXVsdEJhY2tlbmQ7XG5cbnZhciBfaW5pdGlhbGl6ZWQgPSBmYWxzZTtcbmZ1bmN0aW9uIGFzc2VydEluaXRpYWxpemVkKCkge1xuXHRpZiAoX2luaXRpYWxpemVkKSB7IHJldHVybjsgfVxuXHRfaW5pdGlhbGl6ZWQgPSB0cnVlO1xuXG5cdGNvbnNvbGUubG9nKCdDbG91ZFN0b3JhZ2U6IEluaXRpYWxpemluZy4nKTtcblxuXHR2YXIgYXR0ZW1wdGVkQmFja2VuZHMgPSBbXG5cdFx0bmV3IEtleWNoYWluQmFja2VuZCgpLFxuXHRcdG5ldyBMb2NhbEJhY2tlbmQoKSxcblx0XHRuZXcgTWVtb3J5QmFja2VuZCgpXG5cdF0sIGksIGxlbiA9IGF0dGVtcHRlZEJhY2tlbmRzLmxlbmd0aCwgYmU7XG5cblx0aWYgKGRlYnVnKSB7XG5cdFx0Y29uc29sZS5sb2coJ0Nsb3VkU3RvcmFnZTogQXR0ZW1wdGluZyBiYWNrZW5kczogJyArIGF0dGVtcHRlZEJhY2tlbmRzLm1hcChmdW5jdGlvbihlbnRyeSl7cmV0dXJuIGVudHJ5Lm5hbWU7fSkuam9pbignLCAnKSk7XG5cdH1cblx0Zm9yIChpPTA7IGkgPCBsZW47IGkrKykge1xuXHRcdGJlID0gYXR0ZW1wdGVkQmFja2VuZHNbaV07XG5cdFx0aWYgKGJlICYmIGJlLm5hbWUpIHtcblx0XHRcdGlmIChkZWJ1Zykge1xuXHRcdFx0XHRjb25zb2xlLmxvZygnQ2xvdWRTdG9yYWdlOiBDaGVja2luZyBwbHVnaW4gXCInICsgYmUubmFtZSArICdcIi4nKTtcblx0XHRcdH1cblx0XHRcdGlmIChiZS5pc1ZhbGlkICYmIGJlLmlzVmFsaWQoKSkge1xuXHRcdFx0XHRpZiAoZGVidWcpIHtcblx0XHRcdFx0XHRjb25zb2xlLmxvZygnQ2xvdWRTdG9yYWdlOiBCYWNrZW5kIFwiJyArIGJlLm5hbWUgKyAnXCIgaXMgdmFsaWQuJyk7XG5cdFx0XHRcdH1cblx0XHRcdFx0YmFja2VuZHNbYmUubmFtZV0gPSBiZTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnNvbGUubG9nKCdDbG91ZFN0b3JhZ2U6IEJhY2tlbmQgXCInICsgYmUubmFtZSArICdcIiBpcyBub3QgdmFsaWQuJyk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cdGNvbnNvbGUubG9nKCdDbG91ZFN0b3JhZ2U6IENvbmZpZ3VyZWQgYmFja2VuZHM6ICcgKyBPYmplY3Qua2V5cyhiYWNrZW5kcykpO1xuXG5cdGlmIChiYWNrZW5kcy5rZXljaGFpbikge1xuXHRcdGRlZmF1bHRCYWNrZW5kID0gJ2tleWNoYWluJztcblx0fSBlbHNlIHtcblx0XHRkZWZhdWx0QmFja2VuZCA9ICdsb2NhbCc7XG5cdH1cblx0cmV0dXJuIHRydWU7XG59XG5cbnZhciBnZXRCYWNrZW5kID0gZnVuY3Rpb24oYikge1xuXHRpZiAoYmFja2VuZHNbYl0pIHtcblx0XHRyZXR1cm4gYmFja2VuZHNbYl07XG5cdH0gZWxzZSBpZiAoYiAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0Y29uc29sZS5sb2coJ0Nsb3VkU3RvcmFnZTogVW5rbm93biBiYWNrZW5kIFwiJyArIGIgKyAnXCI6IGZhbGxpbmcgYmFjayB0byBkZWZhdWx0IChcIicgKyBkZWZhdWx0QmFja2VuZCArICdcIiknKTtcblx0fVxuXHRyZXR1cm4gYmFja2VuZHNbZGVmYXVsdEJhY2tlbmRdO1xufTtcblxudmFyIENsb3VkU3RvcmFnZSA9IHtcblx0J18nOiB7XG5cdFx0aW5pdDogYXNzZXJ0SW5pdGlhbGl6ZWQsXG5cdFx0Z2V0QmFja2VuZDogZnVuY3Rpb24oYikge1xuXHRcdFx0cmV0dXJuIGJhY2tlbmRzW2JdO1xuXHRcdH0sXG5cdFx0Z2V0QmFja2VuZHM6IGZ1bmN0aW9uKCkge1xuXHRcdFx0cmV0dXJuIGJhY2tlbmRzO1xuXHRcdH1cblx0fSxcblx0c2V0RGVidWc6IGZ1bmN0aW9uKGQpIHtcblx0XHRkZWJ1ZyA9ICEhZDtcblx0fSxcblx0Z2V0RGVmYXVsdEJhY2tlbmQ6IGZ1bmN0aW9uKCkge1xuXHRcdHJldHVybiBkZWZhdWx0QmFja2VuZDtcblx0fSxcblx0c2V0RGVmYXVsdEJhY2tlbmQ6IGZ1bmN0aW9uKGIsIHN1Y2Nlc3MsIGZhaWx1cmUpIHtcblx0XHRhc3NlcnRJbml0aWFsaXplZCgpO1xuXHRcdGlmIChiYWNrZW5kc1tiXSkge1xuXHRcdFx0aWYgKGRlYnVnKSB7IGNvbnNvbGUubG9nKCdDbG91ZFN0b3JhZ2U6IHNldHRpbmcgYmFja2VuZCB0byAnICsgYik7IH1cblx0XHRcdGRlZmF1bHRCYWNrZW5kID0gYjtcblx0XHRcdHN1Y2Nlc3MoYik7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHZhciBlcnJvciA9ICdVbmtub3duIGJhY2tlbmQgXCInICsgYiArICdcIic7XG5cdFx0XHRjb25zb2xlLmxvZygnQ2xvdWRTdG9yYWdlOiBXQVJOSU5HOiAnICsgZXJyb3IpO1xuXHRcdFx0Y29uc29sZS5sb2coJ0Nsb3VkU3RvcmFnZTogYXZhaWxhYmxlIGJhY2tlbmRzOiAnICsgT2JqZWN0LmtleXMoYmFja2VuZHMpLmpvaW4oJywgJykpO1xuXHRcdFx0ZmFpbHVyZShlcnJvcik7XG5cdFx0fVxuXHR9LFxuXHRyZWFkRmlsZTogZnVuY3Rpb24oZmlsZW5hbWUsIHN1Y2Nlc3MsIGZhaWx1cmUsIGJhY2tlbmQpIHtcblx0XHRhc3NlcnRJbml0aWFsaXplZCgpO1xuXHRcdHZhciBiZSA9IGdldEJhY2tlbmQoYmFja2VuZCk7XG5cdFx0aWYgKGRlYnVnKSB7IGNvbnNvbGUubG9nKCdDbG91ZFN0b3JhZ2U6ICcgKyBiZS5uYW1lICsgJy5yZWFkRmlsZSgnICsgZmlsZW5hbWUgKyAnKScpOyB9XG5cdFx0YmUucmVhZEZpbGUoZmlsZW5hbWUsIHN1Y2Nlc3MsIGZhaWx1cmUpO1xuXHR9LFxuXHR3cml0ZUZpbGU6IGZ1bmN0aW9uKGZpbGVuYW1lLCBkYXRhLCBzdWNjZXNzLCBmYWlsdXJlLCBiYWNrZW5kKSB7XG5cdFx0YXNzZXJ0SW5pdGlhbGl6ZWQoKTtcblx0XHR2YXIgYmUgPSBnZXRCYWNrZW5kKGJhY2tlbmQpO1xuXHRcdGlmIChkZWJ1ZykgeyBjb25zb2xlLmxvZygnQ2xvdWRTdG9yYWdlOiAnICsgYmUubmFtZSArICcud3JpdGVGaWxlKCcgKyBmaWxlbmFtZSArICcsIC4uLiknKTsgfVxuXHRcdGJlLndyaXRlRmlsZShmaWxlbmFtZSwgZGF0YSwgc3VjY2VzcywgZmFpbHVyZSk7XG5cdH0sXG5cdHJlbW92ZUZpbGU6IGZ1bmN0aW9uKGZpbGVuYW1lLCBzdWNjZXNzLCBmYWlsdXJlLCBiYWNrZW5kKSB7XG5cdFx0YXNzZXJ0SW5pdGlhbGl6ZWQoKTtcblx0XHR2YXIgYmUgPSBnZXRCYWNrZW5kKGJhY2tlbmQpO1xuXHRcdGlmIChkZWJ1ZykgeyBjb25zb2xlLmxvZygnQ2xvdWRTdG9yYWdlOiAnICsgYmUubmFtZSArICcucmVtb3ZlRmlsZSgnICsgZmlsZW5hbWUgKyAnKScpOyB9XG5cdFx0YmUucmVtb3ZlRmlsZShmaWxlbmFtZSwgc3VjY2VzcywgZmFpbHVyZSk7XG5cdH0sXG5cdGxpc3RGaWxlczogZnVuY3Rpb24ocGF0aCwgc3VjY2VzcywgZmFpbHVyZSwgYmFja2VuZCkge1xuXHRcdGFzc2VydEluaXRpYWxpemVkKCk7XG5cdFx0dmFyIGJlID0gZ2V0QmFja2VuZChiYWNrZW5kKTtcblx0XHRpZiAoZGVidWcpIHsgY29uc29sZS5sb2coJ0Nsb3VkU3RvcmFnZTogJyArIGJlLm5hbWUgKyAnLmxpc3RGaWxlcygnICsgcGF0aCArICcpJyk7IH1cblx0XHRiZS5saXN0RmlsZXMocGF0aCwgc3VjY2VzcywgZmFpbHVyZSk7XG5cdH0sXG5cdHdpcGVEYXRhOiBmdW5jdGlvbihzdWNjZXNzLCBmYWlsdXJlLCBiYWNrZW5kKSB7XG5cdFx0YXNzZXJ0SW5pdGlhbGl6ZWQoKTtcblx0XHR2YXIgYmUgPSBnZXRCYWNrZW5kKGJhY2tlbmQpO1xuXHRcdGlmIChkZWJ1ZykgeyBjb25zb2xlLmxvZygnQ2xvdWRTdG9yYWdlOiAnICsgYmUubmFtZSArICcud2lwZURhdGEoKScpOyB9XG5cdFx0YmUud2lwZURhdGEoc3VjY2VzcywgZmFpbHVyZSk7XG5cdH0sXG59O1xuXG5pZiAodHlwZW9mIGFuZ3VsYXIgIT09IFwidW5kZWZpbmVkXCIpIHtcblx0Y29uc29sZS5sb2coJ0Nsb3VkU3RvcmFnZTogQW5ndWxhciBpcyBhdmFpbGFibGUuICBSZWdpc3RlcmluZyBBbmd1bGFyIG1vZHVsZS4nKTtcblx0YW5ndWxhci5tb2R1bGUoJ0Nsb3VkU3RvcmFnZScsIFtdKS5mYWN0b3J5KCdDbG91ZFN0b3JhZ2UnLCBmdW5jdGlvbigkdGltZW91dCwgJHEpIHtcblx0XHRmdW5jdGlvbiBtYWtlUHJvbWlzZShmbiwgYXJncywgYXN5bmMsIGhhc0JhY2tlbmQpIHtcblx0XHRcdHZhciBkZWZlcnJlZCA9ICRxLmRlZmVyKCk7XG5cblx0XHRcdHZhciBzdWNjZXNzID0gZnVuY3Rpb24ocmVzcG9uc2UpIHtcblx0XHRcdFx0aWYgKGRlYnVnKSB7IGNvbnNvbGUubG9nKCdDbG91ZFN0b3JhZ2U6IHN1Y2Nlc3M6ICcgKyBhbmd1bGFyLnRvSnNvbihyZXNwb25zZSkpOyB9XG5cdFx0XHRcdGlmIChhc3luYykge1xuXHRcdFx0XHRcdCR0aW1lb3V0KGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdFx0ZGVmZXJyZWQucmVzb2x2ZShyZXNwb25zZSk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0ZGVmZXJyZWQucmVzb2x2ZShyZXNwb25zZSk7XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cblx0XHRcdHZhciBmYWlsID0gZnVuY3Rpb24ocmVzcG9uc2UpIHtcblx0XHRcdFx0aWYgKGRlYnVnKSB7IGNvbnNvbGUubG9nKCdDbG91ZFN0b3JhZ2U6IGZhaWx1cmU6ICcgKyBhbmd1bGFyLnRvSnNvbihyZXNwb25zZSkpOyB9XG5cdFx0XHRcdGlmIChhc3luYykge1xuXHRcdFx0XHRcdCR0aW1lb3V0KGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdFx0ZGVmZXJyZWQucmVqZWN0KHJlc3BvbnNlKTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRkZWZlcnJlZC5yZWplY3QocmVzcG9uc2UpO1xuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXG5cdFx0XHR2YXIgYmFja2VuZDtcblx0XHRcdGlmIChoYXNCYWNrZW5kKSB7XG5cdFx0XHRcdC8vIHB1bGwgdGhlIChvcHRpb25hbCkgYmFja2VuZCBvZmYgdGhlIGFyZyBsaXN0LCBzaW5jZSBpdCdzIGFsd2F5cyBsYXN0XG5cdFx0XHRcdGJhY2tlbmQgPSBhcmdzLnBvcCgpO1xuXHRcdFx0fVxuXHRcdFx0YXJncy5wdXNoKHN1Y2Nlc3MpO1xuXHRcdFx0YXJncy5wdXNoKGZhaWwpO1xuXHRcdFx0aWYgKGhhc0JhY2tlbmQpIHtcblx0XHRcdFx0YXJncy5wdXNoKGJhY2tlbmQpO1xuXHRcdFx0fVxuXG5cdFx0XHRmbi5hcHBseShDbG91ZFN0b3JhZ2UsIGFyZ3MpO1xuXG5cdFx0XHRyZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcblx0XHR9XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0c2V0RGVidWc6IGZ1bmN0aW9uKGRlYnVnKSB7XG5cdFx0XHRcdHJldHVybiBDbG91ZFN0b3JhZ2Uuc2V0RGVidWcoZGVidWcpO1xuXHRcdFx0fSxcblx0XHRcdHNldERlZmF1bHRCYWNrZW5kOiBmdW5jdGlvbihiYWNrZW5kKSB7XG5cdFx0XHRcdHJldHVybiBtYWtlUHJvbWlzZShDbG91ZFN0b3JhZ2Uuc2V0RGVmYXVsdEJhY2tlbmQsIFtiYWNrZW5kXSk7XG5cdFx0XHR9LFxuXHRcdFx0cmVhZEZpbGU6IGZ1bmN0aW9uKGZpbGVuYW1lLCBiYWNrZW5kKSB7XG5cdFx0XHRcdHJldHVybiBtYWtlUHJvbWlzZShDbG91ZFN0b3JhZ2UucmVhZEZpbGUsIFtmaWxlbmFtZSwgYmFja2VuZF0sIGZhbHNlLCB0cnVlKTtcblx0XHRcdH0sXG5cdFx0XHR3cml0ZUZpbGU6IGZ1bmN0aW9uKGZpbGVuYW1lLCBkYXRhLCBiYWNrZW5kKSB7XG5cdFx0XHRcdHJldHVybiBtYWtlUHJvbWlzZShDbG91ZFN0b3JhZ2Uud3JpdGVGaWxlLCBbZmlsZW5hbWUsIGRhdGEsIGJhY2tlbmRdLCBmYWxzZSwgdHJ1ZSk7XG5cdFx0XHR9LFxuXHRcdFx0cmVtb3ZlRmlsZTogZnVuY3Rpb24oZmlsZW5hbWUsIGJhY2tlbmQpIHtcblx0XHRcdFx0cmV0dXJuIG1ha2VQcm9taXNlKENsb3VkU3RvcmFnZS5yZW1vdmVGaWxlLCBbZmlsZW5hbWUsIGJhY2tlbmRdLCBmYWxzZSwgdHJ1ZSk7XG5cdFx0XHR9LFxuXHRcdFx0bGlzdEZpbGVzOiBmdW5jdGlvbihwYXRoLCBiYWNrZW5kKSB7XG5cdFx0XHRcdHJldHVybiBtYWtlUHJvbWlzZShDbG91ZFN0b3JhZ2UubGlzdEZpbGVzLCBbcGF0aCwgYmFja2VuZF0sIGZhbHNlLCB0cnVlKTtcblx0XHRcdH0sXG5cdFx0XHR3aXBlRGF0YTogZnVuY3Rpb24oYmFja2VuZCkge1xuXHRcdFx0XHRyZXR1cm4gbWFrZVByb21pc2UoQ2xvdWRTdG9yYWdlLndpcGVEYXRhLCBbYmFja2VuZF0sIGZhbHNlLCB0cnVlKTtcblx0XHRcdH0sXG5cdFx0fTtcblx0fSk7XG59IGVsc2Uge1xuXHRjb25zb2xlLmxvZygnQ2xvdWRTdG9yYWdlOiBBbmd1bGFyIGlzIG5vdCBhdmFpbGFibGUuICBTa2lwcGluZyBBbmd1bGFyIHN1cHBvcnQuJyk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gQ2xvdWRTdG9yYWdlO1xuXG5pZiAoIXdpbmRvdy5wbHVnaW5zKSB7XG5cdHdpbmRvdy5wbHVnaW5zID0ge307XG59XG5pZiAoIXdpbmRvdy5wbHVnaW5zLkNsb3VkU3RvcmFnZSkge1xuXHR3aW5kb3cucGx1Z2lucy5DbG91ZFN0b3JhZ2UgPSBDbG91ZFN0b3JhZ2U7XG59XG4iLCIvKiBqc2hpbnQgLVcwOTcgKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG4vKiBnbG9iYWwgY29uc29sZSAqL1xuLyogZ2xvYmFsIHJlcXVpcmUgKi9cbi8qIGdsb2JhbCB3aW5kb3cgKi9cblxudmFyIEtleWNoYWluID0gcmVxdWlyZSgnY29tLnNoYXpyb24uY29yZG92YS5wbHVnaW4ua2V5Y2hhaW51dGlsLktleWNoYWluJyk7XG5cbmlmICh0eXBlb2YgU3RyaW5nLnByb3RvdHlwZS5zdGFydHNXaXRoICE9PSAnZnVuY3Rpb24nKSB7XG5cdFN0cmluZy5wcm90b3R5cGUuc3RhcnRzV2l0aCA9IGZ1bmN0aW9uKHN0cikge1xuXHRcdHJldHVybiB0aGlzLmxhc3RJbmRleE9mKHN0ciwgMCkgPT09IDA7XG5cdH07XG59XG5pZiAodHlwZW9mIFN0cmluZy5wcm90b3R5cGUuZW5kc1dpdGggIT09ICdmdW5jdGlvbicpIHtcblx0U3RyaW5nLnByb3RvdHlwZS5lbmRzV2l0aCA9IGZ1bmN0aW9uKHN1ZmZpeCkge1xuXHRcdHJldHVybiB0aGlzLmluZGV4T2Yoc3VmZml4LCB0aGlzLmxlbmd0aCAtIHN1ZmZpeC5sZW5ndGgpICE9PSAtMTtcblx0fTtcbn1cblxuZnVuY3Rpb24gS2V5Y2hhaW5CYWNrZW5kKCkge1xuXHR2YXIga2MgPSBuZXcgS2V5Y2hhaW4oKTtcblx0dmFyIHNlcnZpY2VOYW1lID0gJ0NvcmRvdmFDbG91ZFN0b3JhZ2UnO1xuXG5cdHZhciBlbmNvZGVLZXkgPSBmdW5jdGlvbihzdHIpIHtcblx0XHRyZXR1cm4gd2luZG93LmJ0b2Eoc3RyKTtcblx0XHQvKlxuXHRcdHJldHVybiBzdHJcblx0XHRcdC5yZXBsYWNlKC9bXFxcXF0vZywgJ1xcXFxcXFxcJylcblx0XHRcdC5yZXBsYWNlKC9bXFxcIl0vZywgJ1xcXFxcXFwiJylcblx0XHRcdC5yZXBsYWNlKC9bXFwvXS9nLCAnXFxcXC8nKVxuXHRcdFx0LnJlcGxhY2UoL1tcXGJdL2csICdcXFxcYicpXG5cdFx0XHQucmVwbGFjZSgvW1xcZl0vZywgJ1xcXFxmJylcblx0XHRcdC5yZXBsYWNlKC9bXFxuXS9nLCAnXFxcXG4nKVxuXHRcdFx0LnJlcGxhY2UoL1tcXHJdL2csICdcXFxccicpXG5cdFx0XHQucmVwbGFjZSgvW1xcdF0vZywgJ1xcXFx0Jyk7XG5cdFx0Ki9cbiAgXHR9O1xuXG5cdHZhciBlbmNvZGUgPSBmdW5jdGlvbihzdHIpIHtcblx0XHRyZXR1cm4gSlNPTi5zdHJpbmdpZnkoc3RyKTtcblx0fTtcblxuXHR2YXIgZGVjb2RlID0gZnVuY3Rpb24oc3RyKSB7XG5cdFx0cmV0dXJuIEpTT04ucGFyc2Uoc3RyKTtcblx0fTtcblxuXHR2YXIgY2FsbFN1Y2Nlc3MgPSBmdW5jdGlvbihjYiwgZGF0YSkge1xuXHRcdHZhciByZXQgPSB7IHN1Y2Nlc3M6IHRydWUgfTtcblx0XHRpZiAoZGF0YSkge1xuXHRcdFx0cmV0LmNvbnRlbnRzID0gZGF0YTtcblx0XHR9XG5cdFx0Y2IocmV0KTtcblx0fTtcblx0dmFyIGNhbGxFcnJvciA9IGZ1bmN0aW9uKGNiLCBlcnIpIHtcblx0XHR2YXIgcmV0ID0geyBzdWNjZXNzOiBmYWxzZSB9O1xuXHRcdGlmIChlcnIpIHtcblx0XHRcdHJldC5lcnJvciA9IGVycjtcblx0XHR9XG5cdFx0Y2IocmV0KTtcblx0fTtcblxuXHR2YXIgY2xlYXJJbmRleCA9IGZ1bmN0aW9uKGNiKSB7XG5cdFx0a2MucmVtb3ZlRm9yS2V5KGZ1bmN0aW9uIHN1Y2Nlc3MocmVzdWx0KSB7XG5cdFx0XHRjYih0cnVlKTtcblx0XHR9LCBmdW5jdGlvbiBmYWlsdXJlKGVycikge1xuXHRcdFx0aWYgKGVyci5pbmRleE9mKCctMjUzMDAnKSA+PSAwKSB7XG5cdFx0XHRcdC8vIG5vdCBmb3VuZCBlcnJvciwgY29uc2lkZXIgaXQgY2xlYXJlZFxuXHRcdFx0XHRjYih0cnVlKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnNvbGUubG9nKCdLZXljaGFpbkJhY2tlbmQuY2xlYXJJbmRleDogV0FSTklORzogZmFpbGVkOiAnICsgSlNPTi5zdHJpbmdpZnkoZXJyKSk7XG5cdFx0XHRcdGNiKGZhbHNlKTtcblx0XHRcdH1cblx0XHR9LCAnX2luZGV4Jywgc2VydmljZU5hbWUpO1xuXHR9O1xuXHR2YXIgZ2V0SW5kZXggPSBmdW5jdGlvbihzLCBmKSB7XG5cdFx0a2MuZ2V0Rm9yS2V5KGZ1bmN0aW9uIHN1Y2Nlc3MocmVzdWx0KSB7XG5cdFx0XHRzKGRlY29kZShyZXN1bHQpKTtcblx0XHR9LCBmdW5jdGlvbiBmYWlsdXJlKGVycikge1xuXHRcdFx0Y29uc29sZS5sb2coJ0tleWNoYWluQmFja2VuZC5nZXRJbmRleDogV0FSTklORzogZmFpbGVkOiAnICsgSlNPTi5zdHJpbmdpZnkoZXJyKSk7XG5cdFx0XHRmKGVycik7XG5cdFx0fSwgJ19pbmRleCcsIHNlcnZpY2VOYW1lKTtcblx0fTtcblx0dmFyIHVwZGF0ZUluZGV4ID0gZnVuY3Rpb24oaW5kZXgsIHMsIGYpIHtcblx0XHRrYy5zZXRGb3JLZXkoZnVuY3Rpb24gc3VjY2VzcygpIHtcblx0XHRcdC8vY29uc29sZS5sb2coJ0tleWNoYWluQmFja2VuZC51cGRhdGVJbmRleDogJyArIEpTT04uc3RyaW5naWZ5KGluZGV4KSk7XG5cdFx0XHRzKHRydWUpO1xuXHRcdH0sIGZ1bmN0aW9uIGZhaWx1cmUoZXJyKSB7XG5cdFx0XHRjb25zb2xlLmxvZygnS2V5Y2hhaW5CYWNrZW5kLnVwZGF0ZUluZGV4OiBXQVJOSU5HOiBmYWlsZWQ6ICcgKyBKU09OLnN0cmluZ2lmeShlcnIpKTtcblx0XHRcdGYoZXJyKTtcblx0XHR9LCAnX2luZGV4Jywgc2VydmljZU5hbWUsIGVuY29kZShpbmRleCkpO1xuXHR9O1xuXG5cdHRoaXMuaXNWYWxpZCA9IGZ1bmN0aW9uKCkge1xuXHRcdGlmIChrYyAmJiBrYy5nZXRGb3JLZXkpIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHR9O1xuXG5cdHRoaXMucmVhZEZpbGUgPSBmdW5jdGlvbihmaWxlbmFtZSwgcywgZikge1xuXHRcdGtjLmdldEZvcktleShmdW5jdGlvbiBzdWNjZXNzKHJlc3VsdCkge1xuXHRcdFx0Ly9jb25zb2xlLmxvZygnS2V5Y2hhaW5CYWNrZW5kLnJlYWRGaWxlOiByZWFkICcgKyBmaWxlbmFtZSArICc6ICcgKyByZXN1bHQpO1xuXHRcdFx0Y2FsbFN1Y2Nlc3MocywgZGVjb2RlKHJlc3VsdCkpO1xuXHRcdH0sIGZ1bmN0aW9uIGZhaWx1cmUoZXJyKSB7XG5cdFx0XHRjb25zb2xlLmxvZygnS2V5Y2hhaW5CYWNrZW5kLnJlYWRGaWxlOiAnICsgZmlsZW5hbWUgKyAnIGZhaWx1cmU6ICcgKyBKU09OLnN0cmluZ2lmeShlcnIpKTtcblx0XHRcdGNhbGxFcnJvcihmLCBlcnIpO1xuXHRcdH0sIGVuY29kZUtleShmaWxlbmFtZSksIHNlcnZpY2VOYW1lKTtcblx0fTtcblxuXHR0aGlzLndyaXRlRmlsZSA9IGZ1bmN0aW9uKGZpbGVuYW1lLCBkYXRhLCBzLCBmKSB7XG5cdFx0ZGF0YSA9IGVuY29kZShkYXRhKTtcblxuXHRcdGtjLnNldEZvcktleShmdW5jdGlvbiBzdWNjZXNzKCkge1xuXHRcdFx0Ly9jb25zb2xlLmxvZygnS2V5Y2hhaW5CYWNrZW5kLndyaXRlRmlsZTogd3JvdGUgJyArIGZpbGVuYW1lKTtcblx0XHRcdGdldEluZGV4KGZ1bmN0aW9uIHN1Y2Nlc3MoaW5kZXgpIHtcblx0XHRcdFx0aWYgKGluZGV4LmluZGV4T2YoZmlsZW5hbWUpID09PSAtMSkge1xuXHRcdFx0XHRcdGluZGV4LnB1c2goZmlsZW5hbWUpO1xuXHRcdFx0XHRcdGluZGV4LnNvcnQoKTtcblx0XHRcdFx0XHR1cGRhdGVJbmRleChpbmRleCwgZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0XHRjYWxsU3VjY2VzcyhzLCBkYXRhKTtcblx0XHRcdFx0XHR9LCBmdW5jdGlvbihlcnIpIHtcblx0XHRcdFx0XHRcdGNhbGxFcnJvcihmLCBlcnIpO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGNhbGxTdWNjZXNzKHMsIHRydWUpO1xuXHRcdFx0XHR9XG5cdFx0XHR9LCBmdW5jdGlvbiBmYWlsdXJlKGVycikge1xuXHRcdFx0XHR1cGRhdGVJbmRleChbZmlsZW5hbWVdLCBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRjYWxsU3VjY2VzcyhzLCBkYXRhKTtcblx0XHRcdFx0fSwgZnVuY3Rpb24oZXJyKSB7XG5cdFx0XHRcdFx0Y2FsbEVycm9yKGYsIGVycik7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdFx0fSwgZnVuY3Rpb24gZmFpbHVyZShlcnIpIHtcblx0XHRcdGNvbnNvbGUubG9nKCdLZXljaGFpbkJhY2tlbmQud3JpdGVGaWxlOiAnICsgZmlsZW5hbWUgKyAnIGZhaWx1cmU6ICcgKyBlcnIpO1xuXHRcdFx0Y2FsbEVycm9yKGYsIGVycik7XG5cdFx0fSwgZW5jb2RlS2V5KGZpbGVuYW1lKSwgc2VydmljZU5hbWUsIGRhdGEpO1xuXHR9O1xuXG5cdHRoaXMucmVtb3ZlRmlsZSA9IGZ1bmN0aW9uKGZpbGVuYW1lLCBzLCBmKSB7XG5cdFx0dmFyIGRvUmVtb3ZlID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRrYy5yZW1vdmVGb3JLZXkoZnVuY3Rpb24gc3VjY2VzcygpIHtcblx0XHRcdFx0Ly9jb25zb2xlLmxvZygnS2V5Y2hhaW5CYWNrZW5kLnJlbW92ZUZpbGU6IHJlbW92ZWQgJyArIGZpbGVuYW1lKTtcblx0XHRcdFx0Y2FsbFN1Y2Nlc3MocywgdHJ1ZSk7XG5cdFx0XHR9LCBmdW5jdGlvbiBmYWlsdXJlKGVycikge1xuXHRcdFx0XHRjb25zb2xlLmxvZygnS2V5Y2hhaW5CYWNrZW5kLnJlbW92ZUZpbGU6ICcgKyBmaWxlbmFtZSArICcgZmFpbHVyZTogJyArIGVycik7XG5cdFx0XHRcdGNhbGxFcnJvcihmLCBlcnIpO1xuXHRcdFx0fSwgZW5jb2RlS2V5KGZpbGVuYW1lKSwgc2VydmljZU5hbWUpO1xuXHRcdH07XG5cblx0XHRnZXRJbmRleChmdW5jdGlvbiBzdWNjZXNzKGluZGV4KSB7XG5cdFx0XHR2YXIgbG9jID0gaW5kZXguaW5kZXhPZihmaWxlbmFtZSk7XG5cdFx0XHRpZiAobG9jICE9PSAtMSkge1xuXHRcdFx0XHRpbmRleC5zcGxpY2UobG9jLCAxKTtcblx0XHRcdFx0dXBkYXRlSW5kZXgoaW5kZXgsIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdGRvUmVtb3ZlKCk7XG5cdFx0XHRcdH0sIGZ1bmN0aW9uKGVycikge1xuXHRcdFx0XHRcdGNhbGxFcnJvcihmLCBlcnIpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGRvUmVtb3ZlKCk7XG5cdFx0XHR9XG5cdFx0fSwgZnVuY3Rpb24gZmFpbHVyZShlcnIpIHtcblx0XHRcdGNhbGxFcnJvcihmLCBlcnIpO1xuXHRcdH0pO1xuXHR9O1xuXG5cdHRoaXMubGlzdEZpbGVzID0gZnVuY3Rpb24ocGF0aCwgcywgZikge1xuXHRcdGdldEluZGV4KGZ1bmN0aW9uIHN1Y2Nlc3MoaW5kZXgpIHtcblx0XHRcdHZhciBpLCBsZW4gPSBpbmRleC5sZW5ndGgsIGVudHJ5LCByZXQgPSBbXSwgcHJlZml4ID0gcGF0aDtcblx0XHRcdGlmICghcHJlZml4LmVuZHNXaXRoKCcvJykpIHtcblx0XHRcdFx0cHJlZml4ID0gcHJlZml4ICsgJy8nO1xuXHRcdFx0fVxuXG5cdFx0XHR2YXIgcmVwbGFjZSA9IG5ldyBSZWdFeHAoJ14nICsgcHJlZml4LnJlcGxhY2UoL1suKis/XiR7fSgpfFtcXF1cXFxcXS9nLCBcIlxcXFwkJlwiKSk7XG5cdFx0XHRmb3IgKGk9MDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0XHRcdGVudHJ5ID0gaW5kZXhbaV07XG5cdFx0XHRcdGlmIChwYXRoID09PSAnJyAmJiAhZW50cnkuc3RhcnRzV2l0aCgnLycpKSB7XG5cdFx0XHRcdFx0cmV0LnB1c2goZW50cnkpO1xuXHRcdFx0XHR9IGVsc2UgaWYgKGVudHJ5LnN0YXJ0c1dpdGgocHJlZml4KSkge1xuXHRcdFx0XHRcdHJldC5wdXNoKGVudHJ5LnJlcGxhY2UocmVwbGFjZSwgJycpKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvL2NvbnNvbGUubG9nKCdLZXljaGFpbkJhY2tlbmQubGlzdEZpbGVzOiBsaXN0RmlsZXMoJytwYXRoKycpOiBiZWZvcmUgPSAnICsgSlNPTi5zdHJpbmdpZnkoaW5kZXgsIHRydWUpKTtcblx0XHRcdC8vY29uc29sZS5sb2coJ0tleWNoYWluQmFja2VuZC5saXN0RmlsZXM6IGxpc3RGaWxlcygnK3BhdGgrJyk6IGFmdGVyICA9ICcgKyBKU09OLnN0cmluZ2lmeShyZXQsIHRydWUpKTtcblx0XHRcdGNhbGxTdWNjZXNzKHMsIHJldCk7XG5cdFx0fSwgZnVuY3Rpb24gZmFpbHVyZShlcnIpIHtcblx0XHRcdGNhbGxFcnJvcihmLCBlcnIpO1xuXHRcdH0pO1xuXHR9O1xuXG5cdHRoaXMud2lwZURhdGEgPSBmdW5jdGlvbihzLCBmKSB7XG5cdFx0dmFyIGNsZWFyID0gZnVuY3Rpb24oaW5kZXgpIHtcblx0XHRcdHZhciBpLCBsZW4sIGVudHJ5O1xuXG5cdFx0XHR2YXIgcGVuZGluZ1RyYW5zYWN0aW9ucyA9IHt9O1xuXG5cdFx0XHR2YXIgcmVtb3ZlSXRlbSA9IGZ1bmN0aW9uKGl0ZW0pIHtcblx0XHRcdFx0Ly9jb25zb2xlLmxvZygnS2V5Y2hhaW5CYWNrZW5kLndpcGVEYXRhOiByZW1vdmluZyAnICsgaXRlbSk7XG5cdFx0XHRcdHBlbmRpbmdUcmFuc2FjdGlvbnNbaXRlbV0gPSB1bmRlZmluZWQ7XG5cdFx0XHRcdGtjLnJlbW92ZUZvcktleShmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRwZW5kaW5nVHJhbnNhY3Rpb25zW2l0ZW1dID0gdHJ1ZTtcblx0XHRcdFx0fSwgZnVuY3Rpb24gZXJyKGUpIHtcblx0XHRcdFx0XHRjb25zb2xlLmxvZygnS2V5Y2hhaW5CYWNrZW5kLndpcGVEYXRhOiBXQVJOSU5HOiB1bmFibGUgdG8gcmVtb3ZlICcgKyBpdGVtICsgJzogJyArIGUpO1xuXHRcdFx0XHRcdHBlbmRpbmdUcmFuc2FjdGlvbnNbaXRlbV0gPSBmYWxzZTtcblx0XHRcdFx0fSwgZW5jb2RlS2V5KGl0ZW0pLCBzZXJ2aWNlTmFtZSk7XG5cdFx0XHR9O1xuXG5cdFx0XHR2YXIgdGltZW91dElEO1xuXHRcdFx0dmFyIHdhaXRGb3JDb21wbGV0aW9uID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHZhciBmaW5pc2hlZCA9IHRydWUsXG5cdFx0XHRcdFx0ZmFpbGVkID0gW10sXG5cdFx0XHRcdFx0a2V5cyA9IE9iamVjdC5rZXlzKHBlbmRpbmdUcmFuc2FjdGlvbnMpLFxuXHRcdFx0XHRcdGksIGxlbiA9IGtleXMubGVuZ3RoLCBmaWxlbmFtZTtcblxuXHRcdFx0XHRmb3IgKGk9MDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0XHRcdFx0ZmlsZW5hbWUgPSBrZXlzW2ldO1xuXHRcdFx0XHRcdGlmIChwZW5kaW5nVHJhbnNhY3Rpb25zW2ZpbGVuYW1lXSA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0XHRmaW5pc2hlZCA9IGZhbHNlO1xuXG5cdFx0XHRcdFx0fSBlbHNlIGlmICghcGVuZGluZ1RyYW5zYWN0aW9uc1tmaWxlbmFtZV0pIHtcblx0XHRcdFx0XHRcdGZhaWxlZC5wdXNoKGZpbGVuYW1lKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAodGltZW91dElEKSB7XG5cdFx0XHRcdFx0d2luZG93LmNsZWFyVGltZW91dCh0aW1lb3V0SUQpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChmaW5pc2hlZCkge1xuXHRcdFx0XHRcdGlmIChmYWlsZWQubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRcdFx0Y2FsbEVycm9yKGYsICdGYWlsZWQgdG8gcmVtb3ZlIGZpbGVzOiAnICsgZmFpbGVkLmpvaW4oJywgJykpO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRjYWxsU3VjY2VzcyhzKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0d2luZG93LnNldFRpbWVvdXQod2FpdEZvckNvbXBsZXRpb24sIDEwMCk7XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cblx0XHRcdGNsZWFySW5kZXgoZnVuY3Rpb24gY2xlYXJDYWxsYmFjayhzdWNjZXNzKSB7XG5cdFx0XHRcdC8vY29uc29sZS5sb2coJ0tleWNoYWluQmFja2VuZC53aXBlRGF0YTogY2xlYXJJbmRleDogJyArIHN1Y2Nlc3MpO1xuXHRcdFx0XHRpZiAoc3VjY2Vzcykge1xuXHRcdFx0XHRcdGlmIChpbmRleCkge1xuXHRcdFx0XHRcdFx0bGVuID0gaW5kZXgubGVuZ3RoO1xuXHRcdFx0XHRcdFx0Zm9yIChpPTA7IGkgPCBsZW47IGkrKykge1xuXHRcdFx0XHRcdFx0XHRlbnRyeSA9IGluZGV4W2ldO1xuXHRcdFx0XHRcdFx0XHRyZW1vdmVJdGVtKGVudHJ5KTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0d2FpdEZvckNvbXBsZXRpb24oKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRjYWxsRXJyb3IoZik7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH07XG5cblx0XHRnZXRJbmRleChmdW5jdGlvbiBzdWNjZXNzKGluZGV4KSB7XG5cdFx0XHQvL2NvbnNvbGUubG9nKCdLZXljaGFpbkJhY2tlbmQud2lwZURhdGE6ICcgKyBKU09OLnN0cmluZ2lmeShpbmRleCkpO1xuXHRcdFx0Y2xlYXIoaW5kZXgpO1xuXHRcdH0sIGZ1bmN0aW9uIGZhaWx1cmUoZXJyKSB7XG5cdFx0XHRjb25zb2xlLmxvZygnS2V5Y2hhaW5CYWNrZW5kLndpcGVEYXRhOiBXQVJOSU5HOiAnICsgZXJyKTtcblx0XHRcdGNsZWFyKCk7XG5cdFx0fSk7XG5cdH07XG59XG5cbktleWNoYWluQmFja2VuZC5wcm90b3R5cGUubmFtZSA9ICdrZXljaGFpbic7XG4iLCIvKiBqc2hpbnQgLVcwOTcgKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG4vKiBnbG9iYWwgcmVxdWlyZSAqL1xuXG52YXIgZXhlYyA9IHJlcXVpcmUoJ2NvcmRvdmEvZXhlYycpO1xuXG5mdW5jdGlvbiBMb2NhbEJhY2tlbmQoKSB7fVxuTG9jYWxCYWNrZW5kLnByb3RvdHlwZS5uYW1lID0gJ2xvY2FsJztcbkxvY2FsQmFja2VuZC5wcm90b3R5cGUuaXNWYWxpZCA9IGZ1bmN0aW9uKCkge1xuXHRyZXR1cm4gdHJ1ZTtcbn07XG5Mb2NhbEJhY2tlbmQucHJvdG90eXBlLnJlYWRGaWxlID0gZnVuY3Rpb24oZmlsZW5hbWUsIHN1Y2Nlc3MsIGZhaWx1cmUpIHtcblx0ZXhlYyhzdWNjZXNzLCBmYWlsdXJlLCAnQ2xvdWRTdG9yYWdlJywgJ29ubXNHZXRKc29uRmlsZUNvbnRlbnRzJywgW2ZpbGVuYW1lXSk7XG59O1xuTG9jYWxCYWNrZW5kLnByb3RvdHlwZS53cml0ZUZpbGUgPSBmdW5jdGlvbihmaWxlbmFtZSwgZGF0YSwgc3VjY2VzcywgZmFpbHVyZSkge1xuXHRleGVjKHN1Y2Nlc3MsIGZhaWx1cmUsICdDbG91ZFN0b3JhZ2UnLCAnb25tc1NldEpzb25GaWxlQ29udGVudHMnLCBbZmlsZW5hbWUsIGRhdGFdKTtcbn07XG5Mb2NhbEJhY2tlbmQucHJvdG90eXBlLnJlbW92ZUZpbGUgPSBmdW5jdGlvbihmaWxlbmFtZSwgc3VjY2VzcywgZmFpbHVyZSkge1xuXHRleGVjKHN1Y2Nlc3MsIGZhaWx1cmUsICdDbG91ZFN0b3JhZ2UnLCAnb25tc1JlbW92ZUpzb25GaWxlJywgW2ZpbGVuYW1lXSk7XG59O1xuTG9jYWxCYWNrZW5kLnByb3RvdHlwZS5saXN0RmlsZXMgPSBmdW5jdGlvbihwYXRoLCBzdWNjZXNzLCBmYWlsdXJlKSB7XG5cdGV4ZWMoc3VjY2VzcywgZmFpbHVyZSwgJ0Nsb3VkU3RvcmFnZScsICdvbm1zTGlzdEpzb25GaWxlcycsIFtwYXRoXSk7XG59O1xuTG9jYWxCYWNrZW5kLnByb3RvdHlwZS53aXBlRGF0YSA9IGZ1bmN0aW9uKHN1Y2Nlc3MsIGZhaWx1cmUpIHtcblx0ZXhlYyhzdWNjZXNzLCBmYWlsdXJlLCAnQ2xvdWRTdG9yYWdlJywgJ29ubXNXaXBlJywgW10pO1xufTtcbiIsIi8qIGpzaGludCAtVzA5NyAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbi8qIGdsb2JhbCByZXF1aXJlICovXG5cbnZhciBleGVjID0gcmVxdWlyZSgnY29yZG92YS9leGVjJyk7XG5cbmZ1bmN0aW9uIE1lbW9yeUJhY2tlbmQoKSB7XG5cdHRoaXMuZGF0YSA9IHt9O1xufVxuTWVtb3J5QmFja2VuZC5wcm90b3R5cGUubmFtZSA9ICdtZW1vcnknO1xuTWVtb3J5QmFja2VuZC5wcm90b3R5cGUuaXNWYWxpZCA9IGZ1bmN0aW9uKCkge1xuXHRyZXR1cm4gdHJ1ZTtcbn07XG5NZW1vcnlCYWNrZW5kLnByb3RvdHlwZS5yZWFkRmlsZSA9IGZ1bmN0aW9uKGZpbGVuYW1lLCBzdWNjZXNzLCBmYWlsdXJlKSB7XG5cdHZhciBzZWxmID0gdGhpcztcblx0aWYgKHNlbGYuZGF0YVtmaWxlbmFtZV0gJiYgc2VsZi5kYXRhW2ZpbGVuYW1lXSAhPT0gXCJcXDBcIikge1xuXHRcdHN1Y2Nlc3Moe1xuXHRcdFx0c3VjY2VzczogdHJ1ZSxcblx0XHRcdGNvbnRlbnRzOiBzZWxmLmRhdGFbZmlsZW5hbWVdXG5cdFx0fSk7XG5cdH0gZWxzZSB7XG5cdFx0ZmFpbHVyZSh7XG5cdFx0XHRzdWNjZXNzOiBmYWxzZSxcblx0XHRcdHJlYXNvbjogJ0ZpbGUgZG9lcyBub3QgZXhpc3QuJyxcblx0XHRcdGVycm9yOiAnRmlsZSBcIicgKyBmaWxlbmFtZSArICdcIiBkb2VzIG5vdCBleGlzdC4nLFxuXHRcdFx0Y29udGVudHM6IHVuZGVmaW5lZFxuXHRcdH0pO1xuXHR9XG59O1xuTWVtb3J5QmFja2VuZC5wcm90b3R5cGUud3JpdGVGaWxlID0gZnVuY3Rpb24oZmlsZW5hbWUsIGRhdGEsIHN1Y2Nlc3MsIGZhaWx1cmUpIHtcblx0dmFyIHNlbGYgPSB0aGlzO1xuXHRzZWxmLmRhdGFbZmlsZW5hbWVdID0gZGF0YTtcblx0c3VjY2Vzcyh7XG5cdFx0c3VjY2VzczogdHJ1ZSxcblx0XHRjb250ZW50czogZGF0YVxuXHR9KTtcbn07XG5NZW1vcnlCYWNrZW5kLnByb3RvdHlwZS5yZW1vdmVGaWxlID0gZnVuY3Rpb24oZmlsZW5hbWUsIHN1Y2Nlc3MsIGZhaWx1cmUpIHtcblx0dmFyIHNlbGYgPSB0aGlzLFxuXHRcdG9sZERhdGE7XG5cdGlmIChzZWxmLmRhdGFbZmlsZW5hbWVdKSB7XG5cdFx0b2xkRGF0YSA9IHNlbGYuZGF0YVtmaWxlbmFtZV07XG5cdFx0c2VsZi5kYXRhW2ZpbGVuYW1lXSA9IFwiXFwwXCI7XG5cdH1cblx0c3VjY2Vzcyh7XG5cdFx0c3VjY2VzczogdHJ1ZSxcblx0XHRjb250ZW50czogb2xkRGF0YVxuXHR9KTtcbn07XG5NZW1vcnlCYWNrZW5kLnByb3RvdHlwZS5saXN0RmlsZXMgPSBmdW5jdGlvbihwYXRoLCBzdWNjZXNzLCBmYWlsdXJlKSB7XG5cdGlmIChwYXRoICYmIHBhdGgubGVuZ3RoID4gMCAmJiBwYXRoLmNoYXJBdChwYXRoLmxlbmd0aC0xKSAhPT0gJy8nKSB7XG5cdFx0cGF0aCArPSAnLyc7XG5cdH1cblx0dmFyIHNlbGYgPSB0aGlzLFxuXHRcdGZpbGUsXG5cdFx0Zm91bmQgPSBmYWxzZSxcblx0XHRmaWxlcyA9IE9iamVjdC5rZXlzKHNlbGYuZGF0YSksXG5cdFx0cmV0ID0gW107XG5cblx0Zm9yICh2YXIgaT0wLCBsZW49ZmlsZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRmaWxlID0gZmlsZXNbaV07XG5cdFx0aWYgKGZpbGUuaW5kZXhPZihwYXRoKSA9PT0gMCkge1xuXHRcdFx0Zm91bmQgPSB0cnVlO1xuXHRcdFx0aWYgKHNlbGYuZGF0YVtmaWxlXSAhPT0gXCJcXDBcIikge1xuXHRcdFx0XHRyZXQucHVzaChmaWxlLnN1YnN0cihwYXRoLmxlbmd0aCkpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdGlmICghZm91bmQpIHtcblx0XHRmYWlsdXJlKHtcblx0XHRcdHN1Y2Nlc3M6IGZhbHNlLFxuXHRcdFx0cmVhc29uOiAnRGlyZWN0b3J5IGRvZXMgbm90IGV4aXN0LicsXG5cdFx0XHRlcnJvcjogJ0RpcmVjdG9yeSBcIicgKyBwYXRoICsgJ1wiIGRvZXMgbm90IGV4aXN0Lidcblx0XHR9KTtcblx0fSBlbHNlIHtcblx0XHRzdWNjZXNzKHtcblx0XHRcdHN1Y2Nlc3M6IHRydWUsXG5cdFx0XHRjb250ZW50czogcmV0XG5cdFx0fSk7XG5cdH1cbn07XG5NZW1vcnlCYWNrZW5kLnByb3RvdHlwZS53aXBlRGF0YSA9IGZ1bmN0aW9uKHN1Y2Nlc3MsIGZhaWx1cmUpIHtcblx0dmFyIHNlbGYgPSB0aGlzO1xuXHRzZWxmLmRhdGEgPSB7fTtcblx0c3VjY2Vzcyh7XG5cdFx0c3VjY2VzczogdHJ1ZSxcblx0XHRjb250ZW50czogdW5kZWZpbmVkXG5cdH0pO1xufTtcbiJdLCJzb3VyY2VSb290IjoiL3NvdXJjZS8ifQ==