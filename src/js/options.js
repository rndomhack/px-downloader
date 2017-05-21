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
    }

    document.querySelector("#singleFilename").addEventListener("change", ev => {
        util.setOptions({ singleFilename: ev.currentTarget.value });
    });

    document.querySelector("#multiFilename").addEventListener("change", ev => {
        util.setOptions({ multiFilename: ev.currentTarget.value });
    });

    document.querySelector("#conflictAction").addEventListener("change", ev => {
        util.setOptions({ conflictAction: ev.currentTarget.value });
    });

    document.querySelector("#forceFilename").addEventListener("change", ev => {
        util.setOptions({ forceFilename: Number.parseInt(ev.currentTarget.value, 10) });
    });

    document.querySelector("#convertMode").addEventListener("change", ev => {
        util.setOptions({ convertMode: ev.currentTarget.value });
    });

    document.querySelector("#convertQuality").addEventListener("change", ev => {
        util.setOptions({ convertQuality: Number.parseFloat(ev.currentTarget.value) });
    });

    document.querySelector("#ugoiraMode").addEventListener("change", ev => {
        util.setOptions({ ugoiraMode: ev.currentTarget.value });
    });

    document.querySelector("#ugoiraQuality").addEventListener("change", ev => {
        util.setOptions({ ugoiraQuality: Number.parseFloat(ev.currentTarget.value) });
    });

    if (util.browser !== "chrome") {
        document.querySelector("[i18n='settingsForceFilename']").style.display = "none";
        document.querySelector("#forceFilename").style.display = "none";
        document.querySelector("#convertMode option[value='webp']").style.display = "none";
        document.querySelector("#ugoiraMode option[value='webp']").style.display = "none";
    }
});
