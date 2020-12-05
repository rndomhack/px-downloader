import path from "path";
import webpack from "webpack";
import { CleanWebpackPlugin } from "clean-webpack-plugin";
import CopyWebpackPlugin from "copy-webpack-plugin";
import TerserPlugin from "terser-webpack-plugin";

const isProd = process.env.NODE_ENV === "production";

module.exports = {
    mode: isProd ? "production" : "development",
    entry: {
        content: "./src/js/content.js",
        background: "./src/js/background.js",
        options: "./src/js/options.js"
    },
    output: {
        path: path.resolve(__dirname, "dist"),
        filename: "js/[name].js"
    },
    module: {
        rules: [
            {
                test: /\.m?js$/,
                exclude: /node_modules/,
                use: {
                    loader: "babel-loader",
                    options: {
                        presets: [
                            [
                                "@babel/preset-env", {
                                    targets: {
                                        chrome: 72,
                                        firefox: 65
                                    }
                                }
                            ]
                        ]
                    }
                }
            }
        ]
    },
    devtool: isProd ? false : "source-map",
    externals: {
        "webextension-polyfill": "browser",
        "jszip": "JSZip",
        "gif.js": "GIF"
    },
    plugins: [
        new webpack.ProgressPlugin(),
        new CleanWebpackPlugin({
            verbose: true,
            cleanOnceBeforeBuildPatterns: ["js/*", "lib/*"]
        }),
        new CopyWebpackPlugin({
            patterns: [
                { from: "node_modules/webextension-polyfill/dist/browser-polyfill.js", to: "lib/"},
                { from: "node_modules/jszip/dist/jszip.min.js", to: "lib/" },
                { from: "node_modules/gif.js/dist/gif.js", to: "lib/" },
                { from: "node_modules/gif.js/dist/gif.worker.js", to: "lib/" },
                // { from: "node_modules/wasm-imagemagick/dist/magick.js", to: "js/" },
                // { from: "node_modules/wasm-imagemagick/dist/magick.wasm", to: "js/" },
                // { from: "node_modules/@ffmpeg/core/dist/ffmpeg-core.js", to: "lib/" },
                // { from: "node_modules/@ffmpeg/core/dist/ffmpeg-core.wasm", to: "lib/" },
                // { from: "node_modules/@ffmpeg/core/dist/ffmpeg-core.worker.js", to: "lib/" }
            ]
        })
    ],
    optimization: {
        minimizer: [
            new TerserPlugin()
        ]
    }
}