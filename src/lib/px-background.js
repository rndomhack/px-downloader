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
        this.util.addListener("fetch", this.fetch.bind(this));
        this.util.addListener("resource", this.resource.bind(this));
        this.util.addListener("download", this.download.bind(this));

        this.util.listen();

        // Init options
        this.util.initOptions(defaultOptions);

        // Init browser action
        browser.browserAction.onClicked.addListener(() => {
            browser.runtime.openOptionsPage();
        });

        if (this.util.browser === "chrome") {
            this.util.getOptions("forceFilename").then(options => {
                if (options.forceFilename !== 1) return;

                this.downloadItemSuggestions = new Map();

                // Init onDeterminingFilename listener
                browser.downloads.onDeterminingFilename.addListener((downloadItem, suggest) => {
                    if (!this.downloadItemSuggestions.has(downloadItem.id)) return;

                    const downloadItemSuggestion = this.downloadItemSuggestions.get(downloadItem.id);

                    suggest(downloadItemSuggestion);

                    this.downloadItemSuggestions.delete(downloadItem.id);
                });
            });

            // Init onHeadersReceived listener
            browser.webRequest.onHeadersReceived.addListener(
                details => {
                    const responseHeader = details.responseHeaders.find(_responseHeader => _responseHeader.name.toLowerCase() === "access-control-allow-origin");

                    if (responseHeader === undefined) {
                        details.responseHeaders.push({
                            name: "Access-Control-Allow-Origin",
                            value: "*"
                        })
                    } else {
                        responseHeader.value = "*";
                    }

                    return { responseHeaders: details.responseHeaders };
                },
                { urls: ["*://*.pximg.net/*"] },
                ["blocking", "responseHeaders", "extraHeaders"]
            );

            // browser.webRequest.onBeforeSendHeaders.addListener(
            //     details => {
            //         const requestHeader = details.requestHeaders.find(_requestHeader => _requestHeader.name.toLowerCase() === "referer");

            //         if (requestHeader === undefined) {
            //             details.requestHeaders.push({
            //                 name: "Referer",
            //                 value: "https://www.pixiv.net/"
            //             })
            //         } else {
            //             requestHeader.value = "https://www.pixiv.net/";
            //         }

            //         return { requestHeaders: details.requestHeaders };
            //     },
            //     { urls: ["*://*.pximg.net/*"] },
            //     ["blocking", "requestHeaders", "extraHeaders"]
            // );
        }
    }

    async fetch({ resource, init }) {
        if (this.util.browser === "chrome") {
            const response = await fetch(resource, init);
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);

            return blobUrl;
        } else if (this.util.browser === "firefox") {
            const response = await fetch(resource, init);
            const blob = await response.blob();

            return blob;
        } else {
            const response = await fetch(resource, init);
            const blob = await response.blob();
            const dataUrl = await new Promise((resolve, reject) => {
                const fileReader = new FileReader();

                fileReader.addEventListener("load", () => {
                    resolve(fileReader.result);
                });

                fileReader.addEventListener("error", err => {
                    reject(err);
                });

                fileReader.readAsDataURL(blob);
            });

            return dataUrl;
        }
    }

    async resource({ path }) {
        if (this.util.browser === "chrome") {
            const response = await fetch(browser.runtime.getURL(path));
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);

            return blobUrl;
        } else if (this.util.browser === "firefox") {
            const response = await fetch(browser.runtime.getURL(path));
            const blob = await response.blob();

            return blob;
        } else {
            const response = await fetch(browser.runtime.getURL(path));
            const blob = await response.blob();
            const dataUrl = await new Promise((resolve, reject) => {
                const fileReader = new FileReader();

                fileReader.addEventListener("load", () => {
                    resolve(fileReader.result);
                });

                fileReader.addEventListener("error", err => {
                    reject(err);
                });

                fileReader.readAsDataURL(blob);
            });

            return dataUrl;
        }
    }

    async download(options) {
        if (this.util.browser === "chrome") {
            const downloadId = await browserDownload({
                url: options.blobUrl,
                filename: options.filename,
                conflictAction: options.conflictAction,
                saveAs: false
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
                conflictAction: options.conflictAction,
                saveAs: false
            });

            return downloadId;
        } else {
            const response = await fetch(options.dataUrl);
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);

            const downloadId = await browserDownload({
                url: blobUrl,
                filename: options.filename,
                conflictAction: options.conflictAction,
                saveAs: false
            });

            return downloadId;
        }
    }
}
