var gulp = require('gulp');
var concat = require('gulp-concat');
var sourcemaps = require('gulp-sourcemaps');
var jshint = require('gulp-jshint');

gulp.task('default', ['lint', 'concat']);

gulp.task('lint', function() {
	gulp.src(['./src/js/**/*.js'])
		.pipe(jshint())
		.pipe(jshint.reporter('jshint-stylish'))
		.pipe(jshint.reporter('fail'));
});

gulp.task('concat', function() {
	gulp.src('./src/js/**/*.js')
		.pipe(sourcemaps.init())
		.pipe(concat('cloud-storage.js'))
		.pipe(sourcemaps.write())
		.pipe(gulp.dest('./www/'));
});
