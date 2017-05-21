import path from "path";

export default {
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
                            "env",
                            {
                                targets: {
                                    chrome: 54,
                                    firefox: 52
                                },
                                exclude: [
                                    "transform-regenerator"
                                ]
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
