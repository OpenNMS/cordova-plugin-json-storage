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
