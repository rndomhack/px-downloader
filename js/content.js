/* global PxContent, PxContentWhitecube */
"use strict";

(() => {
    function start() {
        const pxContent = new PxContent();
        const pxContentWhitecube = new PxContentWhitecube();

        if (pxContent.check()) {
            pxContent.init();
        } else if (pxContentWhitecube.check()) {
            pxContentWhitecube.init();
        }
    }

    const script = document.createElement("script");

    script.textContent = `
        (() => {
            const nativePushState = window.history.pushState;

            window.history.pushState = function() {
                nativePushState.apply(window.history, arguments);

                window.postMessage({
                    type: "pushState",
                    data: []
                }, "*");
            };

            window.addEventListener("popstate", function() {
                window.postMessage({
                    type: "popState",
                    data: []
                }, "*");
            });
        })();
    `;

    document.body.appendChild(script);

    window.addEventListener("message", message => {
        if (typeof message !== "object") return;
        if (message.data.type !== "pushState" && message.data.type !== "popState") return;

        start();
    });

    start();
})();
