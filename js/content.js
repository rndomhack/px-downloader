/* global PxContent */
"use strict";

(() => {
    var pxContent = new PxContent();

    if (!pxContent.check()) return;

    pxContent.init();
})();
