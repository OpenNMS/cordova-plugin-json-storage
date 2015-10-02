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
			if (success) {
				success(b);
			}
		} else {
			var error = 'Unknown backend "' + b + '"';
			console.log('CloudStorage: WARNING: ' + error);
			console.log('CloudStorage: available backends: ' + Object.keys(backends).join(', '));
			if (failure) {
				failure(error);
			}
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

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImNsb3VkLXN0b3JhZ2UuanMiLCJiYWNrZW5kcy9rZXljaGFpbi5qcyIsImJhY2tlbmRzL2xvY2FsLmpzIiwiYmFja2VuZHMvbWVtb3J5LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3ZOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDL1FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUM1QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImNsb3VkLXN0b3JhZ2UuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKiBqc2hpbnQgLVcwOTcgKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG4vKiBnbG9iYWwgYW5ndWxhciAqL1xuLyogZ2xvYmFsIGNvbnNvbGUgKi9cbi8qIGdsb2JhbCBkb2N1bWVudCAqL1xuLyogZ2xvYmFsIG1vZHVsZSAqL1xuLyogZ2xvYmFsIHJlcXVpcmUgKi9cbi8qIGdsb2JhbCB3aW5kb3cgKi9cblxuLyogZ2xvYmFsIEtleWNoYWluQmFja2VuZCAqL1xuLyogZ2xvYmFsIExvY2FsQmFja2VuZCAqL1xuLyogZ2xvYmFsIE1lbW9yeUJhY2tlbmQgKi9cblxudmFyIGRlYnVnID0gZmFsc2U7XG52YXIgYmFja2VuZHMgPSB7fTtcbnZhciBkZWZhdWx0QmFja2VuZDtcblxudmFyIF9pbml0aWFsaXplZCA9IGZhbHNlO1xuZnVuY3Rpb24gYXNzZXJ0SW5pdGlhbGl6ZWQoKSB7XG5cdGlmIChfaW5pdGlhbGl6ZWQpIHsgcmV0dXJuOyB9XG5cdF9pbml0aWFsaXplZCA9IHRydWU7XG5cblx0Y29uc29sZS5sb2coJ0Nsb3VkU3RvcmFnZTogSW5pdGlhbGl6aW5nLicpO1xuXG5cdHZhciBhdHRlbXB0ZWRCYWNrZW5kcyA9IFtcblx0XHRuZXcgS2V5Y2hhaW5CYWNrZW5kKCksXG5cdFx0bmV3IExvY2FsQmFja2VuZCgpLFxuXHRcdG5ldyBNZW1vcnlCYWNrZW5kKClcblx0XSwgaSwgbGVuID0gYXR0ZW1wdGVkQmFja2VuZHMubGVuZ3RoLCBiZTtcblxuXHRpZiAoZGVidWcpIHtcblx0XHRjb25zb2xlLmxvZygnQ2xvdWRTdG9yYWdlOiBBdHRlbXB0aW5nIGJhY2tlbmRzOiAnICsgYXR0ZW1wdGVkQmFja2VuZHMubWFwKGZ1bmN0aW9uKGVudHJ5KXtyZXR1cm4gZW50cnkubmFtZTt9KS5qb2luKCcsICcpKTtcblx0fVxuXHRmb3IgKGk9MDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0YmUgPSBhdHRlbXB0ZWRCYWNrZW5kc1tpXTtcblx0XHRpZiAoYmUgJiYgYmUubmFtZSkge1xuXHRcdFx0aWYgKGRlYnVnKSB7XG5cdFx0XHRcdGNvbnNvbGUubG9nKCdDbG91ZFN0b3JhZ2U6IENoZWNraW5nIHBsdWdpbiBcIicgKyBiZS5uYW1lICsgJ1wiLicpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGJlLmlzVmFsaWQgJiYgYmUuaXNWYWxpZCgpKSB7XG5cdFx0XHRcdGlmIChkZWJ1Zykge1xuXHRcdFx0XHRcdGNvbnNvbGUubG9nKCdDbG91ZFN0b3JhZ2U6IEJhY2tlbmQgXCInICsgYmUubmFtZSArICdcIiBpcyB2YWxpZC4nKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRiYWNrZW5kc1tiZS5uYW1lXSA9IGJlO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29uc29sZS5sb2coJ0Nsb3VkU3RvcmFnZTogQmFja2VuZCBcIicgKyBiZS5uYW1lICsgJ1wiIGlzIG5vdCB2YWxpZC4nKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblx0Y29uc29sZS5sb2coJ0Nsb3VkU3RvcmFnZTogQ29uZmlndXJlZCBiYWNrZW5kczogJyArIE9iamVjdC5rZXlzKGJhY2tlbmRzKSk7XG5cblx0aWYgKGJhY2tlbmRzLmtleWNoYWluKSB7XG5cdFx0ZGVmYXVsdEJhY2tlbmQgPSAna2V5Y2hhaW4nO1xuXHR9IGVsc2Uge1xuXHRcdGRlZmF1bHRCYWNrZW5kID0gJ2xvY2FsJztcblx0fVxuXHRyZXR1cm4gdHJ1ZTtcbn1cblxudmFyIGdldEJhY2tlbmQgPSBmdW5jdGlvbihiKSB7XG5cdGlmIChiYWNrZW5kc1tiXSkge1xuXHRcdHJldHVybiBiYWNrZW5kc1tiXTtcblx0fSBlbHNlIGlmIChiICE9PSB1bmRlZmluZWQpIHtcblx0XHRjb25zb2xlLmxvZygnQ2xvdWRTdG9yYWdlOiBVbmtub3duIGJhY2tlbmQgXCInICsgYiArICdcIjogZmFsbGluZyBiYWNrIHRvIGRlZmF1bHQgKFwiJyArIGRlZmF1bHRCYWNrZW5kICsgJ1wiKScpO1xuXHR9XG5cdHJldHVybiBiYWNrZW5kc1tkZWZhdWx0QmFja2VuZF07XG59O1xuXG52YXIgQ2xvdWRTdG9yYWdlID0ge1xuXHQnXyc6IHtcblx0XHRpbml0OiBhc3NlcnRJbml0aWFsaXplZCxcblx0XHRnZXRCYWNrZW5kOiBmdW5jdGlvbihiKSB7XG5cdFx0XHRyZXR1cm4gYmFja2VuZHNbYl07XG5cdFx0fSxcblx0XHRnZXRCYWNrZW5kczogZnVuY3Rpb24oKSB7XG5cdFx0XHRyZXR1cm4gYmFja2VuZHM7XG5cdFx0fVxuXHR9LFxuXHRzZXREZWJ1ZzogZnVuY3Rpb24oZCkge1xuXHRcdGRlYnVnID0gISFkO1xuXHR9LFxuXHRnZXREZWZhdWx0QmFja2VuZDogZnVuY3Rpb24oKSB7XG5cdFx0cmV0dXJuIGRlZmF1bHRCYWNrZW5kO1xuXHR9LFxuXHRzZXREZWZhdWx0QmFja2VuZDogZnVuY3Rpb24oYiwgc3VjY2VzcywgZmFpbHVyZSkge1xuXHRcdGFzc2VydEluaXRpYWxpemVkKCk7XG5cdFx0aWYgKGJhY2tlbmRzW2JdKSB7XG5cdFx0XHRpZiAoZGVidWcpIHsgY29uc29sZS5sb2coJ0Nsb3VkU3RvcmFnZTogc2V0dGluZyBiYWNrZW5kIHRvICcgKyBiKTsgfVxuXHRcdFx0ZGVmYXVsdEJhY2tlbmQgPSBiO1xuXHRcdFx0aWYgKHN1Y2Nlc3MpIHtcblx0XHRcdFx0c3VjY2VzcyhiKTtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0dmFyIGVycm9yID0gJ1Vua25vd24gYmFja2VuZCBcIicgKyBiICsgJ1wiJztcblx0XHRcdGNvbnNvbGUubG9nKCdDbG91ZFN0b3JhZ2U6IFdBUk5JTkc6ICcgKyBlcnJvcik7XG5cdFx0XHRjb25zb2xlLmxvZygnQ2xvdWRTdG9yYWdlOiBhdmFpbGFibGUgYmFja2VuZHM6ICcgKyBPYmplY3Qua2V5cyhiYWNrZW5kcykuam9pbignLCAnKSk7XG5cdFx0XHRpZiAoZmFpbHVyZSkge1xuXHRcdFx0XHRmYWlsdXJlKGVycm9yKTtcblx0XHRcdH1cblx0XHR9XG5cdH0sXG5cdHJlYWRGaWxlOiBmdW5jdGlvbihmaWxlbmFtZSwgc3VjY2VzcywgZmFpbHVyZSwgYmFja2VuZCkge1xuXHRcdGFzc2VydEluaXRpYWxpemVkKCk7XG5cdFx0dmFyIGJlID0gZ2V0QmFja2VuZChiYWNrZW5kKTtcblx0XHRpZiAoZGVidWcpIHsgY29uc29sZS5sb2coJ0Nsb3VkU3RvcmFnZTogJyArIGJlLm5hbWUgKyAnLnJlYWRGaWxlKCcgKyBmaWxlbmFtZSArICcpJyk7IH1cblx0XHRiZS5yZWFkRmlsZShmaWxlbmFtZSwgc3VjY2VzcywgZmFpbHVyZSk7XG5cdH0sXG5cdHdyaXRlRmlsZTogZnVuY3Rpb24oZmlsZW5hbWUsIGRhdGEsIHN1Y2Nlc3MsIGZhaWx1cmUsIGJhY2tlbmQpIHtcblx0XHRhc3NlcnRJbml0aWFsaXplZCgpO1xuXHRcdHZhciBiZSA9IGdldEJhY2tlbmQoYmFja2VuZCk7XG5cdFx0aWYgKGRlYnVnKSB7IGNvbnNvbGUubG9nKCdDbG91ZFN0b3JhZ2U6ICcgKyBiZS5uYW1lICsgJy53cml0ZUZpbGUoJyArIGZpbGVuYW1lICsgJywgLi4uKScpOyB9XG5cdFx0YmUud3JpdGVGaWxlKGZpbGVuYW1lLCBkYXRhLCBzdWNjZXNzLCBmYWlsdXJlKTtcblx0fSxcblx0cmVtb3ZlRmlsZTogZnVuY3Rpb24oZmlsZW5hbWUsIHN1Y2Nlc3MsIGZhaWx1cmUsIGJhY2tlbmQpIHtcblx0XHRhc3NlcnRJbml0aWFsaXplZCgpO1xuXHRcdHZhciBiZSA9IGdldEJhY2tlbmQoYmFja2VuZCk7XG5cdFx0aWYgKGRlYnVnKSB7IGNvbnNvbGUubG9nKCdDbG91ZFN0b3JhZ2U6ICcgKyBiZS5uYW1lICsgJy5yZW1vdmVGaWxlKCcgKyBmaWxlbmFtZSArICcpJyk7IH1cblx0XHRiZS5yZW1vdmVGaWxlKGZpbGVuYW1lLCBzdWNjZXNzLCBmYWlsdXJlKTtcblx0fSxcblx0bGlzdEZpbGVzOiBmdW5jdGlvbihwYXRoLCBzdWNjZXNzLCBmYWlsdXJlLCBiYWNrZW5kKSB7XG5cdFx0YXNzZXJ0SW5pdGlhbGl6ZWQoKTtcblx0XHR2YXIgYmUgPSBnZXRCYWNrZW5kKGJhY2tlbmQpO1xuXHRcdGlmIChkZWJ1ZykgeyBjb25zb2xlLmxvZygnQ2xvdWRTdG9yYWdlOiAnICsgYmUubmFtZSArICcubGlzdEZpbGVzKCcgKyBwYXRoICsgJyknKTsgfVxuXHRcdGJlLmxpc3RGaWxlcyhwYXRoLCBzdWNjZXNzLCBmYWlsdXJlKTtcblx0fSxcblx0d2lwZURhdGE6IGZ1bmN0aW9uKHN1Y2Nlc3MsIGZhaWx1cmUsIGJhY2tlbmQpIHtcblx0XHRhc3NlcnRJbml0aWFsaXplZCgpO1xuXHRcdHZhciBiZSA9IGdldEJhY2tlbmQoYmFja2VuZCk7XG5cdFx0aWYgKGRlYnVnKSB7IGNvbnNvbGUubG9nKCdDbG91ZFN0b3JhZ2U6ICcgKyBiZS5uYW1lICsgJy53aXBlRGF0YSgpJyk7IH1cblx0XHRiZS53aXBlRGF0YShzdWNjZXNzLCBmYWlsdXJlKTtcblx0fSxcbn07XG5cbmlmICh0eXBlb2YgYW5ndWxhciAhPT0gXCJ1bmRlZmluZWRcIikge1xuXHRjb25zb2xlLmxvZygnQ2xvdWRTdG9yYWdlOiBBbmd1bGFyIGlzIGF2YWlsYWJsZS4gIFJlZ2lzdGVyaW5nIEFuZ3VsYXIgbW9kdWxlLicpO1xuXHRhbmd1bGFyLm1vZHVsZSgnQ2xvdWRTdG9yYWdlJywgW10pLmZhY3RvcnkoJ0Nsb3VkU3RvcmFnZScsIGZ1bmN0aW9uKCR0aW1lb3V0LCAkcSkge1xuXHRcdGZ1bmN0aW9uIG1ha2VQcm9taXNlKGZuLCBhcmdzLCBhc3luYywgaGFzQmFja2VuZCkge1xuXHRcdFx0dmFyIGRlZmVycmVkID0gJHEuZGVmZXIoKTtcblxuXHRcdFx0dmFyIHN1Y2Nlc3MgPSBmdW5jdGlvbihyZXNwb25zZSkge1xuXHRcdFx0XHRpZiAoZGVidWcpIHsgY29uc29sZS5sb2coJ0Nsb3VkU3RvcmFnZTogc3VjY2VzczogJyArIGFuZ3VsYXIudG9Kc29uKHJlc3BvbnNlKSk7IH1cblx0XHRcdFx0aWYgKGFzeW5jKSB7XG5cdFx0XHRcdFx0JHRpbWVvdXQoZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0XHRkZWZlcnJlZC5yZXNvbHZlKHJlc3BvbnNlKTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRkZWZlcnJlZC5yZXNvbHZlKHJlc3BvbnNlKTtcblx0XHRcdFx0fVxuXHRcdFx0fTtcblxuXHRcdFx0dmFyIGZhaWwgPSBmdW5jdGlvbihyZXNwb25zZSkge1xuXHRcdFx0XHRpZiAoZGVidWcpIHsgY29uc29sZS5sb2coJ0Nsb3VkU3RvcmFnZTogZmFpbHVyZTogJyArIGFuZ3VsYXIudG9Kc29uKHJlc3BvbnNlKSk7IH1cblx0XHRcdFx0aWYgKGFzeW5jKSB7XG5cdFx0XHRcdFx0JHRpbWVvdXQoZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0XHRkZWZlcnJlZC5yZWplY3QocmVzcG9uc2UpO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGRlZmVycmVkLnJlamVjdChyZXNwb25zZSk7XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cblx0XHRcdHZhciBiYWNrZW5kO1xuXHRcdFx0aWYgKGhhc0JhY2tlbmQpIHtcblx0XHRcdFx0Ly8gcHVsbCB0aGUgKG9wdGlvbmFsKSBiYWNrZW5kIG9mZiB0aGUgYXJnIGxpc3QsIHNpbmNlIGl0J3MgYWx3YXlzIGxhc3Rcblx0XHRcdFx0YmFja2VuZCA9IGFyZ3MucG9wKCk7XG5cdFx0XHR9XG5cdFx0XHRhcmdzLnB1c2goc3VjY2Vzcyk7XG5cdFx0XHRhcmdzLnB1c2goZmFpbCk7XG5cdFx0XHRpZiAoaGFzQmFja2VuZCkge1xuXHRcdFx0XHRhcmdzLnB1c2goYmFja2VuZCk7XG5cdFx0XHR9XG5cblx0XHRcdGZuLmFwcGx5KENsb3VkU3RvcmFnZSwgYXJncyk7XG5cblx0XHRcdHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xuXHRcdH1cblxuXHRcdHJldHVybiB7XG5cdFx0XHRzZXREZWJ1ZzogZnVuY3Rpb24oZGVidWcpIHtcblx0XHRcdFx0cmV0dXJuIENsb3VkU3RvcmFnZS5zZXREZWJ1ZyhkZWJ1Zyk7XG5cdFx0XHR9LFxuXHRcdFx0c2V0RGVmYXVsdEJhY2tlbmQ6IGZ1bmN0aW9uKGJhY2tlbmQpIHtcblx0XHRcdFx0cmV0dXJuIG1ha2VQcm9taXNlKENsb3VkU3RvcmFnZS5zZXREZWZhdWx0QmFja2VuZCwgW2JhY2tlbmRdKTtcblx0XHRcdH0sXG5cdFx0XHRyZWFkRmlsZTogZnVuY3Rpb24oZmlsZW5hbWUsIGJhY2tlbmQpIHtcblx0XHRcdFx0cmV0dXJuIG1ha2VQcm9taXNlKENsb3VkU3RvcmFnZS5yZWFkRmlsZSwgW2ZpbGVuYW1lLCBiYWNrZW5kXSwgZmFsc2UsIHRydWUpO1xuXHRcdFx0fSxcblx0XHRcdHdyaXRlRmlsZTogZnVuY3Rpb24oZmlsZW5hbWUsIGRhdGEsIGJhY2tlbmQpIHtcblx0XHRcdFx0cmV0dXJuIG1ha2VQcm9taXNlKENsb3VkU3RvcmFnZS53cml0ZUZpbGUsIFtmaWxlbmFtZSwgZGF0YSwgYmFja2VuZF0sIGZhbHNlLCB0cnVlKTtcblx0XHRcdH0sXG5cdFx0XHRyZW1vdmVGaWxlOiBmdW5jdGlvbihmaWxlbmFtZSwgYmFja2VuZCkge1xuXHRcdFx0XHRyZXR1cm4gbWFrZVByb21pc2UoQ2xvdWRTdG9yYWdlLnJlbW92ZUZpbGUsIFtmaWxlbmFtZSwgYmFja2VuZF0sIGZhbHNlLCB0cnVlKTtcblx0XHRcdH0sXG5cdFx0XHRsaXN0RmlsZXM6IGZ1bmN0aW9uKHBhdGgsIGJhY2tlbmQpIHtcblx0XHRcdFx0cmV0dXJuIG1ha2VQcm9taXNlKENsb3VkU3RvcmFnZS5saXN0RmlsZXMsIFtwYXRoLCBiYWNrZW5kXSwgZmFsc2UsIHRydWUpO1xuXHRcdFx0fSxcblx0XHRcdHdpcGVEYXRhOiBmdW5jdGlvbihiYWNrZW5kKSB7XG5cdFx0XHRcdHJldHVybiBtYWtlUHJvbWlzZShDbG91ZFN0b3JhZ2Uud2lwZURhdGEsIFtiYWNrZW5kXSwgZmFsc2UsIHRydWUpO1xuXHRcdFx0fSxcblx0XHR9O1xuXHR9KTtcbn0gZWxzZSB7XG5cdGNvbnNvbGUubG9nKCdDbG91ZFN0b3JhZ2U6IEFuZ3VsYXIgaXMgbm90IGF2YWlsYWJsZS4gIFNraXBwaW5nIEFuZ3VsYXIgc3VwcG9ydC4nKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBDbG91ZFN0b3JhZ2U7XG5cbmlmICghd2luZG93LnBsdWdpbnMpIHtcblx0d2luZG93LnBsdWdpbnMgPSB7fTtcbn1cbmlmICghd2luZG93LnBsdWdpbnMuQ2xvdWRTdG9yYWdlKSB7XG5cdHdpbmRvdy5wbHVnaW5zLkNsb3VkU3RvcmFnZSA9IENsb3VkU3RvcmFnZTtcbn1cbiIsIi8qIGpzaGludCAtVzA5NyAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbi8qIGdsb2JhbCBjb25zb2xlICovXG4vKiBnbG9iYWwgcmVxdWlyZSAqL1xuLyogZ2xvYmFsIHdpbmRvdyAqL1xuXG52YXIgS2V5Y2hhaW4gPSByZXF1aXJlKCdjb20uc2hhenJvbi5jb3Jkb3ZhLnBsdWdpbi5rZXljaGFpbnV0aWwuS2V5Y2hhaW4nKTtcblxuaWYgKHR5cGVvZiBTdHJpbmcucHJvdG90eXBlLnN0YXJ0c1dpdGggIT09ICdmdW5jdGlvbicpIHtcblx0U3RyaW5nLnByb3RvdHlwZS5zdGFydHNXaXRoID0gZnVuY3Rpb24oc3RyKSB7XG5cdFx0cmV0dXJuIHRoaXMubGFzdEluZGV4T2Yoc3RyLCAwKSA9PT0gMDtcblx0fTtcbn1cbmlmICh0eXBlb2YgU3RyaW5nLnByb3RvdHlwZS5lbmRzV2l0aCAhPT0gJ2Z1bmN0aW9uJykge1xuXHRTdHJpbmcucHJvdG90eXBlLmVuZHNXaXRoID0gZnVuY3Rpb24oc3VmZml4KSB7XG5cdFx0cmV0dXJuIHRoaXMuaW5kZXhPZihzdWZmaXgsIHRoaXMubGVuZ3RoIC0gc3VmZml4Lmxlbmd0aCkgIT09IC0xO1xuXHR9O1xufVxuXG5mdW5jdGlvbiBLZXljaGFpbkJhY2tlbmQoKSB7XG5cdHZhciBrYyA9IG5ldyBLZXljaGFpbigpO1xuXHR2YXIgc2VydmljZU5hbWUgPSAnQ29yZG92YUNsb3VkU3RvcmFnZSc7XG5cblx0dmFyIGVuY29kZUtleSA9IGZ1bmN0aW9uKHN0cikge1xuXHRcdHJldHVybiB3aW5kb3cuYnRvYShzdHIpO1xuXHRcdC8qXG5cdFx0cmV0dXJuIHN0clxuXHRcdFx0LnJlcGxhY2UoL1tcXFxcXS9nLCAnXFxcXFxcXFwnKVxuXHRcdFx0LnJlcGxhY2UoL1tcXFwiXS9nLCAnXFxcXFxcXCInKVxuXHRcdFx0LnJlcGxhY2UoL1tcXC9dL2csICdcXFxcLycpXG5cdFx0XHQucmVwbGFjZSgvW1xcYl0vZywgJ1xcXFxiJylcblx0XHRcdC5yZXBsYWNlKC9bXFxmXS9nLCAnXFxcXGYnKVxuXHRcdFx0LnJlcGxhY2UoL1tcXG5dL2csICdcXFxcbicpXG5cdFx0XHQucmVwbGFjZSgvW1xccl0vZywgJ1xcXFxyJylcblx0XHRcdC5yZXBsYWNlKC9bXFx0XS9nLCAnXFxcXHQnKTtcblx0XHQqL1xuICBcdH07XG5cblx0dmFyIGVuY29kZSA9IGZ1bmN0aW9uKHN0cikge1xuXHRcdHJldHVybiBKU09OLnN0cmluZ2lmeShzdHIpO1xuXHR9O1xuXG5cdHZhciBkZWNvZGUgPSBmdW5jdGlvbihzdHIpIHtcblx0XHRyZXR1cm4gSlNPTi5wYXJzZShzdHIpO1xuXHR9O1xuXG5cdHZhciBjYWxsU3VjY2VzcyA9IGZ1bmN0aW9uKGNiLCBkYXRhKSB7XG5cdFx0dmFyIHJldCA9IHsgc3VjY2VzczogdHJ1ZSB9O1xuXHRcdGlmIChkYXRhKSB7XG5cdFx0XHRyZXQuY29udGVudHMgPSBkYXRhO1xuXHRcdH1cblx0XHRjYihyZXQpO1xuXHR9O1xuXHR2YXIgY2FsbEVycm9yID0gZnVuY3Rpb24oY2IsIGVycikge1xuXHRcdHZhciByZXQgPSB7IHN1Y2Nlc3M6IGZhbHNlIH07XG5cdFx0aWYgKGVycikge1xuXHRcdFx0cmV0LmVycm9yID0gZXJyO1xuXHRcdH1cblx0XHRjYihyZXQpO1xuXHR9O1xuXG5cdHZhciBjbGVhckluZGV4ID0gZnVuY3Rpb24oY2IpIHtcblx0XHRrYy5yZW1vdmVGb3JLZXkoZnVuY3Rpb24gc3VjY2VzcyhyZXN1bHQpIHtcblx0XHRcdGNiKHRydWUpO1xuXHRcdH0sIGZ1bmN0aW9uIGZhaWx1cmUoZXJyKSB7XG5cdFx0XHRpZiAoZXJyLmluZGV4T2YoJy0yNTMwMCcpID49IDApIHtcblx0XHRcdFx0Ly8gbm90IGZvdW5kIGVycm9yLCBjb25zaWRlciBpdCBjbGVhcmVkXG5cdFx0XHRcdGNiKHRydWUpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29uc29sZS5sb2coJ0tleWNoYWluQmFja2VuZC5jbGVhckluZGV4OiBXQVJOSU5HOiBmYWlsZWQ6ICcgKyBKU09OLnN0cmluZ2lmeShlcnIpKTtcblx0XHRcdFx0Y2IoZmFsc2UpO1xuXHRcdFx0fVxuXHRcdH0sICdfaW5kZXgnLCBzZXJ2aWNlTmFtZSk7XG5cdH07XG5cdHZhciBnZXRJbmRleCA9IGZ1bmN0aW9uKHMsIGYpIHtcblx0XHRrYy5nZXRGb3JLZXkoZnVuY3Rpb24gc3VjY2VzcyhyZXN1bHQpIHtcblx0XHRcdHMoZGVjb2RlKHJlc3VsdCkpO1xuXHRcdH0sIGZ1bmN0aW9uIGZhaWx1cmUoZXJyKSB7XG5cdFx0XHRjb25zb2xlLmxvZygnS2V5Y2hhaW5CYWNrZW5kLmdldEluZGV4OiBXQVJOSU5HOiBmYWlsZWQ6ICcgKyBKU09OLnN0cmluZ2lmeShlcnIpKTtcblx0XHRcdGYoZXJyKTtcblx0XHR9LCAnX2luZGV4Jywgc2VydmljZU5hbWUpO1xuXHR9O1xuXHR2YXIgdXBkYXRlSW5kZXggPSBmdW5jdGlvbihpbmRleCwgcywgZikge1xuXHRcdGtjLnNldEZvcktleShmdW5jdGlvbiBzdWNjZXNzKCkge1xuXHRcdFx0Ly9jb25zb2xlLmxvZygnS2V5Y2hhaW5CYWNrZW5kLnVwZGF0ZUluZGV4OiAnICsgSlNPTi5zdHJpbmdpZnkoaW5kZXgpKTtcblx0XHRcdHModHJ1ZSk7XG5cdFx0fSwgZnVuY3Rpb24gZmFpbHVyZShlcnIpIHtcblx0XHRcdGNvbnNvbGUubG9nKCdLZXljaGFpbkJhY2tlbmQudXBkYXRlSW5kZXg6IFdBUk5JTkc6IGZhaWxlZDogJyArIEpTT04uc3RyaW5naWZ5KGVycikpO1xuXHRcdFx0ZihlcnIpO1xuXHRcdH0sICdfaW5kZXgnLCBzZXJ2aWNlTmFtZSwgZW5jb2RlKGluZGV4KSk7XG5cdH07XG5cblx0dGhpcy5pc1ZhbGlkID0gZnVuY3Rpb24oKSB7XG5cdFx0aWYgKGtjICYmIGtjLmdldEZvcktleSkge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdH07XG5cblx0dGhpcy5yZWFkRmlsZSA9IGZ1bmN0aW9uKGZpbGVuYW1lLCBzLCBmKSB7XG5cdFx0a2MuZ2V0Rm9yS2V5KGZ1bmN0aW9uIHN1Y2Nlc3MocmVzdWx0KSB7XG5cdFx0XHQvL2NvbnNvbGUubG9nKCdLZXljaGFpbkJhY2tlbmQucmVhZEZpbGU6IHJlYWQgJyArIGZpbGVuYW1lICsgJzogJyArIHJlc3VsdCk7XG5cdFx0XHRjYWxsU3VjY2VzcyhzLCBkZWNvZGUocmVzdWx0KSk7XG5cdFx0fSwgZnVuY3Rpb24gZmFpbHVyZShlcnIpIHtcblx0XHRcdGNvbnNvbGUubG9nKCdLZXljaGFpbkJhY2tlbmQucmVhZEZpbGU6ICcgKyBmaWxlbmFtZSArICcgZmFpbHVyZTogJyArIEpTT04uc3RyaW5naWZ5KGVycikpO1xuXHRcdFx0Y2FsbEVycm9yKGYsIGVycik7XG5cdFx0fSwgZW5jb2RlS2V5KGZpbGVuYW1lKSwgc2VydmljZU5hbWUpO1xuXHR9O1xuXG5cdHRoaXMud3JpdGVGaWxlID0gZnVuY3Rpb24oZmlsZW5hbWUsIGRhdGEsIHMsIGYpIHtcblx0XHRkYXRhID0gZW5jb2RlKGRhdGEpO1xuXG5cdFx0a2Muc2V0Rm9yS2V5KGZ1bmN0aW9uIHN1Y2Nlc3MoKSB7XG5cdFx0XHQvL2NvbnNvbGUubG9nKCdLZXljaGFpbkJhY2tlbmQud3JpdGVGaWxlOiB3cm90ZSAnICsgZmlsZW5hbWUpO1xuXHRcdFx0Z2V0SW5kZXgoZnVuY3Rpb24gc3VjY2VzcyhpbmRleCkge1xuXHRcdFx0XHRpZiAoaW5kZXguaW5kZXhPZihmaWxlbmFtZSkgPT09IC0xKSB7XG5cdFx0XHRcdFx0aW5kZXgucHVzaChmaWxlbmFtZSk7XG5cdFx0XHRcdFx0aW5kZXguc29ydCgpO1xuXHRcdFx0XHRcdHVwZGF0ZUluZGV4KGluZGV4LCBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRcdGNhbGxTdWNjZXNzKHMsIGRhdGEpO1xuXHRcdFx0XHRcdH0sIGZ1bmN0aW9uKGVycikge1xuXHRcdFx0XHRcdFx0Y2FsbEVycm9yKGYsIGVycik7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Y2FsbFN1Y2Nlc3MocywgdHJ1ZSk7XG5cdFx0XHRcdH1cblx0XHRcdH0sIGZ1bmN0aW9uIGZhaWx1cmUoZXJyKSB7XG5cdFx0XHRcdHVwZGF0ZUluZGV4KFtmaWxlbmFtZV0sIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdGNhbGxTdWNjZXNzKHMsIGRhdGEpO1xuXHRcdFx0XHR9LCBmdW5jdGlvbihlcnIpIHtcblx0XHRcdFx0XHRjYWxsRXJyb3IoZiwgZXJyKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHR9LCBmdW5jdGlvbiBmYWlsdXJlKGVycikge1xuXHRcdFx0Y29uc29sZS5sb2coJ0tleWNoYWluQmFja2VuZC53cml0ZUZpbGU6ICcgKyBmaWxlbmFtZSArICcgZmFpbHVyZTogJyArIGVycik7XG5cdFx0XHRjYWxsRXJyb3IoZiwgZXJyKTtcblx0XHR9LCBlbmNvZGVLZXkoZmlsZW5hbWUpLCBzZXJ2aWNlTmFtZSwgZGF0YSk7XG5cdH07XG5cblx0dGhpcy5yZW1vdmVGaWxlID0gZnVuY3Rpb24oZmlsZW5hbWUsIHMsIGYpIHtcblx0XHR2YXIgZG9SZW1vdmUgPSBmdW5jdGlvbigpIHtcblx0XHRcdGtjLnJlbW92ZUZvcktleShmdW5jdGlvbiBzdWNjZXNzKCkge1xuXHRcdFx0XHQvL2NvbnNvbGUubG9nKCdLZXljaGFpbkJhY2tlbmQucmVtb3ZlRmlsZTogcmVtb3ZlZCAnICsgZmlsZW5hbWUpO1xuXHRcdFx0XHRjYWxsU3VjY2VzcyhzLCB0cnVlKTtcblx0XHRcdH0sIGZ1bmN0aW9uIGZhaWx1cmUoZXJyKSB7XG5cdFx0XHRcdGNvbnNvbGUubG9nKCdLZXljaGFpbkJhY2tlbmQucmVtb3ZlRmlsZTogJyArIGZpbGVuYW1lICsgJyBmYWlsdXJlOiAnICsgZXJyKTtcblx0XHRcdFx0Y2FsbEVycm9yKGYsIGVycik7XG5cdFx0XHR9LCBlbmNvZGVLZXkoZmlsZW5hbWUpLCBzZXJ2aWNlTmFtZSk7XG5cdFx0fTtcblxuXHRcdGdldEluZGV4KGZ1bmN0aW9uIHN1Y2Nlc3MoaW5kZXgpIHtcblx0XHRcdHZhciBsb2MgPSBpbmRleC5pbmRleE9mKGZpbGVuYW1lKTtcblx0XHRcdGlmIChsb2MgIT09IC0xKSB7XG5cdFx0XHRcdGluZGV4LnNwbGljZShsb2MsIDEpO1xuXHRcdFx0XHR1cGRhdGVJbmRleChpbmRleCwgZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0ZG9SZW1vdmUoKTtcblx0XHRcdFx0fSwgZnVuY3Rpb24oZXJyKSB7XG5cdFx0XHRcdFx0Y2FsbEVycm9yKGYsIGVycik7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0ZG9SZW1vdmUoKTtcblx0XHRcdH1cblx0XHR9LCBmdW5jdGlvbiBmYWlsdXJlKGVycikge1xuXHRcdFx0Y2FsbEVycm9yKGYsIGVycik7XG5cdFx0fSk7XG5cdH07XG5cblx0dGhpcy5saXN0RmlsZXMgPSBmdW5jdGlvbihwYXRoLCBzLCBmKSB7XG5cdFx0Z2V0SW5kZXgoZnVuY3Rpb24gc3VjY2VzcyhpbmRleCkge1xuXHRcdFx0dmFyIGksIGxlbiA9IGluZGV4Lmxlbmd0aCwgZW50cnksIHJldCA9IFtdLCBwcmVmaXggPSBwYXRoO1xuXHRcdFx0aWYgKCFwcmVmaXguZW5kc1dpdGgoJy8nKSkge1xuXHRcdFx0XHRwcmVmaXggPSBwcmVmaXggKyAnLyc7XG5cdFx0XHR9XG5cblx0XHRcdHZhciByZXBsYWNlID0gbmV3IFJlZ0V4cCgnXicgKyBwcmVmaXgucmVwbGFjZSgvWy4qKz9eJHt9KCl8W1xcXVxcXFxdL2csIFwiXFxcXCQmXCIpKTtcblx0XHRcdGZvciAoaT0wOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdFx0ZW50cnkgPSBpbmRleFtpXTtcblx0XHRcdFx0aWYgKHBhdGggPT09ICcnICYmICFlbnRyeS5zdGFydHNXaXRoKCcvJykpIHtcblx0XHRcdFx0XHRyZXQucHVzaChlbnRyeSk7XG5cdFx0XHRcdH0gZWxzZSBpZiAoZW50cnkuc3RhcnRzV2l0aChwcmVmaXgpKSB7XG5cdFx0XHRcdFx0cmV0LnB1c2goZW50cnkucmVwbGFjZShyZXBsYWNlLCAnJykpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdC8vY29uc29sZS5sb2coJ0tleWNoYWluQmFja2VuZC5saXN0RmlsZXM6IGxpc3RGaWxlcygnK3BhdGgrJyk6IGJlZm9yZSA9ICcgKyBKU09OLnN0cmluZ2lmeShpbmRleCwgdHJ1ZSkpO1xuXHRcdFx0Ly9jb25zb2xlLmxvZygnS2V5Y2hhaW5CYWNrZW5kLmxpc3RGaWxlczogbGlzdEZpbGVzKCcrcGF0aCsnKTogYWZ0ZXIgID0gJyArIEpTT04uc3RyaW5naWZ5KHJldCwgdHJ1ZSkpO1xuXHRcdFx0Y2FsbFN1Y2Nlc3MocywgcmV0KTtcblx0XHR9LCBmdW5jdGlvbiBmYWlsdXJlKGVycikge1xuXHRcdFx0Y2FsbEVycm9yKGYsIGVycik7XG5cdFx0fSk7XG5cdH07XG5cblx0dGhpcy53aXBlRGF0YSA9IGZ1bmN0aW9uKHMsIGYpIHtcblx0XHR2YXIgY2xlYXIgPSBmdW5jdGlvbihpbmRleCkge1xuXHRcdFx0dmFyIGksIGxlbiwgZW50cnk7XG5cblx0XHRcdHZhciBwZW5kaW5nVHJhbnNhY3Rpb25zID0ge307XG5cblx0XHRcdHZhciByZW1vdmVJdGVtID0gZnVuY3Rpb24oaXRlbSkge1xuXHRcdFx0XHQvL2NvbnNvbGUubG9nKCdLZXljaGFpbkJhY2tlbmQud2lwZURhdGE6IHJlbW92aW5nICcgKyBpdGVtKTtcblx0XHRcdFx0cGVuZGluZ1RyYW5zYWN0aW9uc1tpdGVtXSA9IHVuZGVmaW5lZDtcblx0XHRcdFx0a2MucmVtb3ZlRm9yS2V5KGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdHBlbmRpbmdUcmFuc2FjdGlvbnNbaXRlbV0gPSB0cnVlO1xuXHRcdFx0XHR9LCBmdW5jdGlvbiBlcnIoZSkge1xuXHRcdFx0XHRcdGNvbnNvbGUubG9nKCdLZXljaGFpbkJhY2tlbmQud2lwZURhdGE6IFdBUk5JTkc6IHVuYWJsZSB0byByZW1vdmUgJyArIGl0ZW0gKyAnOiAnICsgZSk7XG5cdFx0XHRcdFx0cGVuZGluZ1RyYW5zYWN0aW9uc1tpdGVtXSA9IGZhbHNlO1xuXHRcdFx0XHR9LCBlbmNvZGVLZXkoaXRlbSksIHNlcnZpY2VOYW1lKTtcblx0XHRcdH07XG5cblx0XHRcdHZhciB0aW1lb3V0SUQ7XG5cdFx0XHR2YXIgd2FpdEZvckNvbXBsZXRpb24gPSBmdW5jdGlvbigpIHtcblx0XHRcdFx0dmFyIGZpbmlzaGVkID0gdHJ1ZSxcblx0XHRcdFx0XHRmYWlsZWQgPSBbXSxcblx0XHRcdFx0XHRrZXlzID0gT2JqZWN0LmtleXMocGVuZGluZ1RyYW5zYWN0aW9ucyksXG5cdFx0XHRcdFx0aSwgbGVuID0ga2V5cy5sZW5ndGgsIGZpbGVuYW1lO1xuXG5cdFx0XHRcdGZvciAoaT0wOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdFx0XHRmaWxlbmFtZSA9IGtleXNbaV07XG5cdFx0XHRcdFx0aWYgKHBlbmRpbmdUcmFuc2FjdGlvbnNbZmlsZW5hbWVdID09PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRcdGZpbmlzaGVkID0gZmFsc2U7XG5cblx0XHRcdFx0XHR9IGVsc2UgaWYgKCFwZW5kaW5nVHJhbnNhY3Rpb25zW2ZpbGVuYW1lXSkge1xuXHRcdFx0XHRcdFx0ZmFpbGVkLnB1c2goZmlsZW5hbWUpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmICh0aW1lb3V0SUQpIHtcblx0XHRcdFx0XHR3aW5kb3cuY2xlYXJUaW1lb3V0KHRpbWVvdXRJRCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKGZpbmlzaGVkKSB7XG5cdFx0XHRcdFx0aWYgKGZhaWxlZC5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdFx0XHRjYWxsRXJyb3IoZiwgJ0ZhaWxlZCB0byByZW1vdmUgZmlsZXM6ICcgKyBmYWlsZWQuam9pbignLCAnKSk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdGNhbGxTdWNjZXNzKHMpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR3aW5kb3cuc2V0VGltZW91dCh3YWl0Rm9yQ29tcGxldGlvbiwgMTAwKTtcblx0XHRcdFx0fVxuXHRcdFx0fTtcblxuXHRcdFx0Y2xlYXJJbmRleChmdW5jdGlvbiBjbGVhckNhbGxiYWNrKHN1Y2Nlc3MpIHtcblx0XHRcdFx0Ly9jb25zb2xlLmxvZygnS2V5Y2hhaW5CYWNrZW5kLndpcGVEYXRhOiBjbGVhckluZGV4OiAnICsgc3VjY2Vzcyk7XG5cdFx0XHRcdGlmIChzdWNjZXNzKSB7XG5cdFx0XHRcdFx0aWYgKGluZGV4KSB7XG5cdFx0XHRcdFx0XHRsZW4gPSBpbmRleC5sZW5ndGg7XG5cdFx0XHRcdFx0XHRmb3IgKGk9MDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0XHRcdFx0XHRcdGVudHJ5ID0gaW5kZXhbaV07XG5cdFx0XHRcdFx0XHRcdHJlbW92ZUl0ZW0oZW50cnkpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHR3YWl0Rm9yQ29tcGxldGlvbigpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGNhbGxFcnJvcihmKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fTtcblxuXHRcdGdldEluZGV4KGZ1bmN0aW9uIHN1Y2Nlc3MoaW5kZXgpIHtcblx0XHRcdC8vY29uc29sZS5sb2coJ0tleWNoYWluQmFja2VuZC53aXBlRGF0YTogJyArIEpTT04uc3RyaW5naWZ5KGluZGV4KSk7XG5cdFx0XHRjbGVhcihpbmRleCk7XG5cdFx0fSwgZnVuY3Rpb24gZmFpbHVyZShlcnIpIHtcblx0XHRcdGNvbnNvbGUubG9nKCdLZXljaGFpbkJhY2tlbmQud2lwZURhdGE6IFdBUk5JTkc6ICcgKyBlcnIpO1xuXHRcdFx0Y2xlYXIoKTtcblx0XHR9KTtcblx0fTtcbn1cblxuS2V5Y2hhaW5CYWNrZW5kLnByb3RvdHlwZS5uYW1lID0gJ2tleWNoYWluJztcbiIsIi8qIGpzaGludCAtVzA5NyAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbi8qIGdsb2JhbCByZXF1aXJlICovXG5cbnZhciBleGVjID0gcmVxdWlyZSgnY29yZG92YS9leGVjJyk7XG5cbmZ1bmN0aW9uIExvY2FsQmFja2VuZCgpIHt9XG5Mb2NhbEJhY2tlbmQucHJvdG90eXBlLm5hbWUgPSAnbG9jYWwnO1xuTG9jYWxCYWNrZW5kLnByb3RvdHlwZS5pc1ZhbGlkID0gZnVuY3Rpb24oKSB7XG5cdHJldHVybiB0cnVlO1xufTtcbkxvY2FsQmFja2VuZC5wcm90b3R5cGUucmVhZEZpbGUgPSBmdW5jdGlvbihmaWxlbmFtZSwgc3VjY2VzcywgZmFpbHVyZSkge1xuXHRleGVjKHN1Y2Nlc3MsIGZhaWx1cmUsICdDbG91ZFN0b3JhZ2UnLCAnb25tc0dldEpzb25GaWxlQ29udGVudHMnLCBbZmlsZW5hbWVdKTtcbn07XG5Mb2NhbEJhY2tlbmQucHJvdG90eXBlLndyaXRlRmlsZSA9IGZ1bmN0aW9uKGZpbGVuYW1lLCBkYXRhLCBzdWNjZXNzLCBmYWlsdXJlKSB7XG5cdGV4ZWMoc3VjY2VzcywgZmFpbHVyZSwgJ0Nsb3VkU3RvcmFnZScsICdvbm1zU2V0SnNvbkZpbGVDb250ZW50cycsIFtmaWxlbmFtZSwgZGF0YV0pO1xufTtcbkxvY2FsQmFja2VuZC5wcm90b3R5cGUucmVtb3ZlRmlsZSA9IGZ1bmN0aW9uKGZpbGVuYW1lLCBzdWNjZXNzLCBmYWlsdXJlKSB7XG5cdGV4ZWMoc3VjY2VzcywgZmFpbHVyZSwgJ0Nsb3VkU3RvcmFnZScsICdvbm1zUmVtb3ZlSnNvbkZpbGUnLCBbZmlsZW5hbWVdKTtcbn07XG5Mb2NhbEJhY2tlbmQucHJvdG90eXBlLmxpc3RGaWxlcyA9IGZ1bmN0aW9uKHBhdGgsIHN1Y2Nlc3MsIGZhaWx1cmUpIHtcblx0ZXhlYyhzdWNjZXNzLCBmYWlsdXJlLCAnQ2xvdWRTdG9yYWdlJywgJ29ubXNMaXN0SnNvbkZpbGVzJywgW3BhdGhdKTtcbn07XG5Mb2NhbEJhY2tlbmQucHJvdG90eXBlLndpcGVEYXRhID0gZnVuY3Rpb24oc3VjY2VzcywgZmFpbHVyZSkge1xuXHRleGVjKHN1Y2Nlc3MsIGZhaWx1cmUsICdDbG91ZFN0b3JhZ2UnLCAnb25tc1dpcGUnLCBbXSk7XG59O1xuIiwiLyoganNoaW50IC1XMDk3ICovXG5cbid1c2Ugc3RyaWN0JztcblxuLyogZ2xvYmFsIHJlcXVpcmUgKi9cblxudmFyIGV4ZWMgPSByZXF1aXJlKCdjb3Jkb3ZhL2V4ZWMnKTtcblxuZnVuY3Rpb24gTWVtb3J5QmFja2VuZCgpIHtcblx0dGhpcy5kYXRhID0ge307XG59XG5NZW1vcnlCYWNrZW5kLnByb3RvdHlwZS5uYW1lID0gJ21lbW9yeSc7XG5NZW1vcnlCYWNrZW5kLnByb3RvdHlwZS5pc1ZhbGlkID0gZnVuY3Rpb24oKSB7XG5cdHJldHVybiB0cnVlO1xufTtcbk1lbW9yeUJhY2tlbmQucHJvdG90eXBlLnJlYWRGaWxlID0gZnVuY3Rpb24oZmlsZW5hbWUsIHN1Y2Nlc3MsIGZhaWx1cmUpIHtcblx0dmFyIHNlbGYgPSB0aGlzO1xuXHRpZiAoc2VsZi5kYXRhW2ZpbGVuYW1lXSAmJiBzZWxmLmRhdGFbZmlsZW5hbWVdICE9PSBcIlxcMFwiKSB7XG5cdFx0c3VjY2Vzcyh7XG5cdFx0XHRzdWNjZXNzOiB0cnVlLFxuXHRcdFx0Y29udGVudHM6IHNlbGYuZGF0YVtmaWxlbmFtZV1cblx0XHR9KTtcblx0fSBlbHNlIHtcblx0XHRmYWlsdXJlKHtcblx0XHRcdHN1Y2Nlc3M6IGZhbHNlLFxuXHRcdFx0cmVhc29uOiAnRmlsZSBkb2VzIG5vdCBleGlzdC4nLFxuXHRcdFx0ZXJyb3I6ICdGaWxlIFwiJyArIGZpbGVuYW1lICsgJ1wiIGRvZXMgbm90IGV4aXN0LicsXG5cdFx0XHRjb250ZW50czogdW5kZWZpbmVkXG5cdFx0fSk7XG5cdH1cbn07XG5NZW1vcnlCYWNrZW5kLnByb3RvdHlwZS53cml0ZUZpbGUgPSBmdW5jdGlvbihmaWxlbmFtZSwgZGF0YSwgc3VjY2VzcywgZmFpbHVyZSkge1xuXHR2YXIgc2VsZiA9IHRoaXM7XG5cdHNlbGYuZGF0YVtmaWxlbmFtZV0gPSBkYXRhO1xuXHRzdWNjZXNzKHtcblx0XHRzdWNjZXNzOiB0cnVlLFxuXHRcdGNvbnRlbnRzOiBkYXRhXG5cdH0pO1xufTtcbk1lbW9yeUJhY2tlbmQucHJvdG90eXBlLnJlbW92ZUZpbGUgPSBmdW5jdGlvbihmaWxlbmFtZSwgc3VjY2VzcywgZmFpbHVyZSkge1xuXHR2YXIgc2VsZiA9IHRoaXMsXG5cdFx0b2xkRGF0YTtcblx0aWYgKHNlbGYuZGF0YVtmaWxlbmFtZV0pIHtcblx0XHRvbGREYXRhID0gc2VsZi5kYXRhW2ZpbGVuYW1lXTtcblx0XHRzZWxmLmRhdGFbZmlsZW5hbWVdID0gXCJcXDBcIjtcblx0fVxuXHRzdWNjZXNzKHtcblx0XHRzdWNjZXNzOiB0cnVlLFxuXHRcdGNvbnRlbnRzOiBvbGREYXRhXG5cdH0pO1xufTtcbk1lbW9yeUJhY2tlbmQucHJvdG90eXBlLmxpc3RGaWxlcyA9IGZ1bmN0aW9uKHBhdGgsIHN1Y2Nlc3MsIGZhaWx1cmUpIHtcblx0aWYgKHBhdGggJiYgcGF0aC5sZW5ndGggPiAwICYmIHBhdGguY2hhckF0KHBhdGgubGVuZ3RoLTEpICE9PSAnLycpIHtcblx0XHRwYXRoICs9ICcvJztcblx0fVxuXHR2YXIgc2VsZiA9IHRoaXMsXG5cdFx0ZmlsZSxcblx0XHRmb3VuZCA9IGZhbHNlLFxuXHRcdGZpbGVzID0gT2JqZWN0LmtleXMoc2VsZi5kYXRhKSxcblx0XHRyZXQgPSBbXTtcblxuXHRmb3IgKHZhciBpPTAsIGxlbj1maWxlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuXHRcdGZpbGUgPSBmaWxlc1tpXTtcblx0XHRpZiAoZmlsZS5pbmRleE9mKHBhdGgpID09PSAwKSB7XG5cdFx0XHRmb3VuZCA9IHRydWU7XG5cdFx0XHRpZiAoc2VsZi5kYXRhW2ZpbGVdICE9PSBcIlxcMFwiKSB7XG5cdFx0XHRcdHJldC5wdXNoKGZpbGUuc3Vic3RyKHBhdGgubGVuZ3RoKSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0aWYgKCFmb3VuZCkge1xuXHRcdGZhaWx1cmUoe1xuXHRcdFx0c3VjY2VzczogZmFsc2UsXG5cdFx0XHRyZWFzb246ICdEaXJlY3RvcnkgZG9lcyBub3QgZXhpc3QuJyxcblx0XHRcdGVycm9yOiAnRGlyZWN0b3J5IFwiJyArIHBhdGggKyAnXCIgZG9lcyBub3QgZXhpc3QuJ1xuXHRcdH0pO1xuXHR9IGVsc2Uge1xuXHRcdHN1Y2Nlc3Moe1xuXHRcdFx0c3VjY2VzczogdHJ1ZSxcblx0XHRcdGNvbnRlbnRzOiByZXRcblx0XHR9KTtcblx0fVxufTtcbk1lbW9yeUJhY2tlbmQucHJvdG90eXBlLndpcGVEYXRhID0gZnVuY3Rpb24oc3VjY2VzcywgZmFpbHVyZSkge1xuXHR2YXIgc2VsZiA9IHRoaXM7XG5cdHNlbGYuZGF0YSA9IHt9O1xuXHRzdWNjZXNzKHtcblx0XHRzdWNjZXNzOiB0cnVlLFxuXHRcdGNvbnRlbnRzOiB1bmRlZmluZWRcblx0fSk7XG59O1xuIl0sInNvdXJjZVJvb3QiOiIvc291cmNlLyJ9