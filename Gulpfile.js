'use strict';

var gulp = require('gulp');
var $ = require('gulp-load-plugins')();

gulp.task('scripts', function () {
  return gulp.src('./src/index.js')
    .pipe($.browserify())
    .pipe($.uglify())
    .pipe($.rename('bitcoinjs-lib.min.js'))
    .pipe(gulp.dest('./dist/'))
});

gulp.task('build', ['scripts']);