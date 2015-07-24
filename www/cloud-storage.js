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
var backend;

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
				console.log('CloudStorage: Backend "' + be.name + '"" is valid.');
				backends[be.name] = be;
			} else {
				console.log('CloudStorage: Backend "' + be.name + '"" is not valid.');
			}
		}
	}

	if (backends.keychain) {
		backend = 'keychain';
	} else {
		backend = 'local';
	}
}

var CloudStorage = {
	setDebug: function(d) {
		debug = !!d;
	},
	setBackend: function(b, success, failure) {
		assertInitialized();
		if (backends[b]) {
			if (debug) { console.log('CloudStorage: setting backend to ' + b); }
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
		if (debug) { console.log('CloudStorage: ' + backend + '.readFile(' + filename + ')'); }
		backends[backend].readFile(filename, success, failure);
	},
	writeFile: function(filename, data, success, failure) {
		assertInitialized();
		if (debug) { console.log('CloudStorage: ' + backend + '.writeFile(' + filename + ', ...)'); }
		backends[backend].writeFile(filename, data, success, failure);
	},
	removeFile: function(filename, success, failure) {
		assertInitialized();
		if (debug) { console.log('CloudStorage: ' + backend + '.removeFile(' + filename + ')'); }
		backends[backend].removeFile(filename, success, failure);
	},
	listFiles: function(path, success, failure) {
		assertInitialized();
		if (debug) { console.log('CloudStorage: ' + backend + '.listFiles(' + path + ')'); }
		backends[backend].listFiles(path, success, failure);
	},
};

if (typeof angular !== "undefined") {
	console.log('CloudStorage: Angular is available.  Registering Angular module.');
	angular.module('CloudStorage', []).factory('CloudStorage', function($timeout, $q) {
		function makePromise(fn, args, async) {
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

			args.push(success);
			args.push(fail);

			fn.apply(CloudStorage, args);

			return deferred.promise;
		}

		return {
			setDebug: function(debug) {
				return CloudStorage.setDebug(debug);
			},
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
			console.log('KeychainBackend: updated index: ' + JSON.stringify(index));
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
			console.log('KeychainBackend: read ' + filename + ': ' + result);
			callSuccess(s, decode(result));
		}, function failure(err) {
			console.log('KeychainBackend: ' + filename + ' failure: ' + JSON.stringify(err));
			callError(f, err);
		}, encodeKey(filename), serviceName);
	};

	this.writeFile = function(filename, data, s, f) {
		data = encode(data);

		kc.setForKey(function success() {
			console.log('KeychainBackend: wrote ' + filename);
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
				console.log('KeychainBackend: removed ' + filename);
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

			console.log('KeychainBackend: listFiles('+path+'): before = ' + JSON.stringify(index, true));
			console.log('KeychainBackend: listFiles('+path+'): after  = ' + JSON.stringify(ret, true));
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

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImNsb3VkLXN0b3JhZ2UuanMiLCJiYWNrZW5kcy9rZXljaGFpbi5qcyIsImJhY2tlbmRzL2xvY2FsLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDL0pBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDOUtBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiY2xvdWQtc3RvcmFnZS5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qIGpzaGludCAtVzA5NyAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbi8qIGdsb2JhbCBhbmd1bGFyICovXG4vKiBnbG9iYWwgY29uc29sZSAqL1xuLyogZ2xvYmFsIGRvY3VtZW50ICovXG4vKiBnbG9iYWwgbW9kdWxlICovXG4vKiBnbG9iYWwgcmVxdWlyZSAqL1xuLyogZ2xvYmFsIHdpbmRvdyAqL1xuXG4vKiBnbG9iYWwgS2V5Y2hhaW5CYWNrZW5kICovXG4vKiBnbG9iYWwgTG9jYWxCYWNrZW5kICovXG5cbnZhciBkZWJ1ZyA9IGZhbHNlO1xudmFyIGJhY2tlbmRzID0ge307XG52YXIgYmFja2VuZDtcblxudmFyIF9pbml0aWFsaXplZCA9IGZhbHNlO1xuZnVuY3Rpb24gYXNzZXJ0SW5pdGlhbGl6ZWQoKSB7XG5cdGlmIChfaW5pdGlhbGl6ZWQpIHsgcmV0dXJuOyB9XG5cdF9pbml0aWFsaXplZCA9IHRydWU7XG5cblx0Y29uc29sZS5sb2coJ0Nsb3VkU3RvcmFnZTogSW5pdGlhbGl6aW5nLicpO1xuXG5cdHZhciBhdHRlbXB0ZWRCYWNrZW5kcyA9IFtcblx0XHRuZXcgS2V5Y2hhaW5CYWNrZW5kKCksXG5cdFx0bmV3IExvY2FsQmFja2VuZCgpXG5cdF0sIGksIGxlbiA9IGF0dGVtcHRlZEJhY2tlbmRzLmxlbmd0aCwgYmU7XG5cblx0Y29uc29sZS5sb2coJ2F0dGVtcHRlZCBiYWNrZW5kczogJyArIEpTT04uc3RyaW5naWZ5KGF0dGVtcHRlZEJhY2tlbmRzKSk7XG5cdGZvciAoaT0wOyBpIDwgbGVuOyBpKyspIHtcblx0XHRiZSA9IGF0dGVtcHRlZEJhY2tlbmRzW2ldO1xuXHRcdGlmIChiZSAmJiBiZS5uYW1lKSB7XG5cdFx0XHRjb25zb2xlLmxvZygnQ2xvdWRTdG9yYWdlOiBDaGVja2luZyBwbHVnaW4gXCInICsgYmUubmFtZSArICdcIi4nKTtcblx0XHRcdGlmIChiZS5pc1ZhbGlkICYmIGJlLmlzVmFsaWQoKSkge1xuXHRcdFx0XHRjb25zb2xlLmxvZygnQ2xvdWRTdG9yYWdlOiBCYWNrZW5kIFwiJyArIGJlLm5hbWUgKyAnXCJcIiBpcyB2YWxpZC4nKTtcblx0XHRcdFx0YmFja2VuZHNbYmUubmFtZV0gPSBiZTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnNvbGUubG9nKCdDbG91ZFN0b3JhZ2U6IEJhY2tlbmQgXCInICsgYmUubmFtZSArICdcIlwiIGlzIG5vdCB2YWxpZC4nKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRpZiAoYmFja2VuZHMua2V5Y2hhaW4pIHtcblx0XHRiYWNrZW5kID0gJ2tleWNoYWluJztcblx0fSBlbHNlIHtcblx0XHRiYWNrZW5kID0gJ2xvY2FsJztcblx0fVxufVxuXG52YXIgQ2xvdWRTdG9yYWdlID0ge1xuXHRzZXREZWJ1ZzogZnVuY3Rpb24oZCkge1xuXHRcdGRlYnVnID0gISFkO1xuXHR9LFxuXHRzZXRCYWNrZW5kOiBmdW5jdGlvbihiLCBzdWNjZXNzLCBmYWlsdXJlKSB7XG5cdFx0YXNzZXJ0SW5pdGlhbGl6ZWQoKTtcblx0XHRpZiAoYmFja2VuZHNbYl0pIHtcblx0XHRcdGlmIChkZWJ1ZykgeyBjb25zb2xlLmxvZygnQ2xvdWRTdG9yYWdlOiBzZXR0aW5nIGJhY2tlbmQgdG8gJyArIGIpOyB9XG5cdFx0XHRiYWNrZW5kID0gYjtcblx0XHRcdHN1Y2Nlc3MoYik7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHZhciBlcnJvciA9ICdVbmtub3duIGJhY2tlbmQgXCInICsgYiArICdcIic7XG5cdFx0XHRjb25zb2xlLmxvZygnQ2xvdWRTdG9yYWdlOiBXQVJOSU5HOiAnICsgZXJyb3IpO1xuXHRcdFx0Y29uc29sZS5sb2coJ0Nsb3VkU3RvcmFnZTogYXZhaWxhYmxlIGJhY2tlbmRzOiAnICsgT2JqZWN0LmtleXMoYmFja2VuZHMpLmpvaW4oJywgJykpO1xuXHRcdFx0ZmFpbHVyZShlcnJvcik7XG5cdFx0fVxuXHR9LFxuXHRyZWFkRmlsZTogZnVuY3Rpb24oZmlsZW5hbWUsIHN1Y2Nlc3MsIGZhaWx1cmUpIHtcblx0XHRhc3NlcnRJbml0aWFsaXplZCgpO1xuXHRcdGlmIChkZWJ1ZykgeyBjb25zb2xlLmxvZygnQ2xvdWRTdG9yYWdlOiAnICsgYmFja2VuZCArICcucmVhZEZpbGUoJyArIGZpbGVuYW1lICsgJyknKTsgfVxuXHRcdGJhY2tlbmRzW2JhY2tlbmRdLnJlYWRGaWxlKGZpbGVuYW1lLCBzdWNjZXNzLCBmYWlsdXJlKTtcblx0fSxcblx0d3JpdGVGaWxlOiBmdW5jdGlvbihmaWxlbmFtZSwgZGF0YSwgc3VjY2VzcywgZmFpbHVyZSkge1xuXHRcdGFzc2VydEluaXRpYWxpemVkKCk7XG5cdFx0aWYgKGRlYnVnKSB7IGNvbnNvbGUubG9nKCdDbG91ZFN0b3JhZ2U6ICcgKyBiYWNrZW5kICsgJy53cml0ZUZpbGUoJyArIGZpbGVuYW1lICsgJywgLi4uKScpOyB9XG5cdFx0YmFja2VuZHNbYmFja2VuZF0ud3JpdGVGaWxlKGZpbGVuYW1lLCBkYXRhLCBzdWNjZXNzLCBmYWlsdXJlKTtcblx0fSxcblx0cmVtb3ZlRmlsZTogZnVuY3Rpb24oZmlsZW5hbWUsIHN1Y2Nlc3MsIGZhaWx1cmUpIHtcblx0XHRhc3NlcnRJbml0aWFsaXplZCgpO1xuXHRcdGlmIChkZWJ1ZykgeyBjb25zb2xlLmxvZygnQ2xvdWRTdG9yYWdlOiAnICsgYmFja2VuZCArICcucmVtb3ZlRmlsZSgnICsgZmlsZW5hbWUgKyAnKScpOyB9XG5cdFx0YmFja2VuZHNbYmFja2VuZF0ucmVtb3ZlRmlsZShmaWxlbmFtZSwgc3VjY2VzcywgZmFpbHVyZSk7XG5cdH0sXG5cdGxpc3RGaWxlczogZnVuY3Rpb24ocGF0aCwgc3VjY2VzcywgZmFpbHVyZSkge1xuXHRcdGFzc2VydEluaXRpYWxpemVkKCk7XG5cdFx0aWYgKGRlYnVnKSB7IGNvbnNvbGUubG9nKCdDbG91ZFN0b3JhZ2U6ICcgKyBiYWNrZW5kICsgJy5saXN0RmlsZXMoJyArIHBhdGggKyAnKScpOyB9XG5cdFx0YmFja2VuZHNbYmFja2VuZF0ubGlzdEZpbGVzKHBhdGgsIHN1Y2Nlc3MsIGZhaWx1cmUpO1xuXHR9LFxufTtcblxuaWYgKHR5cGVvZiBhbmd1bGFyICE9PSBcInVuZGVmaW5lZFwiKSB7XG5cdGNvbnNvbGUubG9nKCdDbG91ZFN0b3JhZ2U6IEFuZ3VsYXIgaXMgYXZhaWxhYmxlLiAgUmVnaXN0ZXJpbmcgQW5ndWxhciBtb2R1bGUuJyk7XG5cdGFuZ3VsYXIubW9kdWxlKCdDbG91ZFN0b3JhZ2UnLCBbXSkuZmFjdG9yeSgnQ2xvdWRTdG9yYWdlJywgZnVuY3Rpb24oJHRpbWVvdXQsICRxKSB7XG5cdFx0ZnVuY3Rpb24gbWFrZVByb21pc2UoZm4sIGFyZ3MsIGFzeW5jKSB7XG5cdFx0XHR2YXIgZGVmZXJyZWQgPSAkcS5kZWZlcigpO1xuXG5cdFx0XHR2YXIgc3VjY2VzcyA9IGZ1bmN0aW9uKHJlc3BvbnNlKSB7XG5cdFx0XHRcdGlmIChkZWJ1ZykgeyBjb25zb2xlLmxvZygnQ2xvdWRTdG9yYWdlOiBzdWNjZXNzOiAnICsgYW5ndWxhci50b0pzb24ocmVzcG9uc2UpKTsgfVxuXHRcdFx0XHRpZiAoYXN5bmMpIHtcblx0XHRcdFx0XHQkdGltZW91dChmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRcdGRlZmVycmVkLnJlc29sdmUocmVzcG9uc2UpO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGRlZmVycmVkLnJlc29sdmUocmVzcG9uc2UpO1xuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXG5cdFx0XHR2YXIgZmFpbCA9IGZ1bmN0aW9uKHJlc3BvbnNlKSB7XG5cdFx0XHRcdGlmIChkZWJ1ZykgeyBjb25zb2xlLmxvZygnQ2xvdWRTdG9yYWdlOiBmYWlsdXJlOiAnICsgYW5ndWxhci50b0pzb24ocmVzcG9uc2UpKTsgfVxuXHRcdFx0XHRpZiAoYXN5bmMpIHtcblx0XHRcdFx0XHQkdGltZW91dChmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRcdGRlZmVycmVkLnJlamVjdChyZXNwb25zZSk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0ZGVmZXJyZWQucmVqZWN0KHJlc3BvbnNlKTtcblx0XHRcdFx0fVxuXHRcdFx0fTtcblxuXHRcdFx0YXJncy5wdXNoKHN1Y2Nlc3MpO1xuXHRcdFx0YXJncy5wdXNoKGZhaWwpO1xuXG5cdFx0XHRmbi5hcHBseShDbG91ZFN0b3JhZ2UsIGFyZ3MpO1xuXG5cdFx0XHRyZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcblx0XHR9XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0c2V0RGVidWc6IGZ1bmN0aW9uKGRlYnVnKSB7XG5cdFx0XHRcdHJldHVybiBDbG91ZFN0b3JhZ2Uuc2V0RGVidWcoZGVidWcpO1xuXHRcdFx0fSxcblx0XHRcdHNldEJhY2tlbmQ6IGZ1bmN0aW9uKGJhY2tlbmQpIHtcblx0XHRcdFx0cmV0dXJuIG1ha2VQcm9taXNlKENsb3VkU3RvcmFnZS5zZXRCYWNrZW5kLCBbYmFja2VuZF0pO1xuXHRcdFx0fSxcblx0XHRcdHJlYWRGaWxlOiBmdW5jdGlvbihmaWxlbmFtZSkge1xuXHRcdFx0XHRyZXR1cm4gbWFrZVByb21pc2UoQ2xvdWRTdG9yYWdlLnJlYWRGaWxlLCBbZmlsZW5hbWVdKTtcblx0XHRcdH0sXG5cdFx0XHR3cml0ZUZpbGU6IGZ1bmN0aW9uKGZpbGVuYW1lLCBkYXRhKSB7XG5cdFx0XHRcdHJldHVybiBtYWtlUHJvbWlzZShDbG91ZFN0b3JhZ2Uud3JpdGVGaWxlLCBbZmlsZW5hbWUsIGRhdGFdKTtcblx0XHRcdH0sXG5cdFx0XHRyZW1vdmVGaWxlOiBmdW5jdGlvbihmaWxlbmFtZSkge1xuXHRcdFx0XHRyZXR1cm4gbWFrZVByb21pc2UoQ2xvdWRTdG9yYWdlLnJlbW92ZUZpbGUsIFtmaWxlbmFtZV0pO1xuXHRcdFx0fSxcblx0XHRcdGxpc3RGaWxlczogZnVuY3Rpb24ocGF0aCkge1xuXHRcdFx0XHRyZXR1cm4gbWFrZVByb21pc2UoQ2xvdWRTdG9yYWdlLmxpc3RGaWxlcywgW3BhdGhdKTtcblx0XHRcdH0sXG5cdFx0fTtcblx0fSk7XG59IGVsc2Uge1xuXHRjb25zb2xlLmxvZygnQ2xvdWRTdG9yYWdlOiBBbmd1bGFyIGlzIG5vdCBhdmFpbGFibGUuICBTa2lwcGluZyBBbmd1bGFyIHN1cHBvcnQuJyk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gQ2xvdWRTdG9yYWdlO1xuXG5pZiAoIXdpbmRvdy5wbHVnaW5zKSB7XG5cdHdpbmRvdy5wbHVnaW5zID0ge307XG59XG5pZiAoIXdpbmRvdy5wbHVnaW5zLkNsb3VkU3RvcmFnZSkge1xuXHR3aW5kb3cucGx1Z2lucy5DbG91ZFN0b3JhZ2UgPSBDbG91ZFN0b3JhZ2U7XG59XG4iLCIvKiBqc2hpbnQgLVcwOTcgKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG4vKiBnbG9iYWwgY29uc29sZSAqL1xuLyogZ2xvYmFsIHJlcXVpcmUgKi9cbi8qIGdsb2JhbCB3aW5kb3cgKi9cblxudmFyIEtleWNoYWluID0gcmVxdWlyZSgnY29tLnNoYXpyb24uY29yZG92YS5wbHVnaW4ua2V5Y2hhaW51dGlsLktleWNoYWluJyk7XG5cbmlmICh0eXBlb2YgU3RyaW5nLnByb3RvdHlwZS5zdGFydHNXaXRoICE9PSAnZnVuY3Rpb24nKSB7XG5cdFN0cmluZy5wcm90b3R5cGUuc3RhcnRzV2l0aCA9IGZ1bmN0aW9uKHN0cikge1xuXHRcdHJldHVybiB0aGlzLmxhc3RJbmRleE9mKHN0ciwgMCkgPT09IDA7XG5cdH07XG59XG5pZiAodHlwZW9mIFN0cmluZy5wcm90b3R5cGUuZW5kc1dpdGggIT09ICdmdW5jdGlvbicpIHtcblx0U3RyaW5nLnByb3RvdHlwZS5lbmRzV2l0aCA9IGZ1bmN0aW9uKHN1ZmZpeCkge1xuXHRcdHJldHVybiB0aGlzLmluZGV4T2Yoc3VmZml4LCB0aGlzLmxlbmd0aCAtIHN1ZmZpeC5sZW5ndGgpICE9PSAtMTtcblx0fTtcbn1cblxuZnVuY3Rpb24gS2V5Y2hhaW5CYWNrZW5kKCkge1xuXHR2YXIga2MgPSBuZXcgS2V5Y2hhaW4oKTtcblx0dmFyIHNlcnZpY2VOYW1lID0gJ0NvcmRvdmFDbG91ZFN0b3JhZ2UnO1xuXG5cdHZhciBlbmNvZGVLZXkgPSBmdW5jdGlvbihzdHIpIHtcblx0XHRyZXR1cm4gd2luZG93LmJ0b2Eoc3RyKTtcblx0XHQvKlxuXHRcdHJldHVybiBzdHJcblx0XHRcdC5yZXBsYWNlKC9bXFxcXF0vZywgJ1xcXFxcXFxcJylcblx0XHRcdC5yZXBsYWNlKC9bXFxcIl0vZywgJ1xcXFxcXFwiJylcblx0XHRcdC5yZXBsYWNlKC9bXFwvXS9nLCAnXFxcXC8nKVxuXHRcdFx0LnJlcGxhY2UoL1tcXGJdL2csICdcXFxcYicpXG5cdFx0XHQucmVwbGFjZSgvW1xcZl0vZywgJ1xcXFxmJylcblx0XHRcdC5yZXBsYWNlKC9bXFxuXS9nLCAnXFxcXG4nKVxuXHRcdFx0LnJlcGxhY2UoL1tcXHJdL2csICdcXFxccicpXG5cdFx0XHQucmVwbGFjZSgvW1xcdF0vZywgJ1xcXFx0Jyk7XG5cdFx0Ki9cbiAgXHR9O1xuXG5cdHZhciBlbmNvZGUgPSBmdW5jdGlvbihzdHIpIHtcblx0XHRyZXR1cm4gSlNPTi5zdHJpbmdpZnkoc3RyKTtcblx0fTtcblxuXHR2YXIgZGVjb2RlID0gZnVuY3Rpb24oc3RyKSB7XG5cdFx0cmV0dXJuIEpTT04ucGFyc2Uoc3RyKTtcblx0fTtcblxuXHR2YXIgY2FsbFN1Y2Nlc3MgPSBmdW5jdGlvbihjYiwgZGF0YSkge1xuXHRcdHZhciByZXQgPSB7IHN1Y2Nlc3M6IHRydWUgfTtcblx0XHRpZiAoZGF0YSkge1xuXHRcdFx0cmV0LmNvbnRlbnRzID0gZGF0YTtcblx0XHR9XG5cdFx0Y2IocmV0KTtcblx0fTtcblx0dmFyIGNhbGxFcnJvciA9IGZ1bmN0aW9uKGNiLCBlcnIpIHtcblx0XHR2YXIgcmV0ID0geyBzdWNjZXNzOiBmYWxzZSB9O1xuXHRcdGlmIChlcnIpIHtcblx0XHRcdHJldC5lcnJvciA9IGVycjtcblx0XHR9XG5cdFx0Y2IocmV0KTtcblx0fTtcblxuXHR2YXIgZ2V0SW5kZXggPSBmdW5jdGlvbihjYikge1xuXHRcdGtjLmdldEZvcktleShmdW5jdGlvbiBzdWNjZXNzKHJlc3VsdCkge1xuXHRcdFx0Y2IoZGVjb2RlKHJlc3VsdCkpO1xuXHRcdH0sIGZ1bmN0aW9uIGZhaWx1cmUoZXJyKSB7XG5cdFx0XHRjb25zb2xlLmxvZygnS2V5Y2hhaW5CYWNrZW5kOiBXQVJOSU5HOiBnZXRJbmRleCBmYWlsZWQuICcgKyBKU09OLnN0cmluZ2lmeShlcnIpKTtcblx0XHRcdGNiKFtdKTtcblx0XHR9LCAnX2luZGV4Jywgc2VydmljZU5hbWUpO1xuXHR9O1xuXHR2YXIgdXBkYXRlSW5kZXggPSBmdW5jdGlvbihpbmRleCwgcywgZikge1xuXHRcdGtjLnNldEZvcktleShmdW5jdGlvbiBzdWNjZXNzKCkge1xuXHRcdFx0Y29uc29sZS5sb2coJ0tleWNoYWluQmFja2VuZDogdXBkYXRlZCBpbmRleDogJyArIEpTT04uc3RyaW5naWZ5KGluZGV4KSk7XG5cdFx0XHRzKHRydWUpO1xuXHRcdH0sIGZ1bmN0aW9uIGZhaWx1cmUoZXJyKSB7XG5cdFx0XHRjb25zb2xlLmxvZygnS2V5Y2hhaW5CYWNrZW5kOiBXQVJOSU5HOiB1cGRhdGVJbmRleCBmYWlsZWQuICcgKyBKU09OLnN0cmluZ2lmeShlcnIpKTtcblx0XHRcdGYoZXJyKTtcblx0XHR9LCAnX2luZGV4Jywgc2VydmljZU5hbWUsIGVuY29kZShpbmRleCkpO1xuXHR9O1xuXG5cdHRoaXMuaXNWYWxpZCA9IGZ1bmN0aW9uKCkge1xuXHRcdGlmIChrYyAmJiBrYy5nZXRGb3JLZXkpIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHR9O1xuXG5cdHRoaXMucmVhZEZpbGUgPSBmdW5jdGlvbihmaWxlbmFtZSwgcywgZikge1xuXHRcdGtjLmdldEZvcktleShmdW5jdGlvbiBzdWNjZXNzKHJlc3VsdCkge1xuXHRcdFx0Y29uc29sZS5sb2coJ0tleWNoYWluQmFja2VuZDogcmVhZCAnICsgZmlsZW5hbWUgKyAnOiAnICsgcmVzdWx0KTtcblx0XHRcdGNhbGxTdWNjZXNzKHMsIGRlY29kZShyZXN1bHQpKTtcblx0XHR9LCBmdW5jdGlvbiBmYWlsdXJlKGVycikge1xuXHRcdFx0Y29uc29sZS5sb2coJ0tleWNoYWluQmFja2VuZDogJyArIGZpbGVuYW1lICsgJyBmYWlsdXJlOiAnICsgSlNPTi5zdHJpbmdpZnkoZXJyKSk7XG5cdFx0XHRjYWxsRXJyb3IoZiwgZXJyKTtcblx0XHR9LCBlbmNvZGVLZXkoZmlsZW5hbWUpLCBzZXJ2aWNlTmFtZSk7XG5cdH07XG5cblx0dGhpcy53cml0ZUZpbGUgPSBmdW5jdGlvbihmaWxlbmFtZSwgZGF0YSwgcywgZikge1xuXHRcdGRhdGEgPSBlbmNvZGUoZGF0YSk7XG5cblx0XHRrYy5zZXRGb3JLZXkoZnVuY3Rpb24gc3VjY2VzcygpIHtcblx0XHRcdGNvbnNvbGUubG9nKCdLZXljaGFpbkJhY2tlbmQ6IHdyb3RlICcgKyBmaWxlbmFtZSk7XG5cdFx0XHRnZXRJbmRleChmdW5jdGlvbiBjYWxsYmFjayhpbmRleCkge1xuXHRcdFx0XHRpZiAoaW5kZXguaW5kZXhPZihmaWxlbmFtZSkgPT09IC0xKSB7XG5cdFx0XHRcdFx0aW5kZXgucHVzaChmaWxlbmFtZSk7XG5cdFx0XHRcdFx0aW5kZXguc29ydCgpO1xuXHRcdFx0XHRcdHVwZGF0ZUluZGV4KGluZGV4LCBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRcdGNhbGxTdWNjZXNzKHMsIGRhdGEpO1xuXHRcdFx0XHRcdH0sIGZ1bmN0aW9uKGVycikge1xuXHRcdFx0XHRcdFx0Y2FsbEVycm9yKGYsIGVycik7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Y2FsbFN1Y2Nlc3MocywgdHJ1ZSk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH0sIGZ1bmN0aW9uIGZhaWx1cmUoZXJyKSB7XG5cdFx0XHRjb25zb2xlLmxvZygnS2V5Y2hhaW5CYWNrZW5kOiAnICsgZmlsZW5hbWUgKyAnIGZhaWx1cmU6ICcgKyBlcnIpO1xuXHRcdFx0Y2FsbEVycm9yKGYsIGVycik7XG5cdFx0fSwgZW5jb2RlS2V5KGZpbGVuYW1lKSwgc2VydmljZU5hbWUsIGRhdGEpO1xuXHR9O1xuXG5cdHRoaXMucmVtb3ZlRmlsZSA9IGZ1bmN0aW9uKGZpbGVuYW1lLCBzLCBmKSB7XG5cdFx0dmFyIGRvUmVtb3ZlID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRrYy5yZW1vdmVGb3JLZXkoZnVuY3Rpb24gc3VjY2VzcygpIHtcblx0XHRcdFx0Y29uc29sZS5sb2coJ0tleWNoYWluQmFja2VuZDogcmVtb3ZlZCAnICsgZmlsZW5hbWUpO1xuXHRcdFx0XHRjYWxsU3VjY2VzcyhzLCB0cnVlKTtcblx0XHRcdH0sIGZ1bmN0aW9uIGZhaWx1cmUoZXJyKSB7XG5cdFx0XHRcdGNvbnNvbGUubG9nKCdLZXljaGFpbkJhY2tlbmQ6ICcgKyBmaWxlbmFtZSArICcgZmFpbHVyZTogJyArIGVycik7XG5cdFx0XHRcdGNhbGxFcnJvcihmLCBlcnIpO1xuXHRcdFx0fSwgZW5jb2RlS2V5KGZpbGVuYW1lKSwgc2VydmljZU5hbWUpO1xuXHRcdH07XG5cblx0XHRnZXRJbmRleChmdW5jdGlvbiBjYWxsYmFjayhpbmRleCkge1xuXHRcdFx0dmFyIGxvYyA9IGluZGV4LmluZGV4T2YoZmlsZW5hbWUpO1xuXHRcdFx0aWYgKGxvYyAhPT0gLTEpIHtcblx0XHRcdFx0aW5kZXguc3BsaWNlKGxvYywgMSk7XG5cdFx0XHRcdHVwZGF0ZUluZGV4KGluZGV4LCBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRkb1JlbW92ZSgpO1xuXHRcdFx0XHR9LCBmdW5jdGlvbihlcnIpIHtcblx0XHRcdFx0XHRjYWxsRXJyb3IoZiwgZXJyKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRkb1JlbW92ZSgpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9O1xuXG5cdHRoaXMubGlzdEZpbGVzID0gZnVuY3Rpb24ocGF0aCwgcywgZikge1xuXHRcdGdldEluZGV4KGZ1bmN0aW9uIGNhbGxiYWNrKGluZGV4KSB7XG5cdFx0XHR2YXIgaSwgbGVuID0gaW5kZXgubGVuZ3RoLCBlbnRyeSwgcmV0ID0gW10sIHByZWZpeCA9IHBhdGg7XG5cdFx0XHRpZiAoIXByZWZpeC5lbmRzV2l0aCgnLycpKSB7XG5cdFx0XHRcdHByZWZpeCA9IHByZWZpeCArICcvJztcblx0XHRcdH1cblxuXHRcdFx0dmFyIHJlcGxhY2UgPSBuZXcgUmVnRXhwKCdeJyArIHByZWZpeC5yZXBsYWNlKC9bLiorP14ke30oKXxbXFxdXFxcXF0vZywgXCJcXFxcJCZcIikpO1xuXHRcdFx0Zm9yIChpPTA7IGkgPCBsZW47IGkrKykge1xuXHRcdFx0XHRlbnRyeSA9IGluZGV4W2ldO1xuXHRcdFx0XHRpZiAocGF0aCA9PT0gJycgJiYgIWVudHJ5LnN0YXJ0c1dpdGgoJy8nKSkge1xuXHRcdFx0XHRcdHJldC5wdXNoKGVudHJ5KTtcblx0XHRcdFx0fSBlbHNlIGlmIChlbnRyeS5zdGFydHNXaXRoKHByZWZpeCkpIHtcblx0XHRcdFx0XHRyZXQucHVzaChlbnRyeS5yZXBsYWNlKHJlcGxhY2UsICcnKSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Y29uc29sZS5sb2coJ0tleWNoYWluQmFja2VuZDogbGlzdEZpbGVzKCcrcGF0aCsnKTogYmVmb3JlID0gJyArIEpTT04uc3RyaW5naWZ5KGluZGV4LCB0cnVlKSk7XG5cdFx0XHRjb25zb2xlLmxvZygnS2V5Y2hhaW5CYWNrZW5kOiBsaXN0RmlsZXMoJytwYXRoKycpOiBhZnRlciAgPSAnICsgSlNPTi5zdHJpbmdpZnkocmV0LCB0cnVlKSk7XG5cdFx0XHRjYWxsU3VjY2VzcyhzLCByZXQpO1xuXHRcdH0pO1xuXHR9O1xufVxuXG5LZXljaGFpbkJhY2tlbmQucHJvdG90eXBlLm5hbWUgPSAna2V5Y2hhaW4nO1xuIiwiLyoganNoaW50IC1XMDk3ICovXG5cbid1c2Ugc3RyaWN0JztcblxuLyogZ2xvYmFsIHJlcXVpcmUgKi9cblxudmFyIGV4ZWMgPSByZXF1aXJlKCdjb3Jkb3ZhL2V4ZWMnKTtcblxuZnVuY3Rpb24gTG9jYWxCYWNrZW5kKCkge31cbkxvY2FsQmFja2VuZC5wcm90b3R5cGUubmFtZSA9ICdsb2NhbCc7XG5Mb2NhbEJhY2tlbmQucHJvdG90eXBlLmlzVmFsaWQgPSBmdW5jdGlvbigpIHtcblx0cmV0dXJuIHRydWU7XG59O1xuTG9jYWxCYWNrZW5kLnByb3RvdHlwZS5yZWFkRmlsZSA9IGZ1bmN0aW9uKGZpbGVuYW1lLCBzdWNjZXNzLCBmYWlsdXJlKSB7XG5cdGV4ZWMoc3VjY2VzcywgZmFpbHVyZSwgJ0Nsb3VkU3RvcmFnZScsICdvbm1zR2V0SnNvbkZpbGVDb250ZW50cycsIFtmaWxlbmFtZV0pO1xufTtcbkxvY2FsQmFja2VuZC5wcm90b3R5cGUud3JpdGVGaWxlID0gZnVuY3Rpb24oZmlsZW5hbWUsIGRhdGEsIHN1Y2Nlc3MsIGZhaWx1cmUpIHtcblx0ZXhlYyhzdWNjZXNzLCBmYWlsdXJlLCAnQ2xvdWRTdG9yYWdlJywgJ29ubXNTZXRKc29uRmlsZUNvbnRlbnRzJywgW2ZpbGVuYW1lLCBkYXRhXSk7XG59O1xuTG9jYWxCYWNrZW5kLnByb3RvdHlwZS5yZW1vdmVGaWxlID0gZnVuY3Rpb24oZmlsZW5hbWUsIHN1Y2Nlc3MsIGZhaWx1cmUpIHtcblx0ZXhlYyhzdWNjZXNzLCBmYWlsdXJlLCAnQ2xvdWRTdG9yYWdlJywgJ29ubXNSZW1vdmVKc29uRmlsZScsIFtmaWxlbmFtZV0pO1xufTtcbkxvY2FsQmFja2VuZC5wcm90b3R5cGUubGlzdEZpbGVzID0gZnVuY3Rpb24ocGF0aCwgc3VjY2VzcywgZmFpbHVyZSkge1xuXHRleGVjKHN1Y2Nlc3MsIGZhaWx1cmUsICdDbG91ZFN0b3JhZ2UnLCAnb25tc0xpc3RKc29uRmlsZXMnLCBbcGF0aF0pO1xufTtcbiJdLCJzb3VyY2VSb290IjoiL3NvdXJjZS8ifQ==