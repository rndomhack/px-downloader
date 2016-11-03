/* global chrome */
"use strict";

const storage = chrome.storage.hasOwnProperty("sync") ? chrome.storage.sync : chrome.storage.local;

class PxBackground {
    init() {
        storage.get("check", items => {
            if (items.hasOwnProperty("check")) return;

            storage.set({
                check: true,
                dir: "${userName}(${userId})",
                file: "${title}(${id})",
                page: "${page2}",
                conflictAction: "uniquify",
                ugoiraMode: "gif",
                ugoiraQuality: 0.9
            });
        });

        chrome.browserAction.onClicked.addListener(() => {
            chrome.runtime.openOptionsPage();
        });

        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.listener(message, sender, sendResponse);
            return true;
        });
    }

    listener(message, sender, sendResponse) {
        switch (message.type) {
            case "get":
                this.get(message.data).then(value => {
                    sendResponse({ error: null, data: value });
                }).catch(err => {
                    sendResponse({ error: err.message, data: null });
                });
                break;

            case "download":
                this.download(message.data).then(value => {
                    sendResponse({ error: null, data: value });
                }).catch(err => {
                    sendResponse({ error: err.message, data: null });
                });
                break;

            case "convert":
                this.convert(message.data).then(value => {
                    sendResponse({ error: null, data: value });
                }).catch(err => {
                    sendResponse({ error: err.message, data: null });
                });
                break;
        }
    }

    get(options) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();

            xhr.addEventListener("load", () => {
                resolve(xhr.response);
            });

            xhr.addEventListener("error", err => {
                reject(err);
            });

            xhr.open("GET", options.url);
            xhr.responseType = options.type;
            xhr.withCredentials = true;
            xhr.send();
        });
    }

    download(options) {
        return new Promise((resolve, reject) => {
            chrome.downloads.download({
                url: options.url,
                filename: `PxDownloader/${options.dir}/${options.file}`,
                conflictAction: options.conflictAction || "uniquify"
            }, downloadId => {
                if (downloadId === void(0)) {
                    reject(new Error("Couldn't download file"));
                }

                resolve(downloadId);
            });
        });
    }

    convert(options) {
        return new Promise((resolve, reject) => {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            const img = document.createElement("img");

            img.setAttribute("src", options.url);

            img.addEventListener("load", () => {
                canvas.width = img.width;
                canvas.height = img.height;

                ctx.clearRect(0, 0, img.width, img.height);
                ctx.drawImage(img, 0, 0);

                const dataURL = canvas.toDataURL(options.type || "image/png", options.quality || 1);
                const binary = atob(dataURL.split(",")[1]);
                const buffer = new Uint8Array(binary.length);

                for (let i = 0; i < binary.length; i++) {
                    buffer[i] = binary.charCodeAt(i);
                }

                const blob = new Blob([buffer], { type: options.type });

                resolve(URL.createObjectURL(blob));
            });

            img.addEventListener("error", err => {
                reject(err);
            });
        });
    }
}
