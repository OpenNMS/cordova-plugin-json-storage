var gulp       = require('gulp');
var concat     = require('gulp-concat');
var sourcemaps = require('gulp-sourcemaps');
var jshint     = require('gulp-jshint');

gulp.task('default', ['lint', 'build']);

gulp.task('lint', function() {
	gulp.src(['./src/js/*.js', './src/js/backends/*.js', './tests/*.js'])
		.pipe(jshint())
		.pipe(jshint.reporter('jshint-stylish'))
		.pipe(jshint.reporter('fail'));
});

gulp.task('build', function() {
	gulp.src(['./src/js/3rdparty/*.js', './src/js/backends/*.js', './src/js/*.js'])
		.pipe(sourcemaps.init())
		.pipe(concat('json-storage.js', {newLine:"\n\n/******/\n\n"}))
		.pipe(sourcemaps.write())
		.pipe(gulp.dest('./www/'));
});
