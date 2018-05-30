import PxContent from "../lib/px-content";
import PxContentNew from "../lib/px-content-new";

document.addEventListener("DOMContentLoaded", () => {
    if (document.querySelector("div#root") === null) {
        const pxContent = new PxContent();

        if (pxContent.check()) {
            pxContent.addButton();
        }
    } else {
        let pxContentNew;

        const init = function () {
            (async () => {
                pxContentNew = new PxContentNew();

                await pxContentNew.init();

                if (pxContentNew.check()) {
                    pxContentNew.addButton();
                }
            })().catch(err => {
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
    }
});
