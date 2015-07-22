'use strict';

function LocalBackend() {}
LocalBackend.prototype.name = 'local';
LocalBackend.prototype.isValid = function() {
	return true;
};
LocalBackend.prototype.readFile = function(filename, success, failure) {
	exec(function s(response) { success(response.contents); }, failure, 'CloudStorage', 'onmsGetJsonFileContents', [filename]);
};
LocalBackend.prototype.writeFile = function(filename, data, success, failure) {
	exec(function s(response) { success(response.contents); }, failure, 'CloudStorage', 'onmsSetJsonFileContents', [filename, data]);
};
LocalBackend.prototype.removeFile = function(filename, success, failure) {
	exec(function s(response) { success(response.contents); }, failure, 'CloudStorage', 'onmsRemoveJsonFile', [filename]);
};
LocalBackend.prototype.listFiles = function(path, success, failure) {
	exec(function s(response) { success(response.contents); }, failure, 'CloudStorage', 'onmsListJsonFiles', [path]);
};

module.exports = new LocalBackend();