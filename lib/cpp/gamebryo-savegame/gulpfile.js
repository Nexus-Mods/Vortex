let gulp  = require('gulp');
let gutil = require('gulp-util');
let download = require('gulp-downloader');
let unzip = require('gulp-unzip');

gulp.task('download-lz4', () => {
    download('https://github.com/lz4/lz4/releases/download/v1.7.4.2/lz4_v1_7_4_win64.zip')
    .pipe(unzip())
    .pipe(gulp.dest('lz4'));
});

gulp.task('default', () => {
  return gutil.log('Gulp is running!')
});
