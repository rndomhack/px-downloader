/* global chrome */
"use strict";

document.addEventListener("DOMContentLoaded", () => {
    function getOptions() {
        return new Promise(resolve => {
            chrome.storage.sync.get([
                "dir",
                "file",
                "page",
                "conflictAction",
                "ugoiraMode",
                "gifQuality"
            ], items => {
                resolve(items);
            });
        });
    }

    function setOptions(options) {
        return new Promise(resolve => {
            chrome.storage.sync.set(options, items => {
                resolve(items);
            });
        });
    }

    getOptions().then(options => {
        Object.keys(options).forEach(key => {
            document.querySelector(`#${key}`).value = options[key];
        });

        document.querySelector("#dir").addEventListener("change", ev => {
            setOptions({ dir: ev.currentTarget.value });
        });

        document.querySelector("#file").addEventListener("change", ev => {
            setOptions({ file: ev.currentTarget.value });
        });

        document.querySelector("#page").addEventListener("change", ev => {
            setOptions({ page: ev.currentTarget.value });
        });

        document.querySelector("#conflictAction").addEventListener("change", ev => {
            setOptions({ conflictAction: ev.currentTarget.value });
        });

        document.querySelector("#ugoiraMode").addEventListener("change", ev => {
            setOptions({ ugoiraMode: ev.currentTarget.value });
        });

        document.querySelector("#gifQuality").addEventListener("change", ev => {
            setOptions({ gifQuality: parseInt(ev.currentTarget.value, 10) });
        });
    });
});
