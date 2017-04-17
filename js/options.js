/* global browser, ExtensionUtil */
"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const util = new ExtensionUtil();

    Array.from(document.querySelectorAll("[i18n]")).forEach(elem => {
        elem.textContent = browser.i18n.getMessage(`opt${elem.getAttribute("i18n").replace(/^[a-z]/, str => str.toUpperCase())}`);
    });

    document.querySelector("#reset").addEventListener("click", () => {
        util.setOptions({
            singleFilename: "PxDownloader/${userName}(${userId})/${title}(${id})",
            multiFilename: "PxDownloader/${userName}(${userId})/${title}(${id})/${page2}",
            conflictAction: "uniquify",
            forceFilename: 0,
            convertMode: "none",
            convertQuality: 0.9,
            ugoiraMode: "gif",
            ugoiraQuality: 0.9
        }).then(() => {
            return util.getOptions([
                "singleFilename",
                "multiFilename",
                "conflictAction",
                "forceFilename",
                "convertMode",
                "convertQuality",
                "ugoiraMode",
                "ugoiraQuality"
            ]);
        }).then(options => {
            Object.keys(options).forEach(key => {
                document.querySelector(`#${key}`).value = options[key];
            });
        });
    });

    util.getOptions([
        "singleFilename",
        "multiFilename",
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
});
