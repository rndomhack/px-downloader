import PxContent from "../lib/px-content";

document.addEventListener("DOMContentLoaded", () => {
    let promise = Promise.resolve();

    let pxContent = null;

    const init = function () {
        promise = promise.then(async () => {
            if (pxContent !== null) {
                pxContent.removeButton();
            }

            pxContent = new PxContent();

            await pxContent.init();

            if (pxContent.check()) {
                pxContent.addButton();
            }
        }).catch(err => {
            console.error(err);
        });
    };

    const script = document.createElement("script");

    script.textContent = `
        (() => {
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
        })();
    `;

    document.body.appendChild(script);

    window.addEventListener("message", async event => {
        const message = event.data;

        if (typeof message !== "object") return;
        if (message.type !== "pxPushState" && message.type !== "pxPopState") return;

        init();
    });

    window.addEventListener("load", () => {
        init();
    });
});
