/* global browser */
"use strict";

class ExtensionUtil {
    constructor() {
        /*if (browser.storage.hasOwnProperty("sync")) {*/
        if (navigator.userAgent.includes("Chrome")) {
            this.storage = browser.storage.sync;
        } else {
            this.storage = browser.storage.local;
        }

        if (navigator.userAgent.includes("Edge")) {
            this.browser = "edge";
        } else if (navigator.userAgent.includes("Chrome")) {
            this.browser = "chrome";
        } else if (navigator.userAgent.includes("Firefox")) {
            this.browser = "firefox";
        } else {
            this.browser = "unknown";
        }

        this.listeners = new Map();
    }

    listen() {
        browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (this.listeners.has(message.type)) {
                this.listeners.get(message.type)(message.data).then(value => {
                    sendResponse({ error: null, data: value });
                }).catch(err => {
                    sendResponse({ error: err.message, data: null });
                });
            }

            return true;
        });
    }

    addListener(type, listener) {
        if (this.listeners.has(type)) return false;

        this.listeners.set(type, listener);

        return true;
    }

    removeListener(type) {
        if (!this.listeners.has(type)) return false;

        this.listeners.delete(type);

        return true;
    }

    message(options) {
        return new Promise((resolve, reject) => {
            browser.runtime.sendMessage({
                type: options.type,
                data: options.data
            }, response => {
                if (response.error) {
                    reject(new Error(response.error));
                }

                resolve(response.data);
            });
        });
    }

    getOptions(keys) {
        return new Promise(resolve => {
            this.storage.get(keys, options => {
                resolve(options);
            });
        });
    }

    setOptions(options) {
        return new Promise(resolve => {
            this.storage.set(options, () => {
                resolve();
            });
        });
    }

    initOptions(options) {
        return this.getOptions(Object.keys(options)).then(oldOptions => {
            return this.setOptions(Object.assign(options, oldOptions));
        });
    }

    fetch(options) {
        return fetch(options.url, options.init).then(response => {
            switch (options.type) {
                case "arraybuffer": {
                    return response.arrayBuffer();
                }

                case "blob": {
                    return response.blob();
                }

                case "formdata": {
                    return response.formData();
                }

                case "json": {
                    return response.json();
                }

                case "text": {
                    return response.text();
                }

                default: {
                    throw new Error("Invalid type");
                }
            }
        });
    }

    read(options) {
        return new Promise((resolve, reject) => {
            const fileReader = new FileReader();

            fileReader.addEventListener("load", () => {
                resolve(fileReader.result);
            });

            fileReader.addEventListener("error", err => {
                reject(err);
            });

            switch (options.type) {
                case "arraybuffer": {
                    fileReader.readAsArrayBuffer(options.blob);
                    break;
                }

                case "dataurl": {
                    fileReader.readAsDataURL(options.blob);
                    break;
                }

                case "text": {
                    fileReader.readAsText(options.blob);
                    break;
                }

                default: {
                    throw new Error("Invalid type");
                }
            }
        });
    }
}
