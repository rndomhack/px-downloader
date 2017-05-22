import browser from "browser";
import JSZip from "jszip";
import GIF from "gifjs";

import ExtensionUtil from "./extension-util";
import Apng from "./apng";
import Webp from "./webp";

import defaultOptions from "./default-options";

function getImageElement(url) {
    return new Promise((resolve, reject) => {
        const img = document.createElement("img");

        img.src = url;

        img.addEventListener("load", () => {
            resolve(img);
        });

        img.addEventListener("error", err => {
            reject(err);
        });
    });
}

export default class PxContent {
    init() {
        this.util = new ExtensionUtil();

        this.getPixiv();
        this.getPage();
        this.getMacro();
        this.addButton();
    }

    check() {
        if (location.pathname === "/member_illust.php" && new URLSearchParams(location.search.slice(1)).get("mode") === "medium") return true;
        if (location.pathname === "/novel/show.php") return true;

        return false;
    }

    getPixiv() {
        const script = document.createElement("script");

        script.textContent = `
            (() => {
                let div = document.createElement("div");

                div.setAttribute("id", "getPixiv");
                div.style.display = "none"
                div.textContent = JSON.stringify({
                    context: typeof pixiv === "undefined" ? null : pixiv.context
                });

                document.body.appendChild(div);
            })();
        `;

        document.body.appendChild(script);

        const div = document.querySelector("#getPixiv");

        if (div === null) {
            throw new Error(`getPixiv: ${browser.i18n.getMessage("errGetPixiv")}`);
        }

        const pixiv = JSON.parse(div.textContent);

        this.pixiv = pixiv;
    }

    getPage() {
        let page = "";

        if (document.querySelector(".works_display")) {
            if (document.querySelector(".works_display ._ugoku-illust-player-container")) {
                page = "ugoira";
            } else if (document.querySelector(".works_display ._work.multiple.rtl, .works_display ._work.multiple.ltr")) {
                page = "book";
            } else if (document.querySelector(".works_display ._work.multiple")) {
                page = "multiple";
            } else if (document.querySelector(".works_display ._work.manga")) {
                page = "manga";
            } else {
                page = "illust";
            }
        } else if (document.querySelector(".novel-content")) {
            page = "novel";
        } else {
            throw new Error(`getPage: ${browser.i18n.getMessage("errGetPage")}`);
        }

        this.page = page;
    }

    getMacro() {
        const macro = {};

        macro.id = this.pixiv.context.illustId;
        macro.title = this.pixiv.context.illustTitle || document.querySelector(".work-info").querySelector(".title").textContent;

        macro.userId = this.pixiv.context.userId;
        macro.userName = this.pixiv.context.userName || document.querySelector(".user").textContent;

        const uiLang = document.querySelector(".languages .current").textContent.trim();
        const dateString = document.querySelector(".meta").firstChild.textContent;

        let dateArray, date;

        switch (uiLang) {
            case "日本語":
            case "简体中文":
            case "繁體中文": {
                dateArray = dateString.replace(/ /g, "").split(/[年月日:]/).map(value => parseInt(value, 10));
                date = new Date(dateArray[0], dateArray[1] - 1, dateArray[2], dateArray[3], dateArray[4]);

                break;
            }

            case "English": {
                dateArray = dateString.split(/[/ :]/).map(value => parseInt(value, 10));
                date = new Date(dateArray[2], dateArray[0] - 1, dateArray[1], dateArray[3], dateArray[4]);

                break;
            }

            case "한국어": {
                dateArray = dateString.replace(/ /g, "").split(/[년월일:]/).map(value => parseInt(value, 10));
                date = new Date(dateArray[0], dateArray[1] - 1, dateArray[2], dateArray[3], dateArray[4]);

                break;
            }
        }

        macro.YYYY = date.getFullYear().toString();
        macro.YY = date.getFullYear().toString().slice(-2);
        macro.M = (date.getMonth() + 1).toString();
        macro.MM = `0${date.getMonth() + 1}`.slice(-2);
        macro.D = date.getDate().toString();
        macro.DD = `0${date.getDate()}`.slice(-2);
        macro.weekday = browser.i18n.getMessage("weekdays").split(",")[date.getDay()];
        macro.h = date.getHours().toString();
        macro.hh = `0${date.getHours()}`.slice(-2);
        macro.m = date.getMinutes().toString();
        macro.mm = `0${date.getMinutes()}`.slice(-2);

        this.macro = macro;
    }

    getFilename(options) {
        let filename;

        if (options.hasOwnProperty("index")) {
            filename = `${this.replacePageMacro(options.multiFilename, options.index)}.${options.ext}`;
        } else {
            filename = `${this.replaceMacro(options.singleFilename)}.${options.ext}`;
        }

        filename = filename.replace(/\/+/g, "/").replace(/^\//, "");

        return filename;
    }

    getExt(blob) {
        let ext = "";

        switch (blob.type) {
            case "image/gif": {
                ext = "gif";

                break;
            }

            case "image/jpeg": {
                ext = "jpg";

                break;
            }

            case "image/png": {
                ext = "png";

                break;
            }

            case "image/webp": {
                ext = "webp";

                break;
            }

            case "text/plain": {
                ext = "txt";

                break;
            }

            case "application/zip": {
                ext = "zip";

                break;
            }
        }

        return ext;
    }

    replaceMacro(str) {
        for (const key of Object.keys(this.macro)) {
            str = str.split("${" + key + "}").join(PxContent.escape(this.macro[key], true));
        }

        return str;
    }

    replacePageMacro(str, index) {
        const macro = {};

        macro.index = index.toString();
        macro.index2 = `0${index}`.slice(-2);
        macro.index3 = `00${index}`.slice(-3);
        macro.index4 = `000${index}`.slice(-4);

        macro.page = (index + 1).toString();
        macro.page2 = `0${index + 1}`.slice(-2);
        macro.page3 = `00${index + 1}`.slice(-3);
        macro.page4 = `000${index + 1}`.slice(-4);

        Object.assign(macro, this.macro);

        for (const key of Object.keys(macro)) {
            str = str.split("${" + key + "}").join(PxContent.escape(macro[key], true));
        }

        return str;
    }

    async downloadPixiv() {
        const options = await this.util.getOptions(Object.keys(defaultOptions));

        switch (this.page) {
            case "illust": {
                await this.downloadIllust(options);

                break;
            }

            case "multiple": {
                await this.downloadMultiple(options);

                break;
            }

            case "book": {
                await this.downloadBook(options);

                break;
            }

            case "manga": {
                await this.downloadManga(options);

                break;
            }

            case "ugoira": {
                await this.downloadUgoira(options);

                break;
            }

            case "novel": {
                await this.downloadNovel(options);

                break;
            }
        }
    }

    async downloadIllust(options) {
        this.button.textContent = browser.i18n.getMessage("phFetch");

        const imageUrl = new URL(document.querySelector("._illust_modal .wrapper .original-image").getAttribute("data-src"), location.href).href;

        let imageBlob = await this.util.fetch({ url: imageUrl, type: "blob", init: { credentials: "include", referrer: location.href } });

        if (options.convertMode !== "none") {
            this.button.textContent = browser.i18n.getMessage("phConvert");

            imageBlob = await this.convert({
                blob: imageBlob,
                type: `image/${options.convertMode}`,
                quality: options.convertQuality
            });
        }

        this.button.textContent = browser.i18n.getMessage("phDownload");

        await this.download({
            blob: imageBlob,
            filename: this.getFilename({ singleFilename: options.singleFilename, ext: this.getExt(imageBlob) }),
            conflictAction: options.conflictAction
        });
    }

    async downloadMultiple(options) {
        this.button.textContent = browser.i18n.getMessage("phFetch");

        const firstPageUrl = new URL(document.querySelector(".works_display ._work.multiple").getAttribute("href"), location.href);
        const firstPageText = await this.util.fetch({ url: firstPageUrl, type: "text", init: { credentials: "include", referrer: location.href } });
        const firstPageDomParser = new DOMParser();
        const firstPageDocument = firstPageDomParser.parseFromString(firstPageText, "text/html");
        const firstPageFullSizeContainerElements = Array.from(firstPageDocument.querySelectorAll("a.full-size-container"));

        const secondPageUrls = [];

        for (const firstPageFullSizeContainerElement of firstPageFullSizeContainerElements) {
            secondPageUrls.push(new URL(firstPageFullSizeContainerElement.getAttribute("href"), firstPageUrl).href);
        }

        const imageUrls = [];

        for (const secondPageUrl of secondPageUrls) {
            const secondPageText = await this.util.fetch({ url: secondPageUrl, type: "text", init: { credentials: "include", referrer: location.href } });
            const secondPageDomParser = new DOMParser();
            const secondPageDocument = secondPageDomParser.parseFromString(secondPageText, "text/html");

            imageUrls.push(new URL(secondPageDocument.querySelector("img").getAttribute("src"), secondPageUrl).href);
        }

        let imageBlobs = [];

        for (let i = 0; i < imageUrls.length; i++) {
            const imageUrl = imageUrls[i];
            const imageBlob = await this.util.fetch({ url: imageUrl, type: "blob", init: { credentials: "include", referrer: secondPageUrls[i] } });

            this.button.textContent = `${browser.i18n.getMessage("phFetch")}: ${Math.floor(((i + 1) / imageUrls.length) * 100)}%`;

            imageBlobs.push(imageBlob);
        }

        if (options.convertMode !== "none") {
            this.button.textContent = browser.i18n.getMessage("phConvert");

            const convertedImageBlobs = [];

            for (let i = 0; i < imageBlobs.length; i++) {
                const imageBlob = imageBlobs[i];

                const convertedImageBlob = await this.convert({
                    blob: imageBlob,
                    type: `image/${options.convertMode}`,
                    quality: options.convertQuality
                });

                this.button.textContent = `${browser.i18n.getMessage("phConvert")}: ${Math.floor(((i + 1) / imageBlobs.length) * 100)}%`;

                convertedImageBlobs.push(convertedImageBlob);
            }

            imageBlobs = convertedImageBlobs;
        }

        this.button.textContent = browser.i18n.getMessage("phDownload");

        for (let i = 0; i < imageBlobs.length; i++) {
            const imageBlob = imageBlobs[i];

            await this.download({
                blob: imageBlob,
                filename: this.getFilename({ multiFilename: options.multiFilename, index: i, ext: this.getExt(imageBlob) }),
                conflictAction: options.conflictAction
            });

            this.button.textContent = `${browser.i18n.getMessage("phDownload")}: ${Math.floor(((i + 1) / imageBlobs.length) * 100)}%`;
        }
    }

    async downloadBook(options) {
        this.button.textContent = browser.i18n.getMessage("phFetch");

        const pageUrl = new URL(document.querySelector(".works_display ._work.multiple").getAttribute("href"), location.href);
        const pageText = await this.util.fetch({ url: pageUrl, type: "text", init: { credentials: "include", referrer: location.href } });
        const pageDomParser = new DOMParser();
        const pageDocument = pageDomParser.parseFromString(pageText, "text/html");
        const pageScriptElements = Array.from(pageDocument.querySelectorAll("script"));

        const imageUrls = [];

        for (const pageScriptElement of pageScriptElements) {
            const match = pageScriptElement.textContent.match(/pixiv\.context\.originalImages\[(\d+)\] = (".+?")/);

            if (match === null) continue;

            imageUrls[Number.parseInt(match[1], 10)] = JSON.parse(match[2]);
        }

        let imageBlobs = [];

        for (let i = 0; i < imageUrls.length; i++) {
            const imageUrl = imageUrls[i];
            const imageBlob = await this.util.fetch({ url: imageUrl, type: "blob", init: { credentials: "include", referrer: pageUrl } });

            this.button.textContent = `${browser.i18n.getMessage("phFetch")}: ${Math.floor(((i + 1) / imageUrls.length) * 100)}%`;

            imageBlobs.push(imageBlob);
        }

        if (options.convertMode !== "none") {
            this.button.textContent = browser.i18n.getMessage("phConvert");

            const convertedImageBlobs = [];

            for (let i = 0; i < imageBlobs.length; i++) {
                const imageBlob = imageBlobs[i];

                const convertedImageBlob = await this.convert({
                    blob: imageBlob,
                    type: `image/${options.convertMode}`,
                    quality: options.convertQuality
                });

                this.button.textContent = `${browser.i18n.getMessage("phConvert")}: ${Math.floor(((i + 1) / imageBlobs.length) * 100)}%`;

                convertedImageBlobs.push(convertedImageBlob);
            }

            imageBlobs = convertedImageBlobs;
        }

        this.button.textContent = browser.i18n.getMessage("phDownload");

        for (let i = 0; i < imageBlobs.length; i++) {
            const imageBlob = imageBlobs[i];

            await this.download({
                blob: imageBlob,
                filename: this.getFilename({ multiFilename: options.multiFilename, index: i, ext: this.getExt(imageBlob) }),
                conflictAction: options.conflictAction
            });

            this.button.textContent = `${browser.i18n.getMessage("phDownload")}: ${Math.floor(((i + 1) / imageBlobs.length) * 100)}%`;
        }
    }

    async downloadManga(options) {
        this.button.textContent = browser.i18n.getMessage("phFetch");

        const pageUrl = new URL(document.querySelector(".works_display ._work.manga").getAttribute("href"), location.href);
        const pageText = await this.util.fetch({ url: pageUrl, type: "text", init: { credentials: "include", referrer: location.href } });
        const pageDomParser = new DOMParser();
        const pageDocument = pageDomParser.parseFromString(pageText, "text/html");

        const imageUrl = pageDocument.querySelector("img").getAttribute("src");
        let imageBlob = await this.util.fetch({ url: imageUrl, type: "blob", init: { credentials: "include", referrer: pageUrl } });

        if (options.convertMode !== "none") {
            this.button.textContent = browser.i18n.getMessage("phConvert");

            imageBlob = await this.convert({
                blob: imageBlob,
                type: `image/${options.convertMode}`,
                quality: options.convertQuality
            });
        }

        this.button.textContent = browser.i18n.getMessage("phDownload");

        await this.download({
            blob: imageBlob,
            filename: this.getFilename({ singleFilename: options.singleFilename, ext: this.getExt(imageBlob) }),
            conflictAction: options.conflictAction
        });
    }

    async downloadUgoira(options) {
        switch (options.ugoiraMode) {
            case "zip": {
                await this.downloadUgoiraZip(options);

                break;
            }

            case "gif": {
                await this.downloadUgoiraGif(options);

                break;
            }

            case "apng": {
                await this.downloadUgoiraApng(options);

                break;
            }

            case "webp": {
                await this.downloadUgoiraWebp(options);

                break;
            }
        }
    }

    async downloadUgoiraZip(options) {
        this.button.textContent = browser.i18n.getMessage("phFetch");

        const ugoiraData = this.pixiv.context.ugokuIllustFullscreenData;

        const zipUrl = new URL(ugoiraData.src, location.href).href;
        const zipArrayBuffer = await this.util.fetch({ url: zipUrl, type: "arraybuffer", init: { credentials: "include", referrer: location.href } });

        this.button.textContent = browser.i18n.getMessage("phLoad");

        const zipObject = await JSZip.loadAsync(zipArrayBuffer);

        zipObject.file("animation.json", JSON.stringify({ ugokuIllustData: this.pixiv.context.ugokuIllustData }));

        const zipBlob = await zipObject.generateAsync({ type: "blob" });

        this.button.textContent = browser.i18n.getMessage("phDownload");

        await this.download({
            blob: zipBlob,
            filename: this.getFilename({ singleFilename: options.singleFilename, ext: this.getExt(zipBlob) }),
            conflictAction: options.conflictAction
        });
    }

    async downloadUgoiraGif(options) {
        this.button.textContent = browser.i18n.getMessage("phFetch");

        const gifWorkerBlob = await this.resource({ path: "lib/gif.worker.js", type: "text/javascript" });
        const gif = new GIF({
            quality: 1,
            workers: 4,
            workerScript: URL.createObjectURL(gifWorkerBlob)
        });

        const ugoiraData = this.pixiv.context.ugokuIllustFullscreenData;

        const zipUrl = new URL(ugoiraData.src, location.href).href;
        const zipArrayBuffer = await this.util.fetch({ url: zipUrl, type: "arraybuffer", init: { credentials: "include", referrer: location.href } });

        this.button.textContent = browser.i18n.getMessage("phLoad");

        const zipObject = await JSZip.loadAsync(zipArrayBuffer);

        const loadedImageElements = [];

        for (let i = 0; i < ugoiraData.frames.length; i++) {
            const frame = ugoiraData.frames[i];

            const sourceImageArrayBuffer = await zipObject.file(frame.file).async("arraybuffer");
            const sourceImageBlob = new Blob([sourceImageArrayBuffer], { "type": ugoiraData.mime_type });
            const sourceImageUrl = URL.createObjectURL(sourceImageBlob);

            const loadedImageElement = await getImageElement(sourceImageUrl);

            URL.revokeObjectURL(sourceImageUrl);

            this.button.textContent = `${browser.i18n.getMessage("phLoad")}: ${Math.floor(((i + 1) / ugoiraData.frames.length) * 100)}%`;

            loadedImageElements.push(loadedImageElement);
        }

        this.button.textContent = browser.i18n.getMessage("phProcess");

        for (let i = 0; i < loadedImageElements.length; i++) {
            const loadedImageElement = loadedImageElements[i];

            gif.addFrame(loadedImageElement, { delay: ugoiraData.frames[i].delay });
        }

        const imageBlob = await new Promise(resolve => {
            gif.on("progress", ratio => {
                this.button.textContent = `${browser.i18n.getMessage("phProcess")}: ${Math.floor(ratio * 100)}%`;
            });

            gif.on("finished", blob => {
                resolve(blob);
            });

            gif.render();
        });

        this.button.textContent = browser.i18n.getMessage("phDownload");

        await this.download({
            blob: imageBlob,
            filename: this.getFilename({ singleFilename: options.singleFilename, ext: this.getExt(imageBlob) }),
            conflictAction: options.conflictAction
        });
    }

    async downloadUgoiraApng(options) {
        this.button.textContent = browser.i18n.getMessage("phFetch");

        const apng = new Apng();

        const ugoiraData = this.pixiv.context.ugokuIllustFullscreenData;

        const zipUrl = new URL(ugoiraData.src, location.href).href;
        const zipArrayBuffer = await this.util.fetch({ url: zipUrl, type: "arraybuffer", init: { credentials: "include", referrer: location.href } });

        this.button.textContent = browser.i18n.getMessage("phConvert");

        const zipObject = await JSZip.loadAsync(zipArrayBuffer);

        const convertedImageBlobs = [];

        for (let i = 0; i < ugoiraData.frames.length; i++) {
            const frame = ugoiraData.frames[i];

            const sourceImageArrayBuffer = await zipObject.file(frame.file).async("arraybuffer");
            const sourceImageBlob = new Blob([sourceImageArrayBuffer], { "type": ugoiraData.mime_type });

            const convertedImageBlob = await this.convert({
                blob: sourceImageBlob,
                type: "image/png",
                quality: options.ugoiraQuality
            });

            this.button.textContent = `${browser.i18n.getMessage("phConvert")}: ${Math.floor(((i + 1) / ugoiraData.frames.length) * 100)}%`;

            convertedImageBlobs.push(convertedImageBlob);
        }

        this.button.textContent = browser.i18n.getMessage("phProcess");

        for (let i = 0; i < convertedImageBlobs.length; i++) {
            const convertedImageBlob = convertedImageBlobs[i];

            apng.add(convertedImageBlob, { duration: ugoiraData.frames[i].delay });
        }

        const imageBlob = await apng.render();

        this.button.textContent = browser.i18n.getMessage("phDownload");

        await this.download({
            blob: imageBlob,
            filename: this.getFilename({ singleFilename: options.singleFilename, ext: this.getExt(imageBlob) }),
            conflictAction: options.conflictAction
        });
    }

    async downloadUgoiraWebp(options) {
        this.button.textContent = browser.i18n.getMessage("phFetch");

        const webp = new Webp();

        const ugoiraData = this.pixiv.context.ugokuIllustFullscreenData;

        const zipUrl = new URL(ugoiraData.src, location.href).href;
        const zipArrayBuffer = await this.util.fetch({ url: zipUrl, type: "arraybuffer", init: { credentials: "include", referrer: location.href } });

        this.button.textContent = browser.i18n.getMessage("phConvert");

        const zipObject = await JSZip.loadAsync(zipArrayBuffer);

        const convertedImageBlobs = [];

        for (let i = 0; i < ugoiraData.frames.length; i++) {
            const frame = ugoiraData.frames[i];

            const sourceImageArrayBuffer = await zipObject.file(frame.file).async("arraybuffer");
            const sourceImageBlob = new Blob([sourceImageArrayBuffer], { "type": ugoiraData.mime_type });

            const convertedImageBlob = await this.convert({
                blob: sourceImageBlob,
                type: "image/webp",
                quality: options.ugoiraQuality
            });

            this.button.textContent = `${browser.i18n.getMessage("phConvert")}: ${Math.floor(((i + 1) / ugoiraData.frames.length) * 100)}%`;

            convertedImageBlobs.push(convertedImageBlob);
        }

        this.button.textContent = browser.i18n.getMessage("phProcess");

        for (let i = 0; i < convertedImageBlobs.length; i++) {
            const convertedImageBlob = convertedImageBlobs[i];

            webp.add(convertedImageBlob, { duration: ugoiraData.frames[i].delay });
        }

        const imageBlob = await webp.render();

        this.button.textContent = browser.i18n.getMessage("phDownload");

        await this.download({
            blob: imageBlob,
            filename: this.getFilename({ singleFilename: options.singleFilename, ext: this.getExt(imageBlob) }),
            conflictAction: options.conflictAction
        });
    }

    async downloadNovel(options) {
        this.button.textContent = browser.i18n.getMessage("phFetch");

        const pageUrl = location.href;

        const pageText = await this.util.fetch({ url: pageUrl, type: "text", init: { credentials: "include", referrer: location.href } });
        const pageDomParser = new DOMParser();
        const pageDocument = pageDomParser.parseFromString(pageText, "text/html");

        const textBlob = new Blob([pageDocument.querySelector("#novel_text").textContent.replace(/\r\n|\r|\n/g, "\r\n")], { type: "text/plain" });

        this.button.textContent = browser.i18n.getMessage("phDownload");

        await this.download({
            blob: textBlob,
            filename: this.getFilename({ singleFilename: options.novelFilename, ext: this.getExt(textBlob) }),
            conflictAction: options.conflictAction
        });
    }

    addButton() {
        const parent = document.querySelector(".user-reaction");

        const div = document.createElement("div");
        const a = document.createElement("a");

        const listener = async () => {
            a.removeEventListener("click", listener);
            a.style.setProperty("background-image", "none", "important");

            try {
                await this.downloadPixiv();

                this.button.textContent = browser.i18n.getMessage("phDone");
            } catch (err) {
                this.button.textContent = browser.i18n.getMessage("phRetry");

                alert(err.message);
                console.error(err);
            }

            a.addEventListener("click", listener);
            a.style.removeProperty("background-image");
        };

        div.style.margin = "20px 0 0 auto";

        a.classList.add("_button");
        a.style.width = "120px";
        a.textContent = "Px Downloader";

        a.addEventListener("click", listener);

        div.appendChild(a);
        parent.insertBefore(div, null);

        this.button = a;
    }

    convert(options) {
        const blobUrl = URL.createObjectURL(options.blob);

        return new Promise((resolve, reject) => {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            const img = document.createElement("img");

            img.setAttribute("src", blobUrl);

            img.addEventListener("load", () => {
                URL.revokeObjectURL(blobUrl);

                canvas.width = img.width;
                canvas.height = img.height;

                ctx.clearRect(0, 0, img.width, img.height);
                ctx.drawImage(img, 0, 0);

                canvas.toBlob(blob => resolve(blob), options.type, options.quality);
            });

            img.addEventListener("error", err => {
                URL.revokeObjectURL(blobUrl);

                reject(err);
            });
        });
    }

    resource(options) {
        if (this.util.browser === "chrome") {
            return this.util.message({
                type: "resource",
                data: {
                    path: options.path,
                    type: options.type
                }
            }).then(blobUrl => {
                return this.util.fetch({ url: blobUrl, type: "blob" }).then(blob => {
                    return blob;
                });
            });
        } else if (this.util.browser === "firefox") {
            return this.util.message({
                type: "resource",
                data: {
                    path: options.path,
                    type: options.type
                }
            });
        } else {
            return this.util.message({
                type: "resource",
                data: {
                    path: options.path,
                    type: options.type
                }
            }).then(dataUrl => {
                return this.util.fetch({ url: dataUrl, type: "blob" });
            });
        }
    }

    download(options) {
        if (this.util.browser === "chrome") {
            return this.util.message({
                type: "download",
                data: {
                    blobUrl: URL.createObjectURL(options.blob),
                    filename: options.filename,
                    conflictAction: options.conflictAction
                }
            });
        } else if (this.util.browser === "firefox") {
            return this.util.message({
                type: "download",
                data: {
                    blob: options.blob,
                    filename: options.filename,
                    conflictAction: options.conflictAction
                }
            });
        } else {
            return this.util.read({ blob: options.blob, type: "dataurl" }).then(dataUrl => {
                return this.util.message({
                    type: "download",
                    data: {
                        dataUrl: dataUrl,
                        filename: options.filename,
                        conflictAction: options.conflictAction
                    }
                });
            });
        }
    }

    static escape(str, flag) {
        return str.replace(flag ? /([/\?\*:\|"<>~\\])/g : /([/\?\*:\|"<>~])/g, PxContent.toFull);
    }

    static toHalf(str) {
        return str.replace(/[\uff01-\uff5e]/g, function(s) {
            return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
        }).split("\u3000").join(" ");
    }

    static toFull(str) {
        return str.replace(/[\!-\~]/g, function(s) {
            return String.fromCharCode(s.charCodeAt(0) + 0xFEE0);
        }).split(" ").join("\u3000");
    }
}
