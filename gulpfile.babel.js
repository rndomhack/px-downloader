import gulp from "gulp";
import del from "del";
import named from "vinyl-named";
import webpack from "webpack";
import gulpWebpack from "webpack-stream";
import zip from "gulp-zip";

import webpackConfig from "./webpack.config.babel.js";

const paths = {
    clean: [
        "./dist/js/",
        "./dist/lib/",
        "./dist.zip"
    ],
    watch: [
        "./src/js/*.js",
        "./src/lib/*.js"
    ],
    scripts: {
        src: "./src/js/*.js",
        dest: "./dist/js/"
    },
    libraries: {
        src: [
            "./src/lib/browser.js",
            "./vendor/jszip/dist/jszip.min.js",
            "./vendor/gif.js/dist/gif.js",
            "./vendor/gif.js/dist/gif.worker.js"
        ],
        dest: "./dist/lib/"
    },
    zip: {
        src: ["./dist/**", "!./dist/**/*.js.map"],
        dest: "./"
    }
};

export function clean() {
    return del(paths.clean);
}

export function scripts() {
    return gulp.src(paths.scripts.src)
        .pipe(named())
        .pipe(gulpWebpack(webpackConfig, webpack))
        .pipe(gulp.dest(paths.scripts.dest));
}

export function copy() {
    return gulp.src(paths.libraries.src)
        .pipe(gulp.dest(paths.libraries.dest));
}

export function build() {
    return gulp.src(paths.zip.src)
        .pipe(zip("dist.zip"))
        .pipe(gulp.dest(paths.zip.dest));
}

export function watch() {
    gulp.watch(paths.watch, scripts);
}
