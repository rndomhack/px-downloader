import PxContent from "../lib/px-content";

document.addEventListener("DOMContentLoaded", () => {
    const pxContent = new PxContent();

    if (pxContent.check()) {
        pxContent.init();
    }
});
