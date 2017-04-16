/* global browser, ExtensionUtil */
"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const util = new ExtensionUtil();

    Array.from(document.querySelectorAll("[i18n]")).forEach(elem => {
        elem.textContent = browser.i18n.getMessage(`opt${elem.getAttribute("i18n").replace(/^[a-z]/, str => str.toUpperCase())}`);
    });

    util.getOptions([
        "dirname",
        "filename",
        "pagename",
        "conflictAction",
        "forceFilename",
        "convertMode",
        "convertQuality",
        "ugoiraMode",
        "ugoiraQuality"
    ]).then(options => {
        Object.keys(options).forEach(key => {
            document.querySelector(`#${key}`).value = options[key];
        });

        document.querySelector("#dirname").addEventListener("change", ev => {
            util.setOptions({ dirname: ev.currentTarget.value });
        });

        document.querySelector("#filename").addEventListener("change", ev => {
            util.setOptions({ filename: ev.currentTarget.value });
        });

        document.querySelector("#pagename").addEventListener("change", ev => {
            util.setOptions({ pagename: ev.currentTarget.value });
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
            document.querySelector("#options div").removeChild(document.querySelector("[i18n='settingsForceFilename']"));
            document.querySelector("#options div").removeChild(document.querySelector("#forceFilename"));
            document.querySelector("#convertMode").removeChild(document.querySelector("#convertMode option[value='webp']"));
            document.querySelector("#ugoiraMode").removeChild(document.querySelector("#ugoiraMode option[value='webp']"));
        }
    });
});
