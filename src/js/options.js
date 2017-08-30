import browser from "browser";

import ExtensionUtil from "../lib/extension-util";

import defaultOptions from "../lib/default-options";

document.addEventListener("DOMContentLoaded", async () => {
    const util = new ExtensionUtil();

    for (const elem of Array.from(document.querySelectorAll("[i18n]"))) {
        elem.textContent = browser.i18n.getMessage(`opt${elem.getAttribute("i18n").replace(/^[a-z]/, str => str.toUpperCase())}`);
    }

    document.querySelector("#reset").addEventListener("click", async () => {
        await util.setOptions(defaultOptions);

        const options2 = await util.getOptions(Object.keys(defaultOptions));

        for (const [key, value] of Object.entries(options2)) {
            document.querySelector(`#${key}`).value = value;
        }
    });

    const options = await util.getOptions(Object.keys(defaultOptions));

    for (const [key, value] of Object.entries(options)) {
        document.querySelector(`#${key}`).value = value;

        switch (typeof value) {
            case "string": {
                document.querySelector(`#${key}`).addEventListener("change", ev => {
                    util.setOptions({ [key]: ev.currentTarget.value });
                });

                break;
            }

            case "number": {
                document.querySelector(`#${key}`).addEventListener("change", ev => {
                    util.setOptions({ [key]: Number.parseFloat(ev.currentTarget.value) });
                });

                break;
            }
        }
    }

    if (util.browser !== "chrome") {
        document.querySelector("[i18n='settingsForceFilename']").style.display = "none";
        document.querySelector("#conflictAction option[value='prompt']").style.display = "none";
        document.querySelector("#forceFilename").style.display = "none";
        document.querySelector("#convertMode option[value='webp']").style.display = "none";
        document.querySelector("#ugoiraMode option[value='webp']").style.display = "none";
    }
});
