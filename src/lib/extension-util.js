import browser from "browser";

export default class ExtensionUtil {
    constructor() {
        if (browser.storage.hasOwnProperty("sync")) {
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
                this.listeners.get(message.type)(message.data).then(data => {
                    sendResponse({ error: null, data });
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
}
