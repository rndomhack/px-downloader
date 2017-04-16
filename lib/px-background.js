/* global ExtensionUtil */
/* exported PxBackground */
"use strict";

class PxBackground {
    init() {
        this.util = new ExtensionUtil();

        // Init message
        this.util.addListener("resource", this.resource.bind(this));
        this.util.addListener("download", this.download.bind(this));

        this.util.listen();

        // Init options
        this.util.initOptions({
            dir: "${userName}(${userId})",
            file: "${title}(${id})",
            page: "${page2}",
            conflictAction: "uniquify",
            convertMode: "none",
            convertQuality: 0.9,
            ugoiraMode: "gif",
            ugoiraQuality: 0.9
        });

        // Init browser action
        browser.browserAction.onClicked.addListener(() => {
            browser.runtime.openOptionsPage();
        });
    }

    resource(options) {
        if (this.util.browser === "chrome") {
            return this.util.fetch({ url: browser.runtime.getURL(options.path), type: "blob" }).then(blob => {
                return URL.createObjectURL(blob);
            });
        } else if (this.util.browser === "firefox") {
            return this.util.fetch({ url: browser.runtime.getURL(options.path), type: "blob" }).then(blob => {
                return blob;
            });
        } else {
            return this.util.fetch({ url: browser.runtime.getURL(options.path), type: "blob" }).then(blob => {
                return this.util.read({ blob: blob, type: "dataurl"});
            });
        }
    }

    download(options) {
        if (this.util.browser === "chrome") {
            return new Promise((resolve, reject) => {
                browser.downloads.download({
                    url: options.blobUrl,
                    filename: options.filename,
                    conflictAction: options.conflictAction
                }, downloadId => {
                    if (downloadId === void(0)) {
                        reject(new Error("Couldn't download file"));
                    }

                    resolve(downloadId);
                });
            });
        } else if (this.util.browser === "firefox") {
            return new Promise((resolve, reject) => {
                browser.downloads.download({
                    url: URL.createObjectURL(options.blob),
                    filename: options.filename,
                    conflictAction: options.conflictAction
                }, downloadId => {
                    if (downloadId === void(0)) {
                        reject(new Error("Couldn't download file"));
                    }

                    resolve(downloadId);
                });
            });
        } else {
            return this.util.fetch({ url: options.dataUrl, type: "blob" }).then(blob => {
                const blobUrl = URL.createObjectURL(blob);

                return new Promise((resolve, reject) => {
                    browser.downloads.download({
                        url: blobUrl,
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
    }
}
