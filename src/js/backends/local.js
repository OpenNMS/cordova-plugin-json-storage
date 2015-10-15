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
	exec(success, failure, 'LocalJSONStorage', 'onmsGetJsonFileContents', [filename]);
};
LocalBackend.prototype.writeFile = function(filename, data, success, failure) {
	exec(success, failure, 'LocalJSONStorage', 'onmsSetJsonFileContents', [filename, data]);
};
LocalBackend.prototype.removeFile = function(filename, success, failure) {
	exec(success, failure, 'LocalJSONStorage', 'onmsRemoveJsonFile', [filename]);
};
LocalBackend.prototype.listFiles = function(path, success, failure) {
	exec(success, failure, 'LocalJSONStorage', 'onmsListJsonFiles', [path]);
};
LocalBackend.prototype.wipeData = function(success, failure) {
	exec(success, failure, 'LocalJSONStorage', 'onmsWipe', []);
};
