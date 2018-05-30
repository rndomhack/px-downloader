import path from "path";

export default {
    mode: "production",
    module: {
        rules: [
            {
                test: /\.js$/,
                include: [
                    path.resolve(__dirname, "src"),
                    path.resolve(__dirname, "lib")
                ],
                loader: "babel-loader",
                options: {
                    presets: [
                        [
                            "@babel/preset-env",
                            {
                                targets: {
                                    chrome: 60,
                                    firefox: 58
                                }
                            }
                        ]
                    ]
                }
            }
        ]
    },
    devtool: "source-map",
    externals: {
        browser: "browser",
        jszip: "JSZip",
        gifjs: "GIF"
    }
};
