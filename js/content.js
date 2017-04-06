/* global PxContent */
"use strict";

document.addEventListener("DOMContentLoaded", () => {
    function start() {
        const pxContent = new PxContent();

        if (pxContent.check()) {
            pxContent.init();
        }
    }

    start();
});
