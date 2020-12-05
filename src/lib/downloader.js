import browser from "webextension-polyfill";

class Downloader {
    constructor() {
        this._suggestions = null;
    }

    async download(options) {
        const blob = options.blob;
        const forceFilename = options.forceFilename;
        const disableShelf = options.disableShelf;

        delete options.blob;
        delete options.forceFilename;
        delete options.disableShelf;

        if (blob) {
            options.url = URL.createObjectURL(blob);
        }

        if (forceFilename && this._suggestions === null) {
            this._suggestions = new Map();

            // Init downloads.onDeterminingFilename listener
            browser.downloads.onDeterminingFilename.addListener((downloadItem, suggest) => {
                if (!this._suggestions.has(downloadItem.id)) return;

                const downloadItemSuggestion = this._suggestions.get(downloadItem.id);

                suggest(downloadItemSuggestion);

                this._suggestions.delete(downloadItem.id);
            });
        }

        if (disableShelf) {
            browser.downloads.setShelfEnabled(false);
        }

        const end = () => {
            if (blob) {
                URL.revokeObjectURL(options.url);
            }

            if (disableShelf) {
                browser.downloads.setShelfEnabled(true);
            }
        };

        let downloadId;

        try {
            downloadId = await browser.downloads.download(options);
        } catch (err) {
            end();

            throw err;
        }

        if (forceFilename) {
            this._suggestions.set(downloadId, {
                filename: options.filename,
                conflictAction: options.conflictAction
            });
        }

        if (blob || disableShelf) {
            this.wait(downloadId).then(end);
        }

        return downloadId;
    }

    async wait(downloadId) {
        return new Promise((resolve) => {
            browser.downloads.onChanged.addListener(function onChanged(downloadDelta) {
                if (downloadDelta.id !== downloadId) return;
                if (!downloadDelta.hasOwnProperty("state")) return;
                if (downloadDelta.state.current === "in_progress") return;

                browser.downloads.onChanged.removeListener(onChanged);

                const downloadItem = Object.fromEntries(
                    Object.entries(downloadDelta).map(([key, value]) => [key, key === "id" ? value : value.current])
                );

                resolve(downloadItem);
            });
        });
    }
}

export default new Downloader();
