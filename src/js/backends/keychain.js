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
