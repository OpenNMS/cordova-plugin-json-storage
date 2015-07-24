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

	console.log('attempted backends: ' + JSON.stringify(attemptedBackends));
	for (i=0; i < len; i++) {
		be = attemptedBackends[i];
		if (be && be.name) {
			console.log('CloudStorage: Checking plugin "' + be.name + '".');
			if (be.isValid && be.isValid()) {
				console.log('CloudStorage: Backend "' + be.name + '" is valid.');
				backends[be.name] = be;
			} else {
				console.log('CloudStorage: Backend "' + be.name + '" is not valid.');
			}
		}
	}

	if (backends.keychain) {
		defaultBackend = 'keychain';
	} else {
		defaultBackend = 'local';
	}
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
	setDebug: function(d) {
		debug = !!d;
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

	var getIndex = function(cb) {
		kc.getForKey(function success(result) {
			cb(decode(result));
		}, function failure(err) {
			console.log('KeychainBackend: WARNING: getIndex failed. ' + JSON.stringify(err));
			cb([]);
		}, '_index', serviceName);
	};
	var updateIndex = function(index, s, f) {
		kc.setForKey(function success() {
			//console.log('KeychainBackend: updated index: ' + JSON.stringify(index));
			s(true);
		}, function failure(err) {
			console.log('KeychainBackend: WARNING: updateIndex failed. ' + JSON.stringify(err));
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
			//console.log('KeychainBackend: read ' + filename + ': ' + result);
			callSuccess(s, decode(result));
		}, function failure(err) {
			console.log('KeychainBackend: ' + filename + ' failure: ' + JSON.stringify(err));
			callError(f, err);
		}, encodeKey(filename), serviceName);
	};

	this.writeFile = function(filename, data, s, f) {
		data = encode(data);

		kc.setForKey(function success() {
			//console.log('KeychainBackend: wrote ' + filename);
			getIndex(function callback(index) {
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
			});
		}, function failure(err) {
			console.log('KeychainBackend: ' + filename + ' failure: ' + err);
			callError(f, err);
		}, encodeKey(filename), serviceName, data);
	};

	this.removeFile = function(filename, s, f) {
		var doRemove = function() {
			kc.removeForKey(function success() {
				//console.log('KeychainBackend: removed ' + filename);
				callSuccess(s, true);
			}, function failure(err) {
				console.log('KeychainBackend: ' + filename + ' failure: ' + err);
				callError(f, err);
			}, encodeKey(filename), serviceName);
		};

		getIndex(function callback(index) {
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
		});
	};

	this.listFiles = function(path, s, f) {
		getIndex(function callback(index) {
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

			//console.log('KeychainBackend: listFiles('+path+'): before = ' + JSON.stringify(index, true));
			//console.log('KeychainBackend: listFiles('+path+'): after  = ' + JSON.stringify(ret, true));
			callSuccess(s, ret);
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

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImNsb3VkLXN0b3JhZ2UuanMiLCJiYWNrZW5kcy9rZXljaGFpbi5qcyIsImJhY2tlbmRzL2xvY2FsLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDcExBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDOUtBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiY2xvdWQtc3RvcmFnZS5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qIGpzaGludCAtVzA5NyAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbi8qIGdsb2JhbCBhbmd1bGFyICovXG4vKiBnbG9iYWwgY29uc29sZSAqL1xuLyogZ2xvYmFsIGRvY3VtZW50ICovXG4vKiBnbG9iYWwgbW9kdWxlICovXG4vKiBnbG9iYWwgcmVxdWlyZSAqL1xuLyogZ2xvYmFsIHdpbmRvdyAqL1xuXG4vKiBnbG9iYWwgS2V5Y2hhaW5CYWNrZW5kICovXG4vKiBnbG9iYWwgTG9jYWxCYWNrZW5kICovXG5cbnZhciBkZWJ1ZyA9IGZhbHNlO1xudmFyIGJhY2tlbmRzID0ge307XG52YXIgZGVmYXVsdEJhY2tlbmQ7XG5cbnZhciBfaW5pdGlhbGl6ZWQgPSBmYWxzZTtcbmZ1bmN0aW9uIGFzc2VydEluaXRpYWxpemVkKCkge1xuXHRpZiAoX2luaXRpYWxpemVkKSB7IHJldHVybjsgfVxuXHRfaW5pdGlhbGl6ZWQgPSB0cnVlO1xuXG5cdGNvbnNvbGUubG9nKCdDbG91ZFN0b3JhZ2U6IEluaXRpYWxpemluZy4nKTtcblxuXHR2YXIgYXR0ZW1wdGVkQmFja2VuZHMgPSBbXG5cdFx0bmV3IEtleWNoYWluQmFja2VuZCgpLFxuXHRcdG5ldyBMb2NhbEJhY2tlbmQoKVxuXHRdLCBpLCBsZW4gPSBhdHRlbXB0ZWRCYWNrZW5kcy5sZW5ndGgsIGJlO1xuXG5cdGNvbnNvbGUubG9nKCdhdHRlbXB0ZWQgYmFja2VuZHM6ICcgKyBKU09OLnN0cmluZ2lmeShhdHRlbXB0ZWRCYWNrZW5kcykpO1xuXHRmb3IgKGk9MDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0YmUgPSBhdHRlbXB0ZWRCYWNrZW5kc1tpXTtcblx0XHRpZiAoYmUgJiYgYmUubmFtZSkge1xuXHRcdFx0Y29uc29sZS5sb2coJ0Nsb3VkU3RvcmFnZTogQ2hlY2tpbmcgcGx1Z2luIFwiJyArIGJlLm5hbWUgKyAnXCIuJyk7XG5cdFx0XHRpZiAoYmUuaXNWYWxpZCAmJiBiZS5pc1ZhbGlkKCkpIHtcblx0XHRcdFx0Y29uc29sZS5sb2coJ0Nsb3VkU3RvcmFnZTogQmFja2VuZCBcIicgKyBiZS5uYW1lICsgJ1wiIGlzIHZhbGlkLicpO1xuXHRcdFx0XHRiYWNrZW5kc1tiZS5uYW1lXSA9IGJlO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29uc29sZS5sb2coJ0Nsb3VkU3RvcmFnZTogQmFja2VuZCBcIicgKyBiZS5uYW1lICsgJ1wiIGlzIG5vdCB2YWxpZC4nKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRpZiAoYmFja2VuZHMua2V5Y2hhaW4pIHtcblx0XHRkZWZhdWx0QmFja2VuZCA9ICdrZXljaGFpbic7XG5cdH0gZWxzZSB7XG5cdFx0ZGVmYXVsdEJhY2tlbmQgPSAnbG9jYWwnO1xuXHR9XG59XG5cbnZhciBnZXRCYWNrZW5kID0gZnVuY3Rpb24oYikge1xuXHRpZiAoYmFja2VuZHNbYl0pIHtcblx0XHRyZXR1cm4gYmFja2VuZHNbYl07XG5cdH0gZWxzZSBpZiAoYiAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0Y29uc29sZS5sb2coJ0Nsb3VkU3RvcmFnZTogVW5rbm93biBiYWNrZW5kIFwiJyArIGIgKyAnXCI6IGZhbGxpbmcgYmFjayB0byBkZWZhdWx0IChcIicgKyBkZWZhdWx0QmFja2VuZCArICdcIiknKTtcblx0fVxuXHRyZXR1cm4gYmFja2VuZHNbZGVmYXVsdEJhY2tlbmRdO1xufTtcblxudmFyIENsb3VkU3RvcmFnZSA9IHtcblx0c2V0RGVidWc6IGZ1bmN0aW9uKGQpIHtcblx0XHRkZWJ1ZyA9ICEhZDtcblx0fSxcblx0c2V0RGVmYXVsdEJhY2tlbmQ6IGZ1bmN0aW9uKGIsIHN1Y2Nlc3MsIGZhaWx1cmUpIHtcblx0XHRhc3NlcnRJbml0aWFsaXplZCgpO1xuXHRcdGlmIChiYWNrZW5kc1tiXSkge1xuXHRcdFx0aWYgKGRlYnVnKSB7IGNvbnNvbGUubG9nKCdDbG91ZFN0b3JhZ2U6IHNldHRpbmcgYmFja2VuZCB0byAnICsgYik7IH1cblx0XHRcdGRlZmF1bHRCYWNrZW5kID0gYjtcblx0XHRcdHN1Y2Nlc3MoYik7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHZhciBlcnJvciA9ICdVbmtub3duIGJhY2tlbmQgXCInICsgYiArICdcIic7XG5cdFx0XHRjb25zb2xlLmxvZygnQ2xvdWRTdG9yYWdlOiBXQVJOSU5HOiAnICsgZXJyb3IpO1xuXHRcdFx0Y29uc29sZS5sb2coJ0Nsb3VkU3RvcmFnZTogYXZhaWxhYmxlIGJhY2tlbmRzOiAnICsgT2JqZWN0LmtleXMoYmFja2VuZHMpLmpvaW4oJywgJykpO1xuXHRcdFx0ZmFpbHVyZShlcnJvcik7XG5cdFx0fVxuXHR9LFxuXHRyZWFkRmlsZTogZnVuY3Rpb24oZmlsZW5hbWUsIHN1Y2Nlc3MsIGZhaWx1cmUsIGJhY2tlbmQpIHtcblx0XHRhc3NlcnRJbml0aWFsaXplZCgpO1xuXHRcdHZhciBiZSA9IGdldEJhY2tlbmQoYmFja2VuZCk7XG5cdFx0aWYgKGRlYnVnKSB7IGNvbnNvbGUubG9nKCdDbG91ZFN0b3JhZ2U6ICcgKyBiZS5uYW1lICsgJy5yZWFkRmlsZSgnICsgZmlsZW5hbWUgKyAnKScpOyB9XG5cdFx0YmUucmVhZEZpbGUoZmlsZW5hbWUsIHN1Y2Nlc3MsIGZhaWx1cmUpO1xuXHR9LFxuXHR3cml0ZUZpbGU6IGZ1bmN0aW9uKGZpbGVuYW1lLCBkYXRhLCBzdWNjZXNzLCBmYWlsdXJlLCBiYWNrZW5kKSB7XG5cdFx0YXNzZXJ0SW5pdGlhbGl6ZWQoKTtcblx0XHR2YXIgYmUgPSBnZXRCYWNrZW5kKGJhY2tlbmQpO1xuXHRcdGlmIChkZWJ1ZykgeyBjb25zb2xlLmxvZygnQ2xvdWRTdG9yYWdlOiAnICsgYmUubmFtZSArICcud3JpdGVGaWxlKCcgKyBmaWxlbmFtZSArICcsIC4uLiknKTsgfVxuXHRcdGJlLndyaXRlRmlsZShmaWxlbmFtZSwgZGF0YSwgc3VjY2VzcywgZmFpbHVyZSk7XG5cdH0sXG5cdHJlbW92ZUZpbGU6IGZ1bmN0aW9uKGZpbGVuYW1lLCBzdWNjZXNzLCBmYWlsdXJlLCBiYWNrZW5kKSB7XG5cdFx0YXNzZXJ0SW5pdGlhbGl6ZWQoKTtcblx0XHR2YXIgYmUgPSBnZXRCYWNrZW5kKGJhY2tlbmQpO1xuXHRcdGlmIChkZWJ1ZykgeyBjb25zb2xlLmxvZygnQ2xvdWRTdG9yYWdlOiAnICsgYmUubmFtZSArICcucmVtb3ZlRmlsZSgnICsgZmlsZW5hbWUgKyAnKScpOyB9XG5cdFx0YmUucmVtb3ZlRmlsZShmaWxlbmFtZSwgc3VjY2VzcywgZmFpbHVyZSk7XG5cdH0sXG5cdGxpc3RGaWxlczogZnVuY3Rpb24ocGF0aCwgc3VjY2VzcywgZmFpbHVyZSwgYmFja2VuZCkge1xuXHRcdGFzc2VydEluaXRpYWxpemVkKCk7XG5cdFx0dmFyIGJlID0gZ2V0QmFja2VuZChiYWNrZW5kKTtcblx0XHRpZiAoZGVidWcpIHsgY29uc29sZS5sb2coJ0Nsb3VkU3RvcmFnZTogJyArIGJlLm5hbWUgKyAnLmxpc3RGaWxlcygnICsgcGF0aCArICcpJyk7IH1cblx0XHRiZS5saXN0RmlsZXMocGF0aCwgc3VjY2VzcywgZmFpbHVyZSk7XG5cdH0sXG59O1xuXG5pZiAodHlwZW9mIGFuZ3VsYXIgIT09IFwidW5kZWZpbmVkXCIpIHtcblx0Y29uc29sZS5sb2coJ0Nsb3VkU3RvcmFnZTogQW5ndWxhciBpcyBhdmFpbGFibGUuICBSZWdpc3RlcmluZyBBbmd1bGFyIG1vZHVsZS4nKTtcblx0YW5ndWxhci5tb2R1bGUoJ0Nsb3VkU3RvcmFnZScsIFtdKS5mYWN0b3J5KCdDbG91ZFN0b3JhZ2UnLCBmdW5jdGlvbigkdGltZW91dCwgJHEpIHtcblx0XHRmdW5jdGlvbiBtYWtlUHJvbWlzZShmbiwgYXJncywgYXN5bmMsIGhhc0JhY2tlbmQpIHtcblx0XHRcdHZhciBkZWZlcnJlZCA9ICRxLmRlZmVyKCk7XG5cblx0XHRcdHZhciBzdWNjZXNzID0gZnVuY3Rpb24ocmVzcG9uc2UpIHtcblx0XHRcdFx0aWYgKGRlYnVnKSB7IGNvbnNvbGUubG9nKCdDbG91ZFN0b3JhZ2U6IHN1Y2Nlc3M6ICcgKyBhbmd1bGFyLnRvSnNvbihyZXNwb25zZSkpOyB9XG5cdFx0XHRcdGlmIChhc3luYykge1xuXHRcdFx0XHRcdCR0aW1lb3V0KGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdFx0ZGVmZXJyZWQucmVzb2x2ZShyZXNwb25zZSk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0ZGVmZXJyZWQucmVzb2x2ZShyZXNwb25zZSk7XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cblx0XHRcdHZhciBmYWlsID0gZnVuY3Rpb24ocmVzcG9uc2UpIHtcblx0XHRcdFx0aWYgKGRlYnVnKSB7IGNvbnNvbGUubG9nKCdDbG91ZFN0b3JhZ2U6IGZhaWx1cmU6ICcgKyBhbmd1bGFyLnRvSnNvbihyZXNwb25zZSkpOyB9XG5cdFx0XHRcdGlmIChhc3luYykge1xuXHRcdFx0XHRcdCR0aW1lb3V0KGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdFx0ZGVmZXJyZWQucmVqZWN0KHJlc3BvbnNlKTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRkZWZlcnJlZC5yZWplY3QocmVzcG9uc2UpO1xuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXG5cdFx0XHR2YXIgYmFja2VuZDtcblx0XHRcdGlmIChoYXNCYWNrZW5kKSB7XG5cdFx0XHRcdC8vIHB1bGwgdGhlIChvcHRpb25hbCkgYmFja2VuZCBvZmYgdGhlIGFyZyBsaXN0LCBzaW5jZSBpdCdzIGFsd2F5cyBsYXN0XG5cdFx0XHRcdGJhY2tlbmQgPSBhcmdzLnBvcCgpO1xuXHRcdFx0fVxuXHRcdFx0YXJncy5wdXNoKHN1Y2Nlc3MpO1xuXHRcdFx0YXJncy5wdXNoKGZhaWwpO1xuXHRcdFx0aWYgKGhhc0JhY2tlbmQpIHtcblx0XHRcdFx0YXJncy5wdXNoKGJhY2tlbmQpO1xuXHRcdFx0fVxuXG5cdFx0XHRmbi5hcHBseShDbG91ZFN0b3JhZ2UsIGFyZ3MpO1xuXG5cdFx0XHRyZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcblx0XHR9XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0c2V0RGVidWc6IGZ1bmN0aW9uKGRlYnVnKSB7XG5cdFx0XHRcdHJldHVybiBDbG91ZFN0b3JhZ2Uuc2V0RGVidWcoZGVidWcpO1xuXHRcdFx0fSxcblx0XHRcdHNldERlZmF1bHRCYWNrZW5kOiBmdW5jdGlvbihiYWNrZW5kKSB7XG5cdFx0XHRcdHJldHVybiBtYWtlUHJvbWlzZShDbG91ZFN0b3JhZ2Uuc2V0RGVmYXVsdEJhY2tlbmQsIFtiYWNrZW5kXSk7XG5cdFx0XHR9LFxuXHRcdFx0cmVhZEZpbGU6IGZ1bmN0aW9uKGZpbGVuYW1lLCBiYWNrZW5kKSB7XG5cdFx0XHRcdHJldHVybiBtYWtlUHJvbWlzZShDbG91ZFN0b3JhZ2UucmVhZEZpbGUsIFtmaWxlbmFtZSwgYmFja2VuZF0sIGZhbHNlLCB0cnVlKTtcblx0XHRcdH0sXG5cdFx0XHR3cml0ZUZpbGU6IGZ1bmN0aW9uKGZpbGVuYW1lLCBkYXRhLCBiYWNrZW5kKSB7XG5cdFx0XHRcdHJldHVybiBtYWtlUHJvbWlzZShDbG91ZFN0b3JhZ2Uud3JpdGVGaWxlLCBbZmlsZW5hbWUsIGRhdGEsIGJhY2tlbmRdLCBmYWxzZSwgdHJ1ZSk7XG5cdFx0XHR9LFxuXHRcdFx0cmVtb3ZlRmlsZTogZnVuY3Rpb24oZmlsZW5hbWUsIGJhY2tlbmQpIHtcblx0XHRcdFx0cmV0dXJuIG1ha2VQcm9taXNlKENsb3VkU3RvcmFnZS5yZW1vdmVGaWxlLCBbZmlsZW5hbWUsIGJhY2tlbmRdLCBmYWxzZSwgdHJ1ZSk7XG5cdFx0XHR9LFxuXHRcdFx0bGlzdEZpbGVzOiBmdW5jdGlvbihwYXRoLCBiYWNrZW5kKSB7XG5cdFx0XHRcdHJldHVybiBtYWtlUHJvbWlzZShDbG91ZFN0b3JhZ2UubGlzdEZpbGVzLCBbcGF0aCwgYmFja2VuZF0sIGZhbHNlLCB0cnVlKTtcblx0XHRcdH0sXG5cdFx0fTtcblx0fSk7XG59IGVsc2Uge1xuXHRjb25zb2xlLmxvZygnQ2xvdWRTdG9yYWdlOiBBbmd1bGFyIGlzIG5vdCBhdmFpbGFibGUuICBTa2lwcGluZyBBbmd1bGFyIHN1cHBvcnQuJyk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gQ2xvdWRTdG9yYWdlO1xuXG5pZiAoIXdpbmRvdy5wbHVnaW5zKSB7XG5cdHdpbmRvdy5wbHVnaW5zID0ge307XG59XG5pZiAoIXdpbmRvdy5wbHVnaW5zLkNsb3VkU3RvcmFnZSkge1xuXHR3aW5kb3cucGx1Z2lucy5DbG91ZFN0b3JhZ2UgPSBDbG91ZFN0b3JhZ2U7XG59XG4iLCIvKiBqc2hpbnQgLVcwOTcgKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG4vKiBnbG9iYWwgY29uc29sZSAqL1xuLyogZ2xvYmFsIHJlcXVpcmUgKi9cbi8qIGdsb2JhbCB3aW5kb3cgKi9cblxudmFyIEtleWNoYWluID0gcmVxdWlyZSgnY29tLnNoYXpyb24uY29yZG92YS5wbHVnaW4ua2V5Y2hhaW51dGlsLktleWNoYWluJyk7XG5cbmlmICh0eXBlb2YgU3RyaW5nLnByb3RvdHlwZS5zdGFydHNXaXRoICE9PSAnZnVuY3Rpb24nKSB7XG5cdFN0cmluZy5wcm90b3R5cGUuc3RhcnRzV2l0aCA9IGZ1bmN0aW9uKHN0cikge1xuXHRcdHJldHVybiB0aGlzLmxhc3RJbmRleE9mKHN0ciwgMCkgPT09IDA7XG5cdH07XG59XG5pZiAodHlwZW9mIFN0cmluZy5wcm90b3R5cGUuZW5kc1dpdGggIT09ICdmdW5jdGlvbicpIHtcblx0U3RyaW5nLnByb3RvdHlwZS5lbmRzV2l0aCA9IGZ1bmN0aW9uKHN1ZmZpeCkge1xuXHRcdHJldHVybiB0aGlzLmluZGV4T2Yoc3VmZml4LCB0aGlzLmxlbmd0aCAtIHN1ZmZpeC5sZW5ndGgpICE9PSAtMTtcblx0fTtcbn1cblxuZnVuY3Rpb24gS2V5Y2hhaW5CYWNrZW5kKCkge1xuXHR2YXIga2MgPSBuZXcgS2V5Y2hhaW4oKTtcblx0dmFyIHNlcnZpY2VOYW1lID0gJ0NvcmRvdmFDbG91ZFN0b3JhZ2UnO1xuXG5cdHZhciBlbmNvZGVLZXkgPSBmdW5jdGlvbihzdHIpIHtcblx0XHRyZXR1cm4gd2luZG93LmJ0b2Eoc3RyKTtcblx0XHQvKlxuXHRcdHJldHVybiBzdHJcblx0XHRcdC5yZXBsYWNlKC9bXFxcXF0vZywgJ1xcXFxcXFxcJylcblx0XHRcdC5yZXBsYWNlKC9bXFxcIl0vZywgJ1xcXFxcXFwiJylcblx0XHRcdC5yZXBsYWNlKC9bXFwvXS9nLCAnXFxcXC8nKVxuXHRcdFx0LnJlcGxhY2UoL1tcXGJdL2csICdcXFxcYicpXG5cdFx0XHQucmVwbGFjZSgvW1xcZl0vZywgJ1xcXFxmJylcblx0XHRcdC5yZXBsYWNlKC9bXFxuXS9nLCAnXFxcXG4nKVxuXHRcdFx0LnJlcGxhY2UoL1tcXHJdL2csICdcXFxccicpXG5cdFx0XHQucmVwbGFjZSgvW1xcdF0vZywgJ1xcXFx0Jyk7XG5cdFx0Ki9cbiAgXHR9O1xuXG5cdHZhciBlbmNvZGUgPSBmdW5jdGlvbihzdHIpIHtcblx0XHRyZXR1cm4gSlNPTi5zdHJpbmdpZnkoc3RyKTtcblx0fTtcblxuXHR2YXIgZGVjb2RlID0gZnVuY3Rpb24oc3RyKSB7XG5cdFx0cmV0dXJuIEpTT04ucGFyc2Uoc3RyKTtcblx0fTtcblxuXHR2YXIgY2FsbFN1Y2Nlc3MgPSBmdW5jdGlvbihjYiwgZGF0YSkge1xuXHRcdHZhciByZXQgPSB7IHN1Y2Nlc3M6IHRydWUgfTtcblx0XHRpZiAoZGF0YSkge1xuXHRcdFx0cmV0LmNvbnRlbnRzID0gZGF0YTtcblx0XHR9XG5cdFx0Y2IocmV0KTtcblx0fTtcblx0dmFyIGNhbGxFcnJvciA9IGZ1bmN0aW9uKGNiLCBlcnIpIHtcblx0XHR2YXIgcmV0ID0geyBzdWNjZXNzOiBmYWxzZSB9O1xuXHRcdGlmIChlcnIpIHtcblx0XHRcdHJldC5lcnJvciA9IGVycjtcblx0XHR9XG5cdFx0Y2IocmV0KTtcblx0fTtcblxuXHR2YXIgZ2V0SW5kZXggPSBmdW5jdGlvbihjYikge1xuXHRcdGtjLmdldEZvcktleShmdW5jdGlvbiBzdWNjZXNzKHJlc3VsdCkge1xuXHRcdFx0Y2IoZGVjb2RlKHJlc3VsdCkpO1xuXHRcdH0sIGZ1bmN0aW9uIGZhaWx1cmUoZXJyKSB7XG5cdFx0XHRjb25zb2xlLmxvZygnS2V5Y2hhaW5CYWNrZW5kOiBXQVJOSU5HOiBnZXRJbmRleCBmYWlsZWQuICcgKyBKU09OLnN0cmluZ2lmeShlcnIpKTtcblx0XHRcdGNiKFtdKTtcblx0XHR9LCAnX2luZGV4Jywgc2VydmljZU5hbWUpO1xuXHR9O1xuXHR2YXIgdXBkYXRlSW5kZXggPSBmdW5jdGlvbihpbmRleCwgcywgZikge1xuXHRcdGtjLnNldEZvcktleShmdW5jdGlvbiBzdWNjZXNzKCkge1xuXHRcdFx0Ly9jb25zb2xlLmxvZygnS2V5Y2hhaW5CYWNrZW5kOiB1cGRhdGVkIGluZGV4OiAnICsgSlNPTi5zdHJpbmdpZnkoaW5kZXgpKTtcblx0XHRcdHModHJ1ZSk7XG5cdFx0fSwgZnVuY3Rpb24gZmFpbHVyZShlcnIpIHtcblx0XHRcdGNvbnNvbGUubG9nKCdLZXljaGFpbkJhY2tlbmQ6IFdBUk5JTkc6IHVwZGF0ZUluZGV4IGZhaWxlZC4gJyArIEpTT04uc3RyaW5naWZ5KGVycikpO1xuXHRcdFx0ZihlcnIpO1xuXHRcdH0sICdfaW5kZXgnLCBzZXJ2aWNlTmFtZSwgZW5jb2RlKGluZGV4KSk7XG5cdH07XG5cblx0dGhpcy5pc1ZhbGlkID0gZnVuY3Rpb24oKSB7XG5cdFx0aWYgKGtjICYmIGtjLmdldEZvcktleSkge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdH07XG5cblx0dGhpcy5yZWFkRmlsZSA9IGZ1bmN0aW9uKGZpbGVuYW1lLCBzLCBmKSB7XG5cdFx0a2MuZ2V0Rm9yS2V5KGZ1bmN0aW9uIHN1Y2Nlc3MocmVzdWx0KSB7XG5cdFx0XHQvL2NvbnNvbGUubG9nKCdLZXljaGFpbkJhY2tlbmQ6IHJlYWQgJyArIGZpbGVuYW1lICsgJzogJyArIHJlc3VsdCk7XG5cdFx0XHRjYWxsU3VjY2VzcyhzLCBkZWNvZGUocmVzdWx0KSk7XG5cdFx0fSwgZnVuY3Rpb24gZmFpbHVyZShlcnIpIHtcblx0XHRcdGNvbnNvbGUubG9nKCdLZXljaGFpbkJhY2tlbmQ6ICcgKyBmaWxlbmFtZSArICcgZmFpbHVyZTogJyArIEpTT04uc3RyaW5naWZ5KGVycikpO1xuXHRcdFx0Y2FsbEVycm9yKGYsIGVycik7XG5cdFx0fSwgZW5jb2RlS2V5KGZpbGVuYW1lKSwgc2VydmljZU5hbWUpO1xuXHR9O1xuXG5cdHRoaXMud3JpdGVGaWxlID0gZnVuY3Rpb24oZmlsZW5hbWUsIGRhdGEsIHMsIGYpIHtcblx0XHRkYXRhID0gZW5jb2RlKGRhdGEpO1xuXG5cdFx0a2Muc2V0Rm9yS2V5KGZ1bmN0aW9uIHN1Y2Nlc3MoKSB7XG5cdFx0XHQvL2NvbnNvbGUubG9nKCdLZXljaGFpbkJhY2tlbmQ6IHdyb3RlICcgKyBmaWxlbmFtZSk7XG5cdFx0XHRnZXRJbmRleChmdW5jdGlvbiBjYWxsYmFjayhpbmRleCkge1xuXHRcdFx0XHRpZiAoaW5kZXguaW5kZXhPZihmaWxlbmFtZSkgPT09IC0xKSB7XG5cdFx0XHRcdFx0aW5kZXgucHVzaChmaWxlbmFtZSk7XG5cdFx0XHRcdFx0aW5kZXguc29ydCgpO1xuXHRcdFx0XHRcdHVwZGF0ZUluZGV4KGluZGV4LCBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRcdGNhbGxTdWNjZXNzKHMsIGRhdGEpO1xuXHRcdFx0XHRcdH0sIGZ1bmN0aW9uKGVycikge1xuXHRcdFx0XHRcdFx0Y2FsbEVycm9yKGYsIGVycik7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Y2FsbFN1Y2Nlc3MocywgdHJ1ZSk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH0sIGZ1bmN0aW9uIGZhaWx1cmUoZXJyKSB7XG5cdFx0XHRjb25zb2xlLmxvZygnS2V5Y2hhaW5CYWNrZW5kOiAnICsgZmlsZW5hbWUgKyAnIGZhaWx1cmU6ICcgKyBlcnIpO1xuXHRcdFx0Y2FsbEVycm9yKGYsIGVycik7XG5cdFx0fSwgZW5jb2RlS2V5KGZpbGVuYW1lKSwgc2VydmljZU5hbWUsIGRhdGEpO1xuXHR9O1xuXG5cdHRoaXMucmVtb3ZlRmlsZSA9IGZ1bmN0aW9uKGZpbGVuYW1lLCBzLCBmKSB7XG5cdFx0dmFyIGRvUmVtb3ZlID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRrYy5yZW1vdmVGb3JLZXkoZnVuY3Rpb24gc3VjY2VzcygpIHtcblx0XHRcdFx0Ly9jb25zb2xlLmxvZygnS2V5Y2hhaW5CYWNrZW5kOiByZW1vdmVkICcgKyBmaWxlbmFtZSk7XG5cdFx0XHRcdGNhbGxTdWNjZXNzKHMsIHRydWUpO1xuXHRcdFx0fSwgZnVuY3Rpb24gZmFpbHVyZShlcnIpIHtcblx0XHRcdFx0Y29uc29sZS5sb2coJ0tleWNoYWluQmFja2VuZDogJyArIGZpbGVuYW1lICsgJyBmYWlsdXJlOiAnICsgZXJyKTtcblx0XHRcdFx0Y2FsbEVycm9yKGYsIGVycik7XG5cdFx0XHR9LCBlbmNvZGVLZXkoZmlsZW5hbWUpLCBzZXJ2aWNlTmFtZSk7XG5cdFx0fTtcblxuXHRcdGdldEluZGV4KGZ1bmN0aW9uIGNhbGxiYWNrKGluZGV4KSB7XG5cdFx0XHR2YXIgbG9jID0gaW5kZXguaW5kZXhPZihmaWxlbmFtZSk7XG5cdFx0XHRpZiAobG9jICE9PSAtMSkge1xuXHRcdFx0XHRpbmRleC5zcGxpY2UobG9jLCAxKTtcblx0XHRcdFx0dXBkYXRlSW5kZXgoaW5kZXgsIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdGRvUmVtb3ZlKCk7XG5cdFx0XHRcdH0sIGZ1bmN0aW9uKGVycikge1xuXHRcdFx0XHRcdGNhbGxFcnJvcihmLCBlcnIpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGRvUmVtb3ZlKCk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH07XG5cblx0dGhpcy5saXN0RmlsZXMgPSBmdW5jdGlvbihwYXRoLCBzLCBmKSB7XG5cdFx0Z2V0SW5kZXgoZnVuY3Rpb24gY2FsbGJhY2soaW5kZXgpIHtcblx0XHRcdHZhciBpLCBsZW4gPSBpbmRleC5sZW5ndGgsIGVudHJ5LCByZXQgPSBbXSwgcHJlZml4ID0gcGF0aDtcblx0XHRcdGlmICghcHJlZml4LmVuZHNXaXRoKCcvJykpIHtcblx0XHRcdFx0cHJlZml4ID0gcHJlZml4ICsgJy8nO1xuXHRcdFx0fVxuXG5cdFx0XHR2YXIgcmVwbGFjZSA9IG5ldyBSZWdFeHAoJ14nICsgcHJlZml4LnJlcGxhY2UoL1suKis/XiR7fSgpfFtcXF1cXFxcXS9nLCBcIlxcXFwkJlwiKSk7XG5cdFx0XHRmb3IgKGk9MDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0XHRcdGVudHJ5ID0gaW5kZXhbaV07XG5cdFx0XHRcdGlmIChwYXRoID09PSAnJyAmJiAhZW50cnkuc3RhcnRzV2l0aCgnLycpKSB7XG5cdFx0XHRcdFx0cmV0LnB1c2goZW50cnkpO1xuXHRcdFx0XHR9IGVsc2UgaWYgKGVudHJ5LnN0YXJ0c1dpdGgocHJlZml4KSkge1xuXHRcdFx0XHRcdHJldC5wdXNoKGVudHJ5LnJlcGxhY2UocmVwbGFjZSwgJycpKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvL2NvbnNvbGUubG9nKCdLZXljaGFpbkJhY2tlbmQ6IGxpc3RGaWxlcygnK3BhdGgrJyk6IGJlZm9yZSA9ICcgKyBKU09OLnN0cmluZ2lmeShpbmRleCwgdHJ1ZSkpO1xuXHRcdFx0Ly9jb25zb2xlLmxvZygnS2V5Y2hhaW5CYWNrZW5kOiBsaXN0RmlsZXMoJytwYXRoKycpOiBhZnRlciAgPSAnICsgSlNPTi5zdHJpbmdpZnkocmV0LCB0cnVlKSk7XG5cdFx0XHRjYWxsU3VjY2VzcyhzLCByZXQpO1xuXHRcdH0pO1xuXHR9O1xufVxuXG5LZXljaGFpbkJhY2tlbmQucHJvdG90eXBlLm5hbWUgPSAna2V5Y2hhaW4nO1xuIiwiLyoganNoaW50IC1XMDk3ICovXG5cbid1c2Ugc3RyaWN0JztcblxuLyogZ2xvYmFsIHJlcXVpcmUgKi9cblxudmFyIGV4ZWMgPSByZXF1aXJlKCdjb3Jkb3ZhL2V4ZWMnKTtcblxuZnVuY3Rpb24gTG9jYWxCYWNrZW5kKCkge31cbkxvY2FsQmFja2VuZC5wcm90b3R5cGUubmFtZSA9ICdsb2NhbCc7XG5Mb2NhbEJhY2tlbmQucHJvdG90eXBlLmlzVmFsaWQgPSBmdW5jdGlvbigpIHtcblx0cmV0dXJuIHRydWU7XG59O1xuTG9jYWxCYWNrZW5kLnByb3RvdHlwZS5yZWFkRmlsZSA9IGZ1bmN0aW9uKGZpbGVuYW1lLCBzdWNjZXNzLCBmYWlsdXJlKSB7XG5cdGV4ZWMoc3VjY2VzcywgZmFpbHVyZSwgJ0Nsb3VkU3RvcmFnZScsICdvbm1zR2V0SnNvbkZpbGVDb250ZW50cycsIFtmaWxlbmFtZV0pO1xufTtcbkxvY2FsQmFja2VuZC5wcm90b3R5cGUud3JpdGVGaWxlID0gZnVuY3Rpb24oZmlsZW5hbWUsIGRhdGEsIHN1Y2Nlc3MsIGZhaWx1cmUpIHtcblx0ZXhlYyhzdWNjZXNzLCBmYWlsdXJlLCAnQ2xvdWRTdG9yYWdlJywgJ29ubXNTZXRKc29uRmlsZUNvbnRlbnRzJywgW2ZpbGVuYW1lLCBkYXRhXSk7XG59O1xuTG9jYWxCYWNrZW5kLnByb3RvdHlwZS5yZW1vdmVGaWxlID0gZnVuY3Rpb24oZmlsZW5hbWUsIHN1Y2Nlc3MsIGZhaWx1cmUpIHtcblx0ZXhlYyhzdWNjZXNzLCBmYWlsdXJlLCAnQ2xvdWRTdG9yYWdlJywgJ29ubXNSZW1vdmVKc29uRmlsZScsIFtmaWxlbmFtZV0pO1xufTtcbkxvY2FsQmFja2VuZC5wcm90b3R5cGUubGlzdEZpbGVzID0gZnVuY3Rpb24ocGF0aCwgc3VjY2VzcywgZmFpbHVyZSkge1xuXHRleGVjKHN1Y2Nlc3MsIGZhaWx1cmUsICdDbG91ZFN0b3JhZ2UnLCAnb25tc0xpc3RKc29uRmlsZXMnLCBbcGF0aF0pO1xufTtcbiJdLCJzb3VyY2VSb290IjoiL3NvdXJjZS8ifQ==