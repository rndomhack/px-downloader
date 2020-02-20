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

    window.addEventListener("load", () => {
        const observer = new MutationObserver(mutations => {
            for (const mutation of mutations) {
                for (const addedNode of mutation.addedNodes) {
                    if (addedNode.querySelector("main section section, .work-interactions") === null) continue;

                    init();

                    return;
                }
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    });
});
