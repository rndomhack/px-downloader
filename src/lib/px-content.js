import { EventEmitter } from "events";

import browser from "browser";
import JSZip from "jszip";
import GIF from "gifjs";

import ExtensionUtil from "./extension-util";
import Apng from "./apng";
import Webp from "./webp";

import defaultOptions from "./default-options";

function sleep(msec) {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve();
        }, msec);
    });
}

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

export default class PxContent extends EventEmitter {
    constructor({url, doc} = {}) {
        super();

        this.util = new ExtensionUtil();
        this.url = new URL(url || location.href);
        this.document = doc || document;

        this.page = this.getPage();
        this.pixiv = this.getPixiv();
        this.macro = this.getMacro();
    }

    check() {
        return this.page !== "";
    }

    getPage() {
        let page = "";

        if (this.url.pathname === "/member_illust.php" && this.url.searchParams.get("illust_id") !== null) {
            if (this.document.querySelector(".works_display ._ugoku-illust-player-container") !== null) {
                page = "ugoira";
            } else if (this.document.querySelector(".works_display ._work.multiple.rtl, .works_display ._work.multiple.ltr") !== null) {
                page = "book";
            } else if (this.document.querySelector(".works_display ._work.multiple") !== null) {
                page = "multiple";
            } else if (this.document.querySelector(".works_display ._work.manga") !== null) {
                page = "manga";
            } else {
                page = "illust";
            }
        } else if (this.url.pathname === "/novel/show.php" && this.url.searchParams.get("id") !== null) {
            page = "novel";
        } else if (this.url.pathname === "/member_illust.php") {
            page = "imageList";
        } else if (/\/user\/\d+\/series\/\d+/.test(this.url.pathname)) {
            page = "imageSeries";
        } else if (this.url.pathname === "/novel/member.php") {
            page = "novelList";
        } else if (this.url.pathname === "/series.php" && this.url.searchParams.get("id") !== null) {
            page = "novelSeries";
        }

        return page;
    }

    getPixiv() {
        const pixiv = { context: {} };

        const scriptElements = Array.from(this.document.querySelectorAll("script"));

        for (const scriptElement of scriptElements) {
            let match = null;

            for (const key of ["illustId", "illustTitle", "userId", "userName"]) {
                match = scriptElement.textContent.match(new RegExp(`pixiv\\.context\\.${key}[ \\t]*=[ \\t]*("(\\\\"|.)+?");`));

                if (match === null) continue;

                pixiv.context[key] = JSON.parse(match[1]);
            }

            for (const key of ["ugokuIllustData", "ugokuIllustFullscreenData"]) {
                match = scriptElement.textContent.match(new RegExp(`pixiv\\.context\\.${key}[ \\t]*=[ \\t]*(.+?);`));

                if (match === null) continue;

                pixiv.context[key] = JSON.parse(match[1]);
            }
        }

        return pixiv;
    }

    getMacro() {
        const macro = {};

        if (this.pixiv.context.hasOwnProperty("illustId")) {
            macro.id = this.pixiv.context.illustId;
        } else {
            macro.id = "";
        }

        if (this.pixiv.context.hasOwnProperty("illustTitle")) {
            macro.title = this.pixiv.context.illustTitle;
        } else if (this.document.querySelector(".novel-headinfo .title") !== null) {
            macro.title = this.document.querySelector(".novel-headinfo .title").textContent;
        } else {
            macro.title = "";
        }

        if (this.pixiv.context.hasOwnProperty("userId")) {
            macro.userId = this.pixiv.context.userId;
        } else {
            macro.userId = "";
        }

        if (this.pixiv.context.hasOwnProperty("userName")) {
            macro.userName = this.pixiv.context.userName;
        } else if (this.document.querySelector(".novel-headinfo .author a") !== null) {
            macro.userName = this.document.querySelector(".novel-headinfo .author a").textContent;
        } else {
            macro.userName = "";
        }

        if (this.document.querySelector("._illust-series-title-text") !== null) {
            const elem = this.document.querySelector("._illust-series-title-text");

            macro.seriesName = elem.textContent;
            macro.seriesId = elem.getAttribute("href").match(/\/user\/\d+\/series\/(\d+)/)[1];
        } else if (document.querySelector(".type-series") !== null && document.querySelector(".type-series").parentNode.parentNode.querySelector(".area_title h3 a") !== null) {
            const elem = document.querySelector(".type-series").parentNode.parentNode.querySelector(".area_title h3 a");

            macro.seriesName = elem.textContent;
            macro.seriesId = elem.getAttribute("href").match(/\/series\.php\?id=(\d+)/)[1];
        } else {
            macro.seriesName = "";
            macro.seriesId = "";
        }

        if (this.document.querySelector(".languages .current") !== null && this.document.querySelector(".meta") !== null) {
            const uiLang = this.document.querySelector(".languages .current").textContent.trim();
            const dateString = this.document.querySelector(".meta").firstChild.textContent;

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
            macro.MM = (date.getMonth() + 1).toString().padStart(2, "0");
            macro.D = date.getDate().toString();
            macro.DD = date.getDate().toString().padStart(2, "0");
            macro.weekday = browser.i18n.getMessage("weekdays").split(",")[date.getDay()];
            macro.h = date.getHours().toString();
            macro.hh = date.getHours().toString().padStart(2, "0");
            macro.m = date.getMinutes().toString();
            macro.mm = date.getMinutes().toString().padStart(2, "0");
        } else {
            macro.YYYY = "";
            macro.YY = "";
            macro.M = "";
            macro.MM = "";
            macro.D = "";
            macro.DD = "";
            macro.weekday = "";
            macro.h = "";
            macro.hh = "";
            macro.m = "";
            macro.mm = "";
        }

        return macro;
    }

    getDownloaded() {
        if (!this.macro.hasOwnProperty("id")) return false;

        const value = localStorage.getItem("pxDownloaded");

        if (value === null) return false;

        const downloaded = JSON.parse(value);

        if (!downloaded.includes(this.macro.id)) return false;

        return true;
    }

    setDownloaded() {
        let value = localStorage.getItem("pxDownloaded");

        let downloaded = value === null ? [] : JSON.parse(value);

        if (downloaded.includes(this.macro.id)) {
            downloaded.splice(downloaded.indexOf(this.macro.id), 1);
        }

        downloaded.push(this.macro.id);

        if (downloaded.length > 1000) {
            downloaded = downloaded.slice(-1000);
        }

        value = JSON.stringify(downloaded);

        localStorage.setItem("pxDownloaded", value);
    }

    getFilename(options) {
        let filename;

        if (options.hasOwnProperty("index")) {
            filename = `${this.replacePageMacro(options.multiFilename, options.index)}.${options.ext}`;
        } else {
            filename = `${this.replaceMacro(options.singleFilename)}.${options.ext}`;
        }

        filename = filename.replace(/\/+/g, "/").replace(/(^|\/)\./g, "$1_.").replace(/^\//, "");

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
        macro.index2 = index.toString().padStart(2, "0");
        macro.index3 = index.toString().padStart(3, "0");
        macro.index4 = index.toString().padStart(4, "0");

        macro.page = (index + 1).toString();
        macro.page2 = (index + 1).toString().padStart(2, "0");
        macro.page3 = (index + 1).toString().padStart(3, "0");
        macro.page4 = (index + 1).toString().padStart(4, "0");

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

            case "imageList":
            case "imageSeries": {
                await this.downloadImageList(options);

                break;
            }

            case "novelList":
            case "novelSeries": {
                await this.downloadNovelList(options);

                break;
            }
        }

        this.setDownloaded();
    }

    async downloadIllust(options) {
        this.emit("message", browser.i18n.getMessage("phFetch"));

        const imageUrl = new URL(this.document.querySelector("._illust_modal .wrapper .original-image").getAttribute("data-src"), this.url.href).href;

        let imageBlob = await this.util.fetch({ url: imageUrl, type: "blob", init: { credentials: "include", referrer: this.url.href } });

        if (options.convertMode !== "none") {
            this.emit("message", browser.i18n.getMessage("phConvert"));

            imageBlob = await this.convert({
                blob: imageBlob,
                type: `image/${options.convertMode}`,
                quality: options.convertQuality
            });
        }

        this.emit("message", browser.i18n.getMessage("phDownload"));

        await this.download({
            blob: imageBlob,
            filename: this.getFilename({ singleFilename: options.singleFilename, ext: this.getExt(imageBlob) }),
            conflictAction: options.conflictAction
        });
    }

    async downloadMultiple(options) {
        this.emit("message", browser.i18n.getMessage("phFetch"));

        const firstPageUrl = new URL(this.document.querySelector(".works_display ._work.multiple").getAttribute("href"), this.url.href);
        const firstPageText = await this.util.fetch({ url: firstPageUrl, type: "text", init: { credentials: "include", referrer: this.url.href } });
        const firstPageDomParser = new DOMParser();
        const firstPageDocument = firstPageDomParser.parseFromString(firstPageText, "text/html");
        const firstPageFullSizeContainerElements = Array.from(firstPageDocument.querySelectorAll("a.full-size-container"));

        const secondPageUrls = [];

        for (const firstPageFullSizeContainerElement of firstPageFullSizeContainerElements) {
            secondPageUrls.push(new URL(firstPageFullSizeContainerElement.getAttribute("href"), firstPageUrl).href);
        }

        const imageUrls = [];

        for (const secondPageUrl of secondPageUrls) {
            const secondPageText = await this.util.fetch({ url: secondPageUrl, type: "text", init: { credentials: "include", referrer: this.url.href } });
            const secondPageDomParser = new DOMParser();
            const secondPageDocument = secondPageDomParser.parseFromString(secondPageText, "text/html");

            imageUrls.push(new URL(secondPageDocument.querySelector("img").getAttribute("src"), secondPageUrl).href);
        }

        let imageBlobs = [];

        for (let i = 0; i < imageUrls.length; i++) {
            const imageUrl = imageUrls[i];
            const imageBlob = await this.util.fetch({ url: imageUrl, type: "blob", init: { credentials: "include", referrer: secondPageUrls[i] } });

            this.emit("message", `${browser.i18n.getMessage("phFetch")}: ${Math.floor(((i + 1) / imageUrls.length) * 100)}%`);

            imageBlobs.push(imageBlob);
        }

        if (options.convertMode !== "none") {
            this.emit("message", browser.i18n.getMessage("phConvert"));

            const convertedImageBlobs = [];

            for (let i = 0; i < imageBlobs.length; i++) {
                const imageBlob = imageBlobs[i];

                const convertedImageBlob = await this.convert({
                    blob: imageBlob,
                    type: `image/${options.convertMode}`,
                    quality: options.convertQuality
                });

                this.emit("message", `${browser.i18n.getMessage("phConvert")}: ${Math.floor(((i + 1) / imageBlobs.length) * 100)}%`);

                convertedImageBlobs.push(convertedImageBlob);
            }

            imageBlobs = convertedImageBlobs;
        }

        this.emit("message", browser.i18n.getMessage("phDownload"));

        for (let i = 0; i < imageBlobs.length; i++) {
            const imageBlob = imageBlobs[i];

            await this.download({
                blob: imageBlob,
                filename: this.getFilename({ multiFilename: options.multiFilename, index: i, ext: this.getExt(imageBlob) }),
                conflictAction: options.conflictAction
            });

            this.emit("message", `${browser.i18n.getMessage("phDownload")}: ${Math.floor(((i + 1) / imageBlobs.length) * 100)}%`);
        }
    }

    async downloadBook(options) {
        this.emit("message", browser.i18n.getMessage("phFetch"));

        const pageUrl = new URL(this.document.querySelector(".works_display ._work.multiple").getAttribute("href"), this.url.href);
        const pageText = await this.util.fetch({ url: pageUrl, type: "text", init: { credentials: "include", referrer: this.url.href } });
        const pageDomParser = new DOMParser();
        const pageDocument = pageDomParser.parseFromString(pageText, "text/html");
        const pageScriptElements = Array.from(pageDocument.querySelectorAll("script"));

        const imageUrls = [];

        for (const pageScriptElement of pageScriptElements) {
            const match = pageScriptElement.textContent.match(/pixiv\.context\.originalImages\[(\d+)\][ \t]*=[ \t]*(".+?")/);

            if (match === null) continue;

            imageUrls[Number.parseInt(match[1], 10)] = JSON.parse(match[2]);
        }

        let imageBlobs = [];

        for (let i = 0; i < imageUrls.length; i++) {
            const imageUrl = imageUrls[i];
            const imageBlob = await this.util.fetch({ url: imageUrl, type: "blob", init: { credentials: "include", referrer: pageUrl } });

            this.emit("message", `${browser.i18n.getMessage("phFetch")}: ${Math.floor(((i + 1) / imageUrls.length) * 100)}%`);

            imageBlobs.push(imageBlob);
        }

        if (options.convertMode !== "none") {
            this.emit("message", browser.i18n.getMessage("phConvert"));

            const convertedImageBlobs = [];

            for (let i = 0; i < imageBlobs.length; i++) {
                const imageBlob = imageBlobs[i];

                const convertedImageBlob = await this.convert({
                    blob: imageBlob,
                    type: `image/${options.convertMode}`,
                    quality: options.convertQuality
                });

                this.emit("message", `${browser.i18n.getMessage("phConvert")}: ${Math.floor(((i + 1) / imageBlobs.length) * 100)}%`);

                convertedImageBlobs.push(convertedImageBlob);
            }

            imageBlobs = convertedImageBlobs;
        }

        this.emit("message", browser.i18n.getMessage("phDownload"));

        for (let i = 0; i < imageBlobs.length; i++) {
            const imageBlob = imageBlobs[i];

            await this.download({
                blob: imageBlob,
                filename: this.getFilename({ multiFilename: options.multiFilename, index: i, ext: this.getExt(imageBlob) }),
                conflictAction: options.conflictAction
            });

            this.emit("message", `${browser.i18n.getMessage("phDownload")}: ${Math.floor(((i + 1) / imageBlobs.length) * 100)}%`);
        }
    }

    async downloadManga(options) {
        this.emit("message", browser.i18n.getMessage("phFetch"));

        const pageUrl = new URL(this.document.querySelector(".works_display ._work.manga").getAttribute("href"), this.url.href);
        const pageText = await this.util.fetch({ url: pageUrl, type: "text", init: { credentials: "include", referrer: this.url.href } });
        const pageDomParser = new DOMParser();
        const pageDocument = pageDomParser.parseFromString(pageText, "text/html");

        const imageUrl = pageDocument.querySelector("img").getAttribute("src");
        let imageBlob = await this.util.fetch({ url: imageUrl, type: "blob", init: { credentials: "include", referrer: pageUrl } });

        if (options.convertMode !== "none") {
            this.emit("message", browser.i18n.getMessage("phConvert"));

            imageBlob = await this.convert({
                blob: imageBlob,
                type: `image/${options.convertMode}`,
                quality: options.convertQuality
            });
        }

        this.emit("message", browser.i18n.getMessage("phDownload"));

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
        this.emit("message", browser.i18n.getMessage("phFetch"));

        const ugoiraData = this.pixiv.context.ugokuIllustFullscreenData;

        const zipUrl = new URL(ugoiraData.src, this.url.href).href;
        const zipArrayBuffer = await this.util.fetch({ url: zipUrl, type: "arraybuffer", init: { credentials: "include", referrer: this.url.href } });

        this.emit("message", browser.i18n.getMessage("phLoad"));

        const zipObject = await JSZip.loadAsync(zipArrayBuffer);

        zipObject.file("animation.json", JSON.stringify({ ugokuIllustData: this.pixiv.context.ugokuIllustData }));

        const zipBlob = await zipObject.generateAsync({ type: "blob" });

        this.emit("message", browser.i18n.getMessage("phDownload"));

        await this.download({
            blob: zipBlob,
            filename: this.getFilename({ singleFilename: options.singleFilename, ext: this.getExt(zipBlob) }),
            conflictAction: options.conflictAction
        });
    }

    async downloadUgoiraGif(options) {
        this.emit("message", browser.i18n.getMessage("phFetch"));

        const gifWorkerBlob = await this.resource({ path: "lib/gif.worker.js", type: "text/javascript" });
        const gif = new GIF({
            quality: 1,
            workers: 4,
            workerScript: URL.createObjectURL(gifWorkerBlob)
        });

        const ugoiraData = this.pixiv.context.ugokuIllustFullscreenData;

        const zipUrl = new URL(ugoiraData.src, this.url.href).href;
        const zipArrayBuffer = await this.util.fetch({ url: zipUrl, type: "arraybuffer", init: { credentials: "include", referrer: this.url.href } });

        this.emit("message", browser.i18n.getMessage("phLoad"));

        const zipObject = await JSZip.loadAsync(zipArrayBuffer);

        const loadedImageElements = [];

        for (let i = 0; i < ugoiraData.frames.length; i++) {
            const frame = ugoiraData.frames[i];

            const sourceImageArrayBuffer = await zipObject.file(frame.file).async("arraybuffer");
            const sourceImageBlob = new Blob([sourceImageArrayBuffer], { "type": ugoiraData.mime_type });
            const sourceImageUrl = URL.createObjectURL(sourceImageBlob);

            const loadedImageElement = await getImageElement(sourceImageUrl);

            URL.revokeObjectURL(sourceImageUrl);

            this.emit("message", `${browser.i18n.getMessage("phLoad")}: ${Math.floor(((i + 1) / ugoiraData.frames.length) * 100)}%`);

            loadedImageElements.push(loadedImageElement);
        }

        this.emit("message", browser.i18n.getMessage("phProcess"));

        for (let i = 0; i < loadedImageElements.length; i++) {
            const loadedImageElement = loadedImageElements[i];

            gif.addFrame(loadedImageElement, { delay: ugoiraData.frames[i].delay });
        }

        const imageBlob = await new Promise(resolve => {
            gif.on("progress", ratio => {
                this.emit("message", `${browser.i18n.getMessage("phProcess")}: ${Math.floor(ratio * 100)}%`);
            });

            gif.on("finished", blob => {
                resolve(blob);
            });

            gif.render();
        });

        this.emit("message", browser.i18n.getMessage("phDownload"));

        await this.download({
            blob: imageBlob,
            filename: this.getFilename({ singleFilename: options.singleFilename, ext: this.getExt(imageBlob) }),
            conflictAction: options.conflictAction
        });
    }

    async downloadUgoiraApng(options) {
        this.emit("message", browser.i18n.getMessage("phFetch"));

        const apng = new Apng();

        const ugoiraData = this.pixiv.context.ugokuIllustFullscreenData;

        const zipUrl = new URL(ugoiraData.src, this.url.href).href;
        const zipArrayBuffer = await this.util.fetch({ url: zipUrl, type: "arraybuffer", init: { credentials: "include", referrer: this.url.href } });

        this.emit("message", browser.i18n.getMessage("phConvert"));

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

            this.emit("message", `${browser.i18n.getMessage("phConvert")}: ${Math.floor(((i + 1) / ugoiraData.frames.length) * 100)}%`);

            convertedImageBlobs.push(convertedImageBlob);
        }

        this.emit("message", browser.i18n.getMessage("phProcess"));

        for (let i = 0; i < convertedImageBlobs.length; i++) {
            const convertedImageBlob = convertedImageBlobs[i];

            apng.add(convertedImageBlob, { duration: ugoiraData.frames[i].delay });
        }

        const imageBlob = await apng.render();

        this.emit("message", browser.i18n.getMessage("phDownload"));

        await this.download({
            blob: imageBlob,
            filename: this.getFilename({ singleFilename: options.singleFilename, ext: this.getExt(imageBlob) }),
            conflictAction: options.conflictAction
        });
    }

    async downloadUgoiraWebp(options) {
        this.emit("message", browser.i18n.getMessage("phFetch"));

        const webp = new Webp();

        const ugoiraData = this.pixiv.context.ugokuIllustFullscreenData;

        const zipUrl = new URL(ugoiraData.src, this.url.href).href;
        const zipArrayBuffer = await this.util.fetch({ url: zipUrl, type: "arraybuffer", init: { credentials: "include", referrer: this.url.href } });

        this.emit("message", browser.i18n.getMessage("phConvert"));

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

            this.emit("message", `${browser.i18n.getMessage("phConvert")}: ${Math.floor(((i + 1) / ugoiraData.frames.length) * 100)}%`);

            convertedImageBlobs.push(convertedImageBlob);
        }

        this.emit("message", browser.i18n.getMessage("phProcess"));

        for (let i = 0; i < convertedImageBlobs.length; i++) {
            const convertedImageBlob = convertedImageBlobs[i];

            webp.add(convertedImageBlob, { duration: ugoiraData.frames[i].delay });
        }

        const imageBlob = await webp.render();

        this.emit("message", browser.i18n.getMessage("phDownload"));

        await this.download({
            blob: imageBlob,
            filename: this.getFilename({ singleFilename: options.singleFilename, ext: this.getExt(imageBlob) }),
            conflictAction: options.conflictAction
        });
    }

    async downloadNovel(options) {
        this.emit("message", browser.i18n.getMessage("phFetch"));

        const pageUrl = this.url.href;

        const pageText = await this.util.fetch({ url: pageUrl, type: "text", init: { credentials: "include", referrer: this.url.href } });
        const pageDomParser = new DOMParser();
        const pageDocument = pageDomParser.parseFromString(pageText, "text/html");

        const textBlob = new Blob([pageDocument.querySelector("#novel_text").textContent.replace(/\r\n|\r|\n/g, "\r\n")], { type: "text/plain" });

        this.emit("message", browser.i18n.getMessage("phDownload"));

        await this.download({
            blob: textBlob,
            filename: this.getFilename({ singleFilename: options.novelFilename, ext: this.getExt(textBlob) }),
            conflictAction: options.conflictAction
        });
    }

    async downloadImageList() {
        const itemUrls = Array.from(document.querySelectorAll(".image-item a.work")).map(elem => new URL(elem.getAttribute("href"), this.url.href).href);

        for (let i = 0; i < itemUrls.length; i++) {
            const itemUrl = itemUrls[i];

            const itemText = await this.util.fetch({ url: itemUrl, type: "text", init: { credentials: "include", referrer: this.url.href } });
            const itemDomParser = new DOMParser();
            const itemDocument = itemDomParser.parseFromString(itemText, "text/html");

            const itemPxContent = new PxContent({
                url: itemUrl,
                doc: itemDocument
            });

            itemPxContent.on("message", message => {
                this.emit("message", `[${i + 1} / ${itemUrls.length}]: ${message}`);
            });

            try {
                await itemPxContent.downloadPixiv();
            } catch (err) {
                throw new Error(`[${i + 1} / ${itemUrls.length}]: ${err.message}`);
            }

            await sleep(250);
        }
    }

    async downloadNovelList() {
        const itemUrls = Array.from(document.querySelectorAll("._novel-item .title a")).map(elem => new URL(elem.getAttribute("href"), this.url.href).href);

        for (let i = 0; i < itemUrls.length; i++) {
            const itemUrl = itemUrls[i];

            const itemText = await this.util.fetch({ url: itemUrl, type: "text", init: { credentials: "include", referrer: this.url.href } });
            const itemDomParser = new DOMParser();
            const itemDocument = itemDomParser.parseFromString(itemText, "text/html");

            const itemPxContent = new PxContent({
                url: itemUrl,
                doc: itemDocument
            });

            itemPxContent.on("message", message => {
                this.emit("message", `[${i + 1} / ${itemUrls.length}]: ${message}`);
            });

            try {
                await itemPxContent.downloadPixiv();
            } catch (err) {
                throw new Error(`[${i + 1} / ${itemUrls.length}]: ${err.message}`);
            }

            await sleep(250);
        }
    }

    addButton() {
        switch (this.page) {
            case "ugoira":
            case "book":
            case "multiple":
            case "manga":
            case "illust":
            case "novel": {
                this.addButtonWork();

                break;
            }

            case "imageList":
            case "imageSeries":
            case "novelList":
            case "novelSeries": {
                //this.addButtonList();

                break;
            }
        }
    }

    addButtonWork() {
        const parent = document.querySelector(".user-reaction");

        const div = document.createElement("div");
        const a = document.createElement("a");

        const listener = async () => {
            a.removeEventListener("click", listener);
            a.classList.add("off");

            try {
                await this.downloadPixiv();

                a.textContent = browser.i18n.getMessage("phDone");
            } catch (err) {
                a.textContent = browser.i18n.getMessage("phRetry");

                alert(err.message);
                console.error(err);
            }

            a.addEventListener("click", listener);
            a.classList.remove("off");
        };

        div.style.margin = "15px 0";

        a.classList.add("px-button");
        a.style.width = "150px";
        a.textContent = this.getDownloaded() ? browser.i18n.getMessage("phDone") : "Px Downloader";

        a.addEventListener("click", listener);

        div.appendChild(a);
        parent.insertBefore(div, null);

        this.on("message", message => {
            a.textContent = message;
        });
    }

    addButtonList() {
        const ref = document.querySelector(".column-title") || document.querySelector("._illust-series-detail .header");

        const div = document.createElement("div");
        const a = document.createElement("a");

        const listener = async () => {
            a.removeEventListener("click", listener);
            a.classList.add("off");

            try {
                await this.downloadPixiv();

                a.textContent = browser.i18n.getMessage("phDone");
            } catch (err) {
                a.textContent = browser.i18n.getMessage("phRetry");

                alert(err.message);
                console.error(err);
            }

            a.addEventListener("click", listener);
            a.classList.remove("off");
        };

        div.style.float = "right";
        div.style.margin = "10px 20px";

        a.classList.add("px-button");
        a.style.width = "200px";
        a.textContent = "Px Downloader";

        a.addEventListener("click", listener);

        div.appendChild(a);
        ref.parentNode.insertBefore(div, ref);

        this.on("message", message => {
            a.textContent = message;
        });
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
        return str.replace(flag ? /([/?*:|"<>~\\])/g : /([/?*:|"<>~])/g, PxContent.toFull);
    }

    static toHalf(str) {
        return str.replace(/[\uff01-\uff5e]/g, function(s) {
            return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
        }).split("\u3000").join(" ");
    }

    static toFull(str) {
        return str.replace(/[!-~]/g, function(s) {
            return String.fromCharCode(s.charCodeAt(0) + 0xFEE0);
        }).split(" ").join("\u3000");
    }
}
