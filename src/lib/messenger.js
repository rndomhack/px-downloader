import browser from "webextension-polyfill";

class Messenger {
    constructor() {
        this.listeners = new Map();

        // Init runtime.onMessage listener
        browser.runtime.onMessage.addListener(async ({ type, data, callbackType }, { tab }) => {
            if (this.listeners.has(type)) {
                let response = {
                    error: null,
                    data: null
                };

                const callback = async (callbackData) => {
                    if (!callbackType) return;

                    await browser.tabs.sendMessage(tab.id, {
                        type: callbackType,
                        data: callbackData
                    });
                }

                try {
                    response.data = await this.listeners.get(type)(data, callback);
                } catch(err) {
                    response.error = err.message;
                }

                return response;
            }
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

    async sendMessage(type, data, callback) {
        let callbackType;

        if (callback) {
            callbackType = `callback_${Math.random().toString(16).slice(2)}`;

            this.addListener(callbackType, callback);
        }

        const response = await browser.runtime.sendMessage({ type, data, callbackType });

        if (response.error) {
            throw new Error(response.error);
        }

        if (response.callback) {
            this.removeListener(callbackType);
        }

        return response.data;
    }
}

export default new Messenger();
