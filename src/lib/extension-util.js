import browser from "webextension-polyfill";

class ExtensionUtil {
    constructor() {
        this._storage = null;
        this._browser = null;
    }

    get storage() {
        if (this._storage !== null) return this._storage;

        let storage;

        if (browser.storage.hasOwnProperty("sync")) {
            storage = browser.storage.sync;
        } else {
            storage = browser.storage.local;
        }

        this._storage = storage;

        return storage;
    }

    get browser() {
        if (this._browser !== null) return this._browser;

        let _browser;

        if (navigator.userAgent.includes("Edge")) {
            _browser = "edge";
        } else if (navigator.userAgent.includes("Chrome")) {
            _browser = "chrome";
        } else if (navigator.userAgent.includes("Firefox")) {
            _browser = "firefox";
        } else {
            _browser = "unknown";
        }

        this._browser = _browser;

        return _browser;
    }
}

export default new ExtensionUtil();
