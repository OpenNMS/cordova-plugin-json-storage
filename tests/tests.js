exports.defineAutoTests = function() {
	'use strict';

	beforeEach(function() {
		console.log('setting up JSONStorage');
		window.plugins.JSONStorage.setOptions({
			dropboxAppKey: 'kxosloqvbhd0pup',
		});
		window.plugins.JSONStorage.setDebug(true);
		window.plugins.JSONStorage._.init();
	});

	describe('JSONStorage API', function() {
		it('should be defined', function() {
			expect(window.plugins.JSONStorage).toBeDefined();
		});
	});

	//var backends = ['dropbox'];
	var backends = ['local', 'memory'];

	if (navigator.userAgent.indexOf('Android') > 0) {
		// android-only tests
		console.log('Enabled Android tests.');
	} else if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
		backends.push('keychain');
		console.log('Enabled iOS tests.');
	}

	var testBackend = function(backend) {
		describe('backend: ' + backend, function() {
			it('should wipe everything', function(done) {
				window.plugins.JSONStorage.wipeData(
					function success(s) {
						expect(s).toBeDefined();
						expect(s.success).toBe(true);
						done();
					},
					function failure(err) {
						console.log('error should not happen: ' + JSON.stringify(err));
					},
					backend
				);
			});
			it('should not find a file', function(done) {
				window.plugins.JSONStorage.readFile(
					'foo/bar/test.json',
					function success(s) {
						console.log('success should not happen: ' + JSON.stringify(s));
					},
					function failure(err) {
						expect(err).toBeDefined();
						expect(err.success).toBe(false);
						expect(err.error).toBeDefined();
						done();
					},
					backend
				);
			});
			it('should error when there is no directory to list', function(done) {
				window.plugins.JSONStorage.listFiles(
					'foo/bar',
					function success(s) {
						console.log('success should not happen: ' + JSON.stringify(s));
					},
					function failure(err) {
						expect(err).toBeDefined();
						expect(err.success).toBe(false);
						expect(err.error).toBeDefined();
						done();
					},
					backend
				);
			});
			it('should write a test.json to the foo directory', function(done) {
				window.plugins.JSONStorage.writeFile(
					'foo/bar/test.json',
					{boo:'yah'},
					function success(s) {
						expect(s).toBeDefined();
						expect(s.success).toBe(true);
						done();
					},
					function failure(err) {
						console.log('error should not happen: ' + JSON.stringify(err));
					},
					backend
				);
			});
			it('should list one file', function(done) {
				window.plugins.JSONStorage.listFiles(
					'foo/bar',
					function success(s) {
						expect(s).toBeDefined();
						expect(s.success).toBeDefined();
						expect(s.success).toBe(true);
						expect(s.contents).toContain('test.json');
						done();
					},
					function failure(err) {
						console.log('error should not happen: ' + JSON.stringify(err));
					},
					backend
				);
			});
			it('should retrieve the contents of the file', function(done) {
				window.plugins.JSONStorage.readFile(
					'foo/bar/test.json',
					function success(s) {
						expect(s).toBeDefined();
						expect(s.success).toBeDefined();
						expect(s.success).toBe(true);
						expect(s.contents.boo).toBe('yah');
						done();
					},
					function failure(err) {
						console.log('error should not happen: ' + JSON.stringify(err));
					},
					backend
				);
			});
			it('should list no files if there are only subdirectories', function(done) {
				window.plugins.JSONStorage.listFiles(
					'foo',
					function success(s) {
						expect(s).toBeDefined();
						expect(s.success).toBeDefined();
						expect(s.success).toBe(true);
						expect(s.contents).toEqual([]);
						done();
					},
					function failure(err) {
						console.log('error should not happen: ' + JSON.stringify(err));
					},
					backend
				);
			});
		});
	};

	// cross-platform tests
	for (var i=0; i < backends.length; i++) {
		testBackend(backends[i]);
	}
};
