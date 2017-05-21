import browser from "browser";

import ExtensionUtil from "./extension-util";

import defaultOptions from "./default-options";

function browserDownload(options) {
    return new Promise((resolve, reject) => {
        browser.downloads.download(options, downloadId => {
            if (downloadId === void(0)) {
                reject(new Error("Couldn't download file"));
            }

            resolve(downloadId);
        });
    });
}

export default class PxBackground {
    init() {
        this.util = new ExtensionUtil();

        // Init message listeners
        this.util.addListener("resource", this.resource.bind(this));
        this.util.addListener("download", this.download.bind(this));

        this.util.listen();

        // Init options
        this.util.initOptions(defaultOptions);

        // Init browser action
        browser.browserAction.onClicked.addListener(() => {
            browser.runtime.openOptionsPage();
        });

        // Init onDeterminingFilename listener
        if (this.util.browser === "chrome") {
            this.util.getOptions("forceFilename").then(options => {
                if (options.forceFilename !== 1) return;

                this.downloadItemSuggestions = new Map();

                browser.downloads.onDeterminingFilename.addListener((downloadItem, suggest) => {
                    if (!this.downloadItemSuggestions.has(downloadItem.id)) return;

                    const downloadItemSuggestion = this.downloadItemSuggestions.get(downloadItem.id);

                    suggest(downloadItemSuggestion);

                    this.downloadItemSuggestions.delete(downloadItem.id);
                });
            });
        }
    }

    async resource(options) {
        if (this.util.browser === "chrome") {
            const blob = await this.util.fetch({ url: browser.runtime.getURL(options.path), type: "blob" });
            const blobUrl = URL.createObjectURL(blob);

            return blobUrl;
        } else if (this.util.browser === "firefox") {
            const blob = await this.util.fetch({ url: browser.runtime.getURL(options.path), type: "blob" });

            return blob;
        } else {
            const blob = await this.util.fetch({ url: browser.runtime.getURL(options.path), type: "blob" });
            const dataUrl = await this.util.read({ blob: blob, type: "dataurl"});

            return dataUrl;
        }
    }

    async download(options) {
        if (this.util.browser === "chrome") {
            const downloadId = await browserDownload({
                url: options.blobUrl,
                filename: options.filename,
                conflictAction: options.conflictAction
            });

            // Set filename
            if (this.hasOwnProperty("downloadItemSuggestions")) {
                this.downloadItemSuggestions.set(downloadId, {
                    filename: options.filename,
                    conflictAction: options.conflictAction
                });
            }

            return downloadId;
        } else if (this.util.browser === "firefox") {
            const downloadId = await browserDownload({
                url: URL.createObjectURL(options.blob),
                filename: options.filename,
                conflictAction: options.conflictAction
            });

            return downloadId;
        } else {
            const blob = await this.util.fetch({ url: options.dataUrl, type: "blob" });
            const blobUrl = URL.createObjectURL(blob);

            const downloadId = await browserDownload({
                url: blobUrl,
                filename: options.filename,
                conflictAction: options.conflictAction
            });

            return downloadId;
        }
    }
}
