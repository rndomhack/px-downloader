import PxContent from "../lib/px-content";

document.addEventListener("DOMContentLoaded", () => {
    let pxContent = null;

    function init() {
        try {
            if (pxContent !== null) {
                pxContent.removeButton();
            }

            pxContent = new PxContent();

            if (pxContent.check()) {
                pxContent.addButton();
            }
        } catch(err) {
            console.error(err);
        }
    };

    window.addEventListener("message", async event => {
        const message = event.data;

        if (typeof message !== "object") return;
        if (message.type !== "pxPushState" && message.type !== "pxPopState") return;

        init();
    });

    const script = document.createElement("script");

    script.textContent = `
        "use strict";

        const nativePushState = window.history.pushState;

        window.history.pushState = (...args) => {
            nativePushState.apply(window.history, args);

            window.postMessage({
                type: "pxPushState",
                data: null
            }, "*");
        };

        window.addEventListener("popstate", () => {
            window.postMessage({
                type: "pxPopState",
                data: null
            }, "*");
        });
    `;

    document.body.appendChild(script);

    init();
});