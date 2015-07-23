/* jshint -W097 */

'use strict';

/* global angular */
/* global console */
/* global document */
/* global module */
/* global require */
/* global window */

/* global ICloudBackend */
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
		new ICloudBackend(),
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

	if (backends.icloud) {
		backend = 'icloud';
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

var iCloudKV = require('fr.pierrickrouxel.cordova.plugin.iCloudKV.iCloudKV');

function ICloudBackend() {
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

	this.isValid = function() {
		if (iCloudKV && iCloudKV.save) {
			return true;
		} else {
			return false;
		}
	};

	this.readFile = function(filename, s, f) {
		iCloudKV.load(encodeURIComponent(filename), function success(value) {
			console.log('CloudStorage: iCloud: read ' + filename + ': ' + value);
			callSuccess(s, JSON.parse(value));
		}, function failure(err) {
			console.log('CloudStorage: iCloud: ' + filename + ' failure: ' + JSON.stringify(err));
			callError(f, err);
		});
	};

	this.writeFile = function(filename, data, s, f) {
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
	};

	this.removeFile = function(filename, s, f) {
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
	};

	this.listFiles = function(path, s, f) {
		return getIndex(function callback(index) {
			callSuccess(s, index);
		});
	};
}

ICloudBackend.prototype.name = 'icloud';

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

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImNsb3VkLXN0b3JhZ2UuanMiLCJiYWNrZW5kcy9pY2xvdWQuanMiLCJiYWNrZW5kcy9sb2NhbC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUM5SkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUN4SEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJjbG91ZC1zdG9yYWdlLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyoganNoaW50IC1XMDk3ICovXG5cbid1c2Ugc3RyaWN0JztcblxuLyogZ2xvYmFsIGFuZ3VsYXIgKi9cbi8qIGdsb2JhbCBjb25zb2xlICovXG4vKiBnbG9iYWwgZG9jdW1lbnQgKi9cbi8qIGdsb2JhbCBtb2R1bGUgKi9cbi8qIGdsb2JhbCByZXF1aXJlICovXG4vKiBnbG9iYWwgd2luZG93ICovXG5cbi8qIGdsb2JhbCBJQ2xvdWRCYWNrZW5kICovXG4vKiBnbG9iYWwgTG9jYWxCYWNrZW5kICovXG5cbnZhciBkZWJ1ZyA9IGZhbHNlO1xudmFyIGJhY2tlbmRzID0ge307XG52YXIgYmFja2VuZDtcblxudmFyIF9pbml0aWFsaXplZCA9IGZhbHNlO1xuZnVuY3Rpb24gYXNzZXJ0SW5pdGlhbGl6ZWQoKSB7XG5cdGlmIChfaW5pdGlhbGl6ZWQpIHsgcmV0dXJuOyB9XG5cdF9pbml0aWFsaXplZCA9IHRydWU7XG5cblx0Y29uc29sZS5sb2coJ0Nsb3VkU3RvcmFnZTogSW5pdGlhbGl6aW5nLicpO1xuXG5cdHZhciBhdHRlbXB0ZWRCYWNrZW5kcyA9IFtcblx0XHRuZXcgSUNsb3VkQmFja2VuZCgpLFxuXHRcdG5ldyBMb2NhbEJhY2tlbmQoKVxuXHRdLCBpLCBsZW4gPSBhdHRlbXB0ZWRCYWNrZW5kcy5sZW5ndGgsIGJlO1xuXG5cdGNvbnNvbGUubG9nKCdhdHRlbXB0ZWQgYmFja2VuZHM6ICcgKyBKU09OLnN0cmluZ2lmeShhdHRlbXB0ZWRCYWNrZW5kcykpO1xuXHRmb3IgKGk9MDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0YmUgPSBhdHRlbXB0ZWRCYWNrZW5kc1tpXTtcblx0XHRpZiAoYmUgJiYgYmUubmFtZSkge1xuXHRcdFx0Y29uc29sZS5sb2coJ0Nsb3VkU3RvcmFnZTogQ2hlY2tpbmcgcGx1Z2luIFwiJyArIGJlLm5hbWUgKyAnXCIuJyk7XG5cdFx0XHRpZiAoYmUuaXNWYWxpZCAmJiBiZS5pc1ZhbGlkKCkpIHtcblx0XHRcdFx0Y29uc29sZS5sb2coJ0Nsb3VkU3RvcmFnZTogQmFja2VuZCBcIicgKyBiZS5uYW1lICsgJ1wiXCIgaXMgdmFsaWQuJyk7XG5cdFx0XHRcdGJhY2tlbmRzW2JlLm5hbWVdID0gYmU7IFxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29uc29sZS5sb2coJ0Nsb3VkU3RvcmFnZTogQmFja2VuZCBcIicgKyBiZS5uYW1lICsgJ1wiXCIgaXMgbm90IHZhbGlkLicpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdGlmIChiYWNrZW5kcy5pY2xvdWQpIHtcblx0XHRiYWNrZW5kID0gJ2ljbG91ZCc7XG5cdH0gZWxzZSB7XG5cdFx0YmFja2VuZCA9ICdsb2NhbCc7XG5cdH1cbn1cblxudmFyIENsb3VkU3RvcmFnZSA9IHtcblx0c2V0RGVidWc6IGZ1bmN0aW9uKGQpIHtcblx0XHRkZWJ1ZyA9ICEhZDtcblx0fSxcblx0c2V0QmFja2VuZDogZnVuY3Rpb24oYiwgc3VjY2VzcywgZmFpbHVyZSkge1xuXHRcdGFzc2VydEluaXRpYWxpemVkKCk7XG5cdFx0aWYgKGJhY2tlbmRzW2JdKSB7XG5cdFx0XHRpZiAoZGVidWcpIHsgY29uc29sZS5sb2coJ0Nsb3VkU3RvcmFnZTogc2V0dGluZyBiYWNrZW5kIHRvICcgKyBiKTsgfVxuXHRcdFx0YmFja2VuZCA9IGI7XG5cdFx0XHRzdWNjZXNzKGIpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR2YXIgZXJyb3IgPSAnVW5rbm93biBiYWNrZW5kIFwiJyArIGIgKyAnXCInO1xuXHRcdFx0Y29uc29sZS5sb2coJ0Nsb3VkU3RvcmFnZTogV0FSTklORzogJyArIGVycm9yKTtcblx0XHRcdGNvbnNvbGUubG9nKCdDbG91ZFN0b3JhZ2U6IGF2YWlsYWJsZSBiYWNrZW5kczogJyArIE9iamVjdC5rZXlzKGJhY2tlbmRzKS5qb2luKCcsICcpKTtcblx0XHRcdGZhaWx1cmUoZXJyb3IpO1xuXHRcdH1cblx0fSxcblx0cmVhZEZpbGU6IGZ1bmN0aW9uKGZpbGVuYW1lLCBzdWNjZXNzLCBmYWlsdXJlKSB7XG5cdFx0YXNzZXJ0SW5pdGlhbGl6ZWQoKTtcblx0XHRpZiAoZGVidWcpIHsgY29uc29sZS5sb2coJ0Nsb3VkU3RvcmFnZTogJyArIGJhY2tlbmQgKyAnLnJlYWRGaWxlKCcgKyBmaWxlbmFtZSArICcpJyk7IH1cblx0XHRiYWNrZW5kc1tiYWNrZW5kXS5yZWFkRmlsZShmaWxlbmFtZSwgc3VjY2VzcywgZmFpbHVyZSk7XG5cdH0sXG5cdHdyaXRlRmlsZTogZnVuY3Rpb24oZmlsZW5hbWUsIGRhdGEsIHN1Y2Nlc3MsIGZhaWx1cmUpIHtcblx0XHRhc3NlcnRJbml0aWFsaXplZCgpO1xuXHRcdGlmIChkZWJ1ZykgeyBjb25zb2xlLmxvZygnQ2xvdWRTdG9yYWdlOiAnICsgYmFja2VuZCArICcud3JpdGVGaWxlKCcgKyBmaWxlbmFtZSArICcsIC4uLiknKTsgfVxuXHRcdGJhY2tlbmRzW2JhY2tlbmRdLndyaXRlRmlsZShmaWxlbmFtZSwgZGF0YSwgc3VjY2VzcywgZmFpbHVyZSk7XG5cdH0sXG5cdHJlbW92ZUZpbGU6IGZ1bmN0aW9uKGZpbGVuYW1lLCBzdWNjZXNzLCBmYWlsdXJlKSB7XG5cdFx0YXNzZXJ0SW5pdGlhbGl6ZWQoKTtcblx0XHRpZiAoZGVidWcpIHsgY29uc29sZS5sb2coJ0Nsb3VkU3RvcmFnZTogJyArIGJhY2tlbmQgKyAnLnJlbW92ZUZpbGUoJyArIGZpbGVuYW1lICsgJyknKTsgfVxuXHRcdGJhY2tlbmRzW2JhY2tlbmRdLnJlbW92ZUZpbGUoZmlsZW5hbWUsIHN1Y2Nlc3MsIGZhaWx1cmUpO1xuXHR9LFxuXHRsaXN0RmlsZXM6IGZ1bmN0aW9uKHBhdGgsIHN1Y2Nlc3MsIGZhaWx1cmUpIHtcblx0XHRhc3NlcnRJbml0aWFsaXplZCgpO1xuXHRcdGlmIChkZWJ1ZykgeyBjb25zb2xlLmxvZygnQ2xvdWRTdG9yYWdlOiAnICsgYmFja2VuZCArICcubGlzdEZpbGVzKCcgKyBwYXRoICsgJyknKTsgfVxuXHRcdGJhY2tlbmRzW2JhY2tlbmRdLmxpc3RGaWxlcyhwYXRoLCBzdWNjZXNzLCBmYWlsdXJlKTtcblx0fSxcbn07XG5cbmlmICh0eXBlb2YgYW5ndWxhciAhPT0gXCJ1bmRlZmluZWRcIikge1xuXHRjb25zb2xlLmxvZygnQ2xvdWRTdG9yYWdlOiBBbmd1bGFyIGlzIGF2YWlsYWJsZS4gIFJlZ2lzdGVyaW5nIEFuZ3VsYXIgbW9kdWxlLicpO1xuXHRhbmd1bGFyLm1vZHVsZSgnQ2xvdWRTdG9yYWdlJywgW10pLmZhY3RvcnkoJ0Nsb3VkU3RvcmFnZScsIGZ1bmN0aW9uKCR0aW1lb3V0LCAkcSkge1xuXHRcdGZ1bmN0aW9uIG1ha2VQcm9taXNlKGZuLCBhcmdzLCBhc3luYykge1xuXHRcdFx0dmFyIGRlZmVycmVkID0gJHEuZGVmZXIoKTtcblx0XHRcdFxuXHRcdFx0dmFyIHN1Y2Nlc3MgPSBmdW5jdGlvbihyZXNwb25zZSkge1xuXHRcdFx0XHRpZiAoZGVidWcpIHsgY29uc29sZS5sb2coJ0Nsb3VkU3RvcmFnZTogc3VjY2VzczogJyArIGFuZ3VsYXIudG9Kc29uKHJlc3BvbnNlKSk7IH1cblx0XHRcdFx0aWYgKGFzeW5jKSB7XG5cdFx0XHRcdFx0JHRpbWVvdXQoZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0XHRkZWZlcnJlZC5yZXNvbHZlKHJlc3BvbnNlKTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRkZWZlcnJlZC5yZXNvbHZlKHJlc3BvbnNlKTtcblx0XHRcdFx0fVxuXHRcdFx0fTtcblx0XHRcdFxuXHRcdFx0dmFyIGZhaWwgPSBmdW5jdGlvbihyZXNwb25zZSkge1xuXHRcdFx0XHRpZiAoZGVidWcpIHsgY29uc29sZS5sb2coJ0Nsb3VkU3RvcmFnZTogZmFpbHVyZTogJyArIGFuZ3VsYXIudG9Kc29uKHJlc3BvbnNlKSk7IH1cblx0XHRcdFx0aWYgKGFzeW5jKSB7XG5cdFx0XHRcdFx0JHRpbWVvdXQoZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0XHRkZWZlcnJlZC5yZWplY3QocmVzcG9uc2UpO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGRlZmVycmVkLnJlamVjdChyZXNwb25zZSk7XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cdFx0XHRcblx0XHRcdGFyZ3MucHVzaChzdWNjZXNzKTtcblx0XHRcdGFyZ3MucHVzaChmYWlsKTtcblx0XHRcdFxuXHRcdFx0Zm4uYXBwbHkoQ2xvdWRTdG9yYWdlLCBhcmdzKTtcblx0XHRcdFxuXHRcdFx0cmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG5cdFx0fVxuXHRcdFxuXHRcdHJldHVybiB7XG5cdFx0XHRzZXREZWJ1ZzogZnVuY3Rpb24oZGVidWcpIHtcblx0XHRcdFx0cmV0dXJuIENsb3VkU3RvcmFnZS5zZXREZWJ1ZyhkZWJ1Zyk7XG5cdFx0XHR9LFxuXHRcdFx0c2V0QmFja2VuZDogZnVuY3Rpb24oYmFja2VuZCkge1xuXHRcdFx0XHRyZXR1cm4gbWFrZVByb21pc2UoQ2xvdWRTdG9yYWdlLnNldEJhY2tlbmQsIFtiYWNrZW5kXSk7XG5cdFx0XHR9LFxuXHRcdFx0cmVhZEZpbGU6IGZ1bmN0aW9uKGZpbGVuYW1lKSB7XG5cdFx0XHRcdHJldHVybiBtYWtlUHJvbWlzZShDbG91ZFN0b3JhZ2UucmVhZEZpbGUsIFtmaWxlbmFtZV0pO1xuXHRcdFx0fSxcblx0XHRcdHdyaXRlRmlsZTogZnVuY3Rpb24oZmlsZW5hbWUsIGRhdGEpIHtcblx0XHRcdFx0cmV0dXJuIG1ha2VQcm9taXNlKENsb3VkU3RvcmFnZS53cml0ZUZpbGUsIFtmaWxlbmFtZSwgZGF0YV0pO1xuXHRcdFx0fSxcblx0XHRcdHJlbW92ZUZpbGU6IGZ1bmN0aW9uKGZpbGVuYW1lKSB7XG5cdFx0XHRcdHJldHVybiBtYWtlUHJvbWlzZShDbG91ZFN0b3JhZ2UucmVtb3ZlRmlsZSwgW2ZpbGVuYW1lXSk7XG5cdFx0XHR9LFxuXHRcdFx0bGlzdEZpbGVzOiBmdW5jdGlvbihwYXRoKSB7XG5cdFx0XHRcdHJldHVybiBtYWtlUHJvbWlzZShDbG91ZFN0b3JhZ2UubGlzdEZpbGVzLCBbcGF0aF0pO1xuXHRcdFx0fSxcblx0XHR9O1xuXHR9KTtcbn0gZWxzZSB7XG5cdGNvbnNvbGUubG9nKCdDbG91ZFN0b3JhZ2U6IEFuZ3VsYXIgaXMgbm90IGF2YWlsYWJsZS4gIFNraXBwaW5nIEFuZ3VsYXIgc3VwcG9ydC4nKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBDbG91ZFN0b3JhZ2U7XG5cbmlmICghd2luZG93LnBsdWdpbnMpIHtcblx0d2luZG93LnBsdWdpbnMgPSB7fTtcbn1cbmlmICghd2luZG93LnBsdWdpbnMuQ2xvdWRTdG9yYWdlKSB7XG5cdHdpbmRvdy5wbHVnaW5zLkNsb3VkU3RvcmFnZSA9IENsb3VkU3RvcmFnZTtcbn0iLCIvKiBqc2hpbnQgLVcwOTcgKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG4vKiBnbG9iYWwgY29uc29sZSAqL1xuLyogZ2xvYmFsIHJlcXVpcmUgKi9cblxudmFyIGlDbG91ZEtWID0gcmVxdWlyZSgnZnIucGllcnJpY2tyb3V4ZWwuY29yZG92YS5wbHVnaW4uaUNsb3VkS1YuaUNsb3VkS1YnKTtcblxuZnVuY3Rpb24gSUNsb3VkQmFja2VuZCgpIHtcblx0dmFyIGNhbGxTdWNjZXNzID0gZnVuY3Rpb24oY2IsIGRhdGEpIHtcblx0XHR2YXIgcmV0ID0geyBzdWNjZXNzOiB0cnVlIH07XG5cdFx0aWYgKGRhdGEpIHtcblx0XHRcdHJldC5jb250ZW50cyA9IGRhdGE7XG5cdFx0fVxuXHRcdGNiKHJldCk7XG5cdH07XG5cdHZhciBjYWxsRXJyb3IgPSBmdW5jdGlvbihjYiwgZXJyKSB7XG5cdFx0dmFyIHJldCA9IHsgc3VjY2VzczogZmFsc2UgfTtcblx0XHRpZiAoZXJyKSB7XG5cdFx0XHRyZXQuZXJyb3IgPSBlcnI7XG5cdFx0fVxuXHRcdGNiKHJldCk7XG5cdH07XG5cblx0dmFyIGdldEluZGV4ID0gZnVuY3Rpb24oY2IpIHtcblx0XHRpQ2xvdWRLVi5sb2FkKCdfaW5kZXgnLCBmdW5jdGlvbiBzdWNjZXNzKHZhbHVlKSB7XG5cdFx0XHR2YWx1ZSA9IEpTT04ucGFyc2UodmFsdWUpO1xuXHRcdFx0Y2IodmFsdWUpO1xuXHRcdH0sIGZ1bmN0aW9uIGZhaWx1cmUoZXJyKSB7XG5cdFx0XHRjb25zb2xlLmxvZygnQ2xvdWRTdG9yYWdlOiBpQ2xvdWQ6IFdBUk5JTkc6IGdldEluZGV4IGZhaWxlZC4gJyArIEpTT04uc3RyaW5naWZ5KGVycikpO1xuXHRcdFx0Y2IoW10pO1xuXHRcdH0pO1xuXHR9O1xuXHR2YXIgdXBkYXRlSW5kZXggPSBmdW5jdGlvbihpbmRleCwgcywgZikge1xuXHRcdGlDbG91ZEtWLnNhdmUoJ19pbmRleCcsIEpTT04uc3RyaW5naWZ5KGluZGV4KSwgZnVuY3Rpb24gc3VjY2VzcygpIHtcblx0XHRcdGNvbnNvbGUubG9nKCdDbG91ZFN0b3JhZ2U6IGlDbG91ZDogdXBkYXRlZCBpbmRleDogJyArIEpTT04uc3RyaW5naWZ5KGluZGV4KSk7XG5cdFx0XHRzKGluZGV4KTtcblx0XHR9LCBmdW5jdGlvbiBmYWlsdXJlKGVycikge1xuXHRcdFx0Y29uc29sZS5sb2coJ0Nsb3VkU3RvcmFnZTogaUNsb3VkOiBXQVJOSU5HOiB1cGRhdGVJbmRleCBmYWlsZWQuICcgKyBKU09OLnN0cmluZ2lmeShlcnIpKTtcblx0XHRcdGNhbGxFcnJvcihmLCBlcnIpO1xuXHRcdH0pO1xuXHR9O1xuXG5cdHRoaXMuaXNWYWxpZCA9IGZ1bmN0aW9uKCkge1xuXHRcdGlmIChpQ2xvdWRLViAmJiBpQ2xvdWRLVi5zYXZlKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0fTtcblxuXHR0aGlzLnJlYWRGaWxlID0gZnVuY3Rpb24oZmlsZW5hbWUsIHMsIGYpIHtcblx0XHRpQ2xvdWRLVi5sb2FkKGVuY29kZVVSSUNvbXBvbmVudChmaWxlbmFtZSksIGZ1bmN0aW9uIHN1Y2Nlc3ModmFsdWUpIHtcblx0XHRcdGNvbnNvbGUubG9nKCdDbG91ZFN0b3JhZ2U6IGlDbG91ZDogcmVhZCAnICsgZmlsZW5hbWUgKyAnOiAnICsgdmFsdWUpO1xuXHRcdFx0Y2FsbFN1Y2Nlc3MocywgSlNPTi5wYXJzZSh2YWx1ZSkpO1xuXHRcdH0sIGZ1bmN0aW9uIGZhaWx1cmUoZXJyKSB7XG5cdFx0XHRjb25zb2xlLmxvZygnQ2xvdWRTdG9yYWdlOiBpQ2xvdWQ6ICcgKyBmaWxlbmFtZSArICcgZmFpbHVyZTogJyArIEpTT04uc3RyaW5naWZ5KGVycikpO1xuXHRcdFx0Y2FsbEVycm9yKGYsIGVycik7XG5cdFx0fSk7XG5cdH07XG5cblx0dGhpcy53cml0ZUZpbGUgPSBmdW5jdGlvbihmaWxlbmFtZSwgZGF0YSwgcywgZikge1xuXHRcdGRhdGEgPSBKU09OLnN0cmluZ2lmeShkYXRhKTtcblxuXHRcdGlDbG91ZEtWLnNhdmUoZW5jb2RlVVJJQ29tcG9uZW50KGZpbGVuYW1lKSwgZGF0YSwgZnVuY3Rpb24gc3VjY2Vzcyh2YWx1ZSkge1xuXHRcdFx0Y29uc29sZS5sb2coJ0Nsb3VkU3RvcmFnZTogaUNsb3VkOiB3cm90ZSAnICsgZmlsZW5hbWUgKyAnOiAnICsgSlNPTi5zdHJpbmdpZnkodmFsdWUpKTtcblx0XHRcdGdldEluZGV4KGZ1bmN0aW9uIGNhbGxiYWNrKGluZGV4KSB7XG5cdFx0XHRcdGlmIChpbmRleC5pbmRleE9mKGZpbGVuYW1lKSA9PT0gLTEpIHtcblx0XHRcdFx0XHRpbmRleC5wdXNoKGZpbGVuYW1lKTtcblx0XHRcdFx0XHRpbmRleC5zb3J0KCk7XG5cdFx0XHRcdFx0dXBkYXRlSW5kZXgoaW5kZXgsIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdFx0Y2FsbFN1Y2Nlc3MocywgdmFsdWUpO1xuXHRcdFx0XHRcdH0sIGZ1bmN0aW9uKGVycikge1xuXHRcdFx0XHRcdFx0Y2FsbEVycm9yKGYsIGVycik7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Y2FsbFN1Y2Nlc3MocywgdmFsdWUpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9LCBmdW5jdGlvbiBmYWlsdXJlKGVycikge1xuXHRcdFx0Y29uc29sZS5sb2coJ0Nsb3VkU3RvcmFnZTogaUNsb3VkOiAnICsgZmlsZW5hbWUgKyAnIGZhaWx1cmU6ICcgKyBKU09OLnN0cmluZ2lmeShlcnIpKTtcblx0XHRcdGNhbGxFcnJvcihmLCBlcnIpO1xuXHRcdH0pO1xuXHR9O1xuXG5cdHRoaXMucmVtb3ZlRmlsZSA9IGZ1bmN0aW9uKGZpbGVuYW1lLCBzLCBmKSB7XG5cdFx0dmFyIGRvUmVtb3ZlID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRyZXR1cm4gaUNsb3VkS1YucmVtb3ZlKGVuY29kZVVSSUNvbXBvbmVudChmaWxlbmFtZSksIGZ1bmN0aW9uIHN1Y2Nlc3ModmFsdWUpIHtcblx0XHRcdFx0Y29uc29sZS5sb2coJ0Nsb3VkU3RvcmFnZTogaUNsb3VkOiByZW1vdmVkICcgKyBmaWxlbmFtZSk7XG5cdFx0XHRcdGNhbGxTdWNjZXNzKHMsIHZhbHVlKTtcblx0XHRcdH0sIGZ1bmN0aW9uIGZhaWx1cmUoZXJyKSB7XG5cdFx0XHRcdGNvbnNvbGUubG9nKCdDbG91ZFN0b3JhZ2U6IGlDbG91ZDogJyArIGZpbGVuYW1lICsgJyBmYWlsdXJlOiAnICsgSlNPTi5zdHJpbmdpZnkoZXJyKSk7XG5cdFx0XHRcdGNhbGxFcnJvcihmLCBlcnIpO1xuXHRcdFx0fSk7XG5cdFx0fTtcblxuXHRcdHJldHVybiBnZXRJbmRleChmdW5jdGlvbiBjYWxsYmFjayhpbmRleCkge1xuXHRcdFx0dmFyIGxvYyA9IGluZGV4LmluZGV4T2YoZmlsZW5hbWUpO1xuXHRcdFx0aWYgKGxvYyAhPT0gLTEpIHtcblx0XHRcdFx0aW5kZXguc3BsaWNlKGxvYywgMSk7XG5cdFx0XHRcdHJldHVybiB1cGRhdGVJbmRleChpbmRleCwgZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGRvUmVtb3ZlKCk7XG5cdFx0XHRcdH0sIGZ1bmN0aW9uKGVycikge1xuXHRcdFx0XHRcdGNhbGxFcnJvcihmLCBlcnIpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJldHVybiBkb1JlbW92ZSgpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9O1xuXG5cdHRoaXMubGlzdEZpbGVzID0gZnVuY3Rpb24ocGF0aCwgcywgZikge1xuXHRcdHJldHVybiBnZXRJbmRleChmdW5jdGlvbiBjYWxsYmFjayhpbmRleCkge1xuXHRcdFx0Y2FsbFN1Y2Nlc3MocywgaW5kZXgpO1xuXHRcdH0pO1xuXHR9O1xufVxuXG5JQ2xvdWRCYWNrZW5kLnByb3RvdHlwZS5uYW1lID0gJ2ljbG91ZCc7XG4iLCIvKiBqc2hpbnQgLVcwOTcgKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG4vKiBnbG9iYWwgcmVxdWlyZSAqL1xuXG52YXIgZXhlYyA9IHJlcXVpcmUoJ2NvcmRvdmEvZXhlYycpO1xuXG5mdW5jdGlvbiBMb2NhbEJhY2tlbmQoKSB7fVxuTG9jYWxCYWNrZW5kLnByb3RvdHlwZS5uYW1lID0gJ2xvY2FsJztcbkxvY2FsQmFja2VuZC5wcm90b3R5cGUuaXNWYWxpZCA9IGZ1bmN0aW9uKCkge1xuXHRyZXR1cm4gdHJ1ZTtcbn07XG5Mb2NhbEJhY2tlbmQucHJvdG90eXBlLnJlYWRGaWxlID0gZnVuY3Rpb24oZmlsZW5hbWUsIHN1Y2Nlc3MsIGZhaWx1cmUpIHtcblx0ZXhlYyhzdWNjZXNzLCBmYWlsdXJlLCAnQ2xvdWRTdG9yYWdlJywgJ29ubXNHZXRKc29uRmlsZUNvbnRlbnRzJywgW2ZpbGVuYW1lXSk7XG59O1xuTG9jYWxCYWNrZW5kLnByb3RvdHlwZS53cml0ZUZpbGUgPSBmdW5jdGlvbihmaWxlbmFtZSwgZGF0YSwgc3VjY2VzcywgZmFpbHVyZSkge1xuXHRleGVjKHN1Y2Nlc3MsIGZhaWx1cmUsICdDbG91ZFN0b3JhZ2UnLCAnb25tc1NldEpzb25GaWxlQ29udGVudHMnLCBbZmlsZW5hbWUsIGRhdGFdKTtcbn07XG5Mb2NhbEJhY2tlbmQucHJvdG90eXBlLnJlbW92ZUZpbGUgPSBmdW5jdGlvbihmaWxlbmFtZSwgc3VjY2VzcywgZmFpbHVyZSkge1xuXHRleGVjKHN1Y2Nlc3MsIGZhaWx1cmUsICdDbG91ZFN0b3JhZ2UnLCAnb25tc1JlbW92ZUpzb25GaWxlJywgW2ZpbGVuYW1lXSk7XG59O1xuTG9jYWxCYWNrZW5kLnByb3RvdHlwZS5saXN0RmlsZXMgPSBmdW5jdGlvbihwYXRoLCBzdWNjZXNzLCBmYWlsdXJlKSB7XG5cdGV4ZWMoc3VjY2VzcywgZmFpbHVyZSwgJ0Nsb3VkU3RvcmFnZScsICdvbm1zTGlzdEpzb25GaWxlcycsIFtwYXRoXSk7XG59O1xuIl0sInNvdXJjZVJvb3QiOiIvc291cmNlLyJ9