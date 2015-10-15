/* jshint -W097 */

'use strict';

/* global console */
/* global Dropbox */
/* global Promise */
/* global require */
/* global window */

//ES6Promise.polyfill();

function DropboxBackend(options) {
	this.options = options;
}

DropboxBackend.prototype.name = 'dropbox';
DropboxBackend.prototype.isValid = function() {
	if (this.options && this.options.dropboxAppKey) {
		console.log('DropboxBackend.isValid: true');
		return true;
	} else {
		console.log('DropbokBackend.isValid: options=',this.options);
		return false;
	}
};


DropboxBackend.prototype._callSuccess = function(cb, data) {
	var ret = { success: true };
	if (data) {
		ret.contents = data;
	}
	cb(ret);
};

DropboxBackend.prototype._callError = function(cb, err) {
	var ret = { success: false };
	if (err) {
		ret.error = err;
	}
	cb(ret);
};

DropboxBackend.prototype.assertInitialized = function() {
	var self = this;
	if (!self.client) {
		self.client = new Promise(function(resolve, reject) {
			var client = new Dropbox.Client({key: self.options.dropboxAppKey});
			client.authDriver(new Dropbox.AuthDriver.Cordova());
			client.authenticate(function(error, c) {
				if (error) {
					reject(error);
				} else {
					resolve(c);
				}
			});
		});
	}
	return self.client;
};

DropboxBackend.prototype._encode = function(filename) {
	return encodeURIComponent(filename);
};

DropboxBackend.prototype._decode = function(encoded) {
	return decodeURIComponent(encoded);
};

DropboxBackend.prototype.createParentIfMissing = function(folder, client, s, f) {
	var self = this,
		parent = folder.split('/');
	parent.pop();

	console.log('DropboxBackend.createParentIfMissing(' + folder + '): ' + parent.join('/'));

	if (parent.length === 0) {
		self._callSuccess(s);
	} else {
		client.mkdir(parent.join('/'), function(error, stat) {
			if (error) {
				console.log('DropboxBackend.createParentIfMissing: mkdir failed: ' + JSON.stringify(error));
				self._callError(f, error);
			} else {
				self._callSuccess(s);
			}
		});
	}
};

DropboxBackend.prototype.readFile = function(filename, s, f) {
	var self = this;
	self.assertInitialized().then(function(client) {
		if (self.options.debug) { console.log('DropboxBackend.readFile: client=' + JSON.stringify(client)); }
		client.readFile(self._encode(filename), function(error, data) {
			if (error) {
				console.log('DropboxBackend.readFile: ' + filename + ' failure: ' + JSON.stringify(error));
				self._callError(f, error);
			} else {
				try {
					self._callSuccess(s, JSON.parse(data));
				} catch (e) {
					self._callError(f, 'DropboxBackend.readFile: failed to parse ' + filename + ': ' + e);
				}
			}
		});
	}, function(err) {
		self._callError(f, 'DropboxBackend.readFile: failed to get dropbox client: ' + err);
	});
};

DropboxBackend.prototype.writeFile = function(filename, data, s, f) {
	var self = this;
	self.assertInitialized().then(function(client) {
		if (self.options.debug) { console.log('DropboxBackend.writeFile: client=' + JSON.stringify(client)); }
		self.createParentIfMissing(filename, client, function() {
			client.writeFile(filename, JSON.stringify(data), function(error, stat) {
				if (self.options.debug) { console.log('DropboxBackend.writeFile: stat=' + JSON.stringify(stat)); }
				if (error) {
					console.log('DropboxBackend.writeFile: error=' + JSON.stringify(error));
					self._callError(f, 'DropboxBackend.writeFile: failed to write to ' + filename + ': ' + error.response);
				} else {
					self._callSuccess(s, stat);
				}
			});
		}, f);
	}, function(err) {
		self._callError(f, 'DropboxBackend.writeFile: failed to get dropbox client: ' + err);
	});
};

DropboxBackend.prototype.removeFile = function(filename, s, f) {
	var self = this;
	self.assertInitialized().then(function(client) {
		if (self.options.debug) { console.log('DropboxBackend.removeFile: client=' + JSON.stringify(client)); }
		client.remove(self._encode(filename), function(error, stat) {
			if (self.options.debug) { console.log('DropboxBackend.removeFile: stat=' + JSON.stringify(stat)); }
			if (error) {
				self._callError(f, 'DropboxBackend.removeFile: failed to remove ' + filename + ': ' + error.response);
			} else {
				self._callSuccess(s, stat);
			}
		});
	}, function(err) {
		self._callError(f, 'DropboxBackend.removeFile: failed to get dropbox client: ' + err);
	});
};

DropboxBackend.prototype.listFiles = function(path, s, f) {
	var self = this;
	self.assertInitialized().then(function(client) {
		if (self.options.debug) { console.log('DropboxBackend.listFiles: client=' + JSON.stringify(client)); }
		client.readdir('/', function(error, entries, stat) {
			if (self.options.debug) { console.log('DropboxBackend.listFiles: stat=' + JSON.stringify(stat)); }
			if (error) {
				self._callError(f, 'DropboxBackend.listFiles: failed to list files at path ' + path + ': ' + error.response);
			} else {
				if (!path.endsWith('/')) {
					path += '/';
				}
				var filtered = entries.map(function(entry) {
					return self._decode(entry).substring(path.length - 1);
				}).filter(function(entry) {
					return (entry !== undefined);
				});
				console.log('entries=',entries);
				console.log('filtered=',filtered);
				self._callSuccess(s, filtered);
			}
		});
	}, function(err) {
		self._callError(f, 'DropboxBackend.listFiles: failed to get dropbox client: ' + err);
	});
};

DropboxBackend.prototype.wipeData = function(s, f) {
	var self = this;
	self.assertInitialized().then(function(client) {
		client.readdir('/', function(error, entries, stat) {
			if (error) {
				if (error.status === 404) {
					self._callSuccess(s);
				} else {
					self._callError(f, 'DropboxBackend.listFiles: failed to list files at /: ' + error.response);
				}
			} else {
				var promises = [];

				var fun = function(entry) {
					return function(resolve, reject) {
						client.remove(entry, function(error, stat) {
							if (error) {
								reject(error);
							} else {
								resolve(stat);
							}
						});
					};
				};

				for (var i=0, len=entries.length, entry; i < len; i++) {
					entry = entries[i];
					promises.push(new Promise(fun(entry)));
				}
				Promise.all(promises).then(function() {
					self._callSuccess(s);
				}, function(err) {
					self._callError(f, 'DropboxBackend.wipeData: failed to remove all entries: ' + err);
				});
			}
		});
	}, function(err) {
		self._callError(f, 'DropboxBackend.wipeData: failed to get dropbox client: ' + err);
	});
};
