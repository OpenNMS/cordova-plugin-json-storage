/* jshint -W097 */

'use strict';

/* global console */
/* global require */
/* global window */

function DropboxBackend() {
	this.readFile = function(filename, s, f) {
		callError(f, 'error: readFile not implemented');
	};

	this.writeFile = function(filename, data, s, f) {
		callError(f, 'error: writeFile not implemented');
	};

	this.removeFile = function(filename, s, f) {
		callError(f, 'error: removeFile not implemented');
	};

	this.listFiles = function(path, s, f) {
		callError(f, 'error: listFiles not implemented');
	};

	this.wipeData = function(s, f) {
		callError(f, 'error: wipeData not implemented');
	};
}

DropboxBackend.prototype.name = 'dropbox';
