/* global browser, ExtensionUtil */
"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const util = new ExtensionUtil();

    Array.from(document.querySelectorAll("[i18n]")).forEach(elem => {
        elem.textContent = browser.i18n.getMessage(`opt${elem.getAttribute("i18n").replace(/^[a-z]/, str => str.toUpperCase())}`);
    });

    util.getOptions([
        "dir",
        "file",
        "page",
        "conflictAction",
        "convertMode",
        "convertQuality",
        "ugoiraMode",
        "ugoiraQuality"
    ]).then(options => {
        Object.keys(options).forEach(key => {
            document.querySelector(`#${key}`).value = options[key];
        });

        document.querySelector("#dir").addEventListener("change", ev => {
            util.setOptions({ dir: ev.currentTarget.value });
        });

        document.querySelector("#file").addEventListener("change", ev => {
            util.setOptions({ file: ev.currentTarget.value });
        });

        document.querySelector("#page").addEventListener("change", ev => {
            util.setOptions({ page: ev.currentTarget.value });
        });

        document.querySelector("#conflictAction").addEventListener("change", ev => {
            util.setOptions({ conflictAction: ev.currentTarget.value });
        });

        document.querySelector("#convertMode").addEventListener("change", ev => {
            util.setOptions({ convertMode: ev.currentTarget.value });
        });

        document.querySelector("#convertQuality").addEventListener("change", ev => {
            util.setOptions({ convertQuality: parseFloat(ev.currentTarget.value) });
        });

        document.querySelector("#ugoiraMode").addEventListener("change", ev => {
            util.setOptions({ ugoiraMode: ev.currentTarget.value });
        });

        document.querySelector("#ugoiraQuality").addEventListener("change", ev => {
            util.setOptions({ ugoiraQuality: parseFloat(ev.currentTarget.value) });
        });

        if (util.browser !== "chrome") {
            document.querySelector("#convertMode").removeChild(document.querySelector("#convertMode option[value='webp']"));
            document.querySelector("#ugoiraMode").removeChild(document.querySelector("#ugoiraMode option[value='webp']"));
        }
    });
});
