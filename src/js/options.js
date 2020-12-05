import browser from "webextension-polyfill";

import extensionUtil from "../lib/extension-util";

import defaultOptions from "../lib/default-options";

document.addEventListener("DOMContentLoaded", async () => {
    for (const elem of Array.from(document.querySelectorAll("[i18n]"))) {
        elem.textContent = browser.i18n.getMessage(`opt${elem.getAttribute("i18n").replace(/^[a-z]/, str => str.toUpperCase())}`);
    }

    document.querySelector("#reset").addEventListener("click", async () => {
        await extensionUtil.storage.set(defaultOptions);

        const options2 = await extensionUtil.storage.get(Object.keys(defaultOptions));

        for (const [key, value] of Object.entries(options2)) {
            document.querySelector(`#${key}`).value = value;
        }
    });

    const options = await extensionUtil.storage.get(Object.keys(defaultOptions));

    for (const [key, value] of Object.entries(options)) {
        document.querySelector(`#${key}`).value = value;

        switch (typeof value) {
            case "string": {
                document.querySelector(`#${key}`).addEventListener("change", ev => {
                    extensionUtil.storage.set({ [key]: ev.currentTarget.value });
                });

                break;
            }

            case "number": {
                document.querySelector(`#${key}`).addEventListener("change", ev => {
                    extensionUtil.storage.set({ [key]: Number.parseFloat(ev.currentTarget.value) });
                });

                break;
            }
        }
    }

    if (extensionUtil.browser !== "chrome") {
        document.querySelector("[i18n='settingsForceFilename']").style.display = "none";
        document.querySelector("[i18n='settingsDisableShelf']").style.display = "none";
        document.querySelector("#conflictAction option[value='prompt']").style.display = "none";
        document.querySelector("#forceFilename").style.display = "none";
        document.querySelector("#disableShelf").style.display = "none";
        document.querySelector("#convertMode option[value='webp']").style.display = "none";
        document.querySelector("#ugoiraMode option[value='webp']").style.display = "none";
    }
});
