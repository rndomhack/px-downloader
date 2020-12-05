import browser from "webextension-polyfill";

import extensionUtil from "../lib/extension-util";
import messenger from "../lib/messenger";
import PxBackground from "../lib/px-background";

import defaultOptions from "../lib/default-options.json"

(async () => {
    // Update options
    await extensionUtil.storage.set(
        Object.assign(
            defaultOptions,
            await extensionUtil.storage.get(Object.keys(defaultOptions))
        )
    );

    // Init browser action
    browser.browserAction.onClicked.addListener(() => {
        browser.runtime.openOptionsPage();
    });

    // Init webRequest.onBeforeSendHeaders listener
    browser.webRequest.onBeforeSendHeaders.addListener(
        (details) => {
            const requestHeader = details.requestHeaders.find(_requestHeader => _requestHeader.name.toLowerCase() === "referer");

            if (requestHeader === undefined) {
                details.requestHeaders.push({
                    name: "Referer",
                    value: "https://www.pixiv.net/"
                })
            } else {
                requestHeader.value = "https://www.pixiv.net/";
            }

            return { requestHeaders: details.requestHeaders };
        },
        { urls: ["*://*.pximg.net/*"] },
        ["blocking", "requestHeaders"].concat(extensionUtil.browser === "firefox" ? [] : ["extraHeaders"])
    );

    // Init message listeners
    messenger.addListener("download", async ({page, id}, callback) => {
        const options = await extensionUtil.storage.get(Object.keys(defaultOptions));

        const pxBackground = new PxBackground(page, id, options, callback);

        await pxBackground.download();
    });
})();
