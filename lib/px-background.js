/* global browser, ExtensionUtil */
"use strict";

class PxBackground {
    init() {
        this.util = new ExtensionUtil();

        // Init message
        this.util.addListener("resource", this.resource.bind(this));
        this.util.addListener("download", this.download.bind(this));
        this.util.addListener("convert", this.convert.bind(this));

        this.util.listen();

        // Init options
        this.util.initOptions({
            dir: "${userName}(${userId})",
            file: "${title}(${id})",
            page: "${page2}",
            conflictAction: "uniquify",
            ugoiraMode: "gif",
            ugoiraQuality: 0.9
        });

        // Init browser action
        browser.browserAction.onClicked.addListener(() => {
            browser.runtime.openOptionsPage();
        });
    }

    resource(options) {
        return this.util.fetch({ url: browser.runtime.getURL(options.path), type: "blob" }).then(blob => {
            return this.util.read({ blob: blob, type: "dataurl"});
        });
    }

    download(options) {
        return this.util.fetch({ url: options.url, type: "blob" }).then(blob => {
            const url = URL.createObjectURL(blob);

            return new Promise((resolve, reject) => {
                browser.downloads.download({
                    url: url,
                    filename: options.filename,
                    conflictAction: options.conflictAction
                }, downloadId => {
                    if (downloadId === void(0)) {
                        reject(new Error("Couldn't download file"));
                    }

                    resolve(downloadId);
                });
            });
        });
    }

    convert(options) {
        return this.util.fetch({ url: options.url, type: "blob" }).then(blob => {
            const url = URL.createObjectURL(blob);

            return new Promise((resolve, reject) => {
                const canvas = document.createElement("canvas");
                const ctx = canvas.getContext("2d");
                const img = document.createElement("img");

                img.setAttribute("src", url);

                img.addEventListener("load", () => {
                    URL.revokeObjectURL(url);

                    canvas.width = img.width;
                    canvas.height = img.height;

                    ctx.clearRect(0, 0, img.width, img.height);
                    ctx.drawImage(img, 0, 0);

                    resolve(canvas.toDataURL(options.type, options.quality));
                });

                img.addEventListener("error", err => {
                    URL.revokeObjectURL(url);

                    reject(err);
                });
            });
        });
    }
}
