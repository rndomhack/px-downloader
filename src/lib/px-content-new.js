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

        this.button = null;
    }

    check() {
        return this.page !== "";
    }

    async init() {
        this.page = this.getPage();

        if (this.page === "illust" || this.page === "novel") {
            this.data = await this.getData();
            this.userData = await this.getUserData();
            this.macro = this.getMacro();
        }
    }

    getPage() {
        let page = "";

        if (/\/artworks\/\d+/.test(this.url.pathname)) {
            page = "illust";
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

    async getData() {
        let data = null;

        if (this.page === "illust") {
            const id = location.pathname.match(/\/artworks\/(\d+)/)[1];
            const response = await fetch(`https://www.pixiv.net/ajax/illust/${id}`, { credentials: "include" });
            const json = await response.json();

            data = json.body;
        } else if (this.page === "novel") {
            const response = await fetch(`https://www.pixiv.net/ajax/novel/${this.url.searchParams.get("id")}`, { credentials: "include" });
            const json = await response.json();

            data = json.body;
        }

        return data;
    }

    async getUserData() {
        const response = await fetch(`https://www.pixiv.net/ajax/user/${this.data.userId}`, { credentials: "include" });
        const json = await response.json();
        const data = json.body;

        return data;
    }

    getMacro() {
        const macro = {};

        if (this.data.hasOwnProperty("illustId")) {
            macro.id = this.data.illustId;
        } else if (this.data.hasOwnProperty("id")) {
            macro.id = this.data.id;
        } else {
            macro.id = "";
        }

        if (this.data.hasOwnProperty("illustTitle")) {
            macro.title = this.data.illustTitle;
        } else if (this.data.hasOwnProperty("title")) {
            macro.title = this.data.title;
        } else {
            macro.title = "";
        }

        if (this.data.hasOwnProperty("userId")) {
            macro.userId = this.data.userId;
        } else {
            macro.userId = "";
        }

        if (this.userData.hasOwnProperty("name")) {
            macro.userName = this.userData.name;
        } else {
            macro.userName = "";
        }

        if (this.data.hasOwnProperty("seriesNavData") && this.data.seriesNavData !== null) {
            macro.seriesTitle = this.data.seriesNavData.title;
            macro.seriesId = this.data.seriesNavData.seriesId;
        } else {
            macro.seriesName = "";
            macro.seriesId = "";
        }

        if (this.data.hasOwnProperty("createDate")) {
            const date = new Date(this.data.createDate);

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
                if (this.data.illustType === 2) {
                    // ugoira
                    await this.downloadUgoira(options);

                } else if (this.data.pageCount !== 1) {
                    // multiple
                    await this.downloadMultiple(options);

                } else {
                    // illust
                    await this.downloadIllust(options);
                }

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

        const imageUrl = this.data.urls[options.singleSize];

        const imageRespose = await fetch(imageUrl, { credentials: "include", referrer: this.url.href });
        let imageBlob = await imageRespose.blob();

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

        const response = await fetch(`https://www.pixiv.net/ajax/illust/${this.data.illustId}/pages`, { credentials: "include" });
        const json = await response.json();

        const pages = json.body;

        const imageUrls = pages.map(page => page.urls[options.multiSize]);

        let imageBlobs = [];

        for (let i = 0; i < imageUrls.length; i++) {
            const imageUrl = imageUrls[i];

            const imageRespose = await fetch(imageUrl, { credentials: "include", referrer: this.url.href });
            const imageBlob = await imageRespose.blob();

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

    async downloadUgoira(options) {
        this.emit("message", browser.i18n.getMessage("phFetch"));

        const ugoiraResponse = await fetch(`https://www.pixiv.net/ajax/illust/${this.data.illustId}/ugoira_meta`, { credentials: "include" });
        const ugoiraJson = await ugoiraResponse.json();
        const ugoiraData = ugoiraJson.body;

        const zipUrl = ugoiraData[{regular: "src", original: "originalSrc"}[options.ugoiraSize]];

        const zipResponse = await fetch(zipUrl, { credentials: "include", referrer: this.url.href });
        const zipArrayBuffer = await zipResponse.arrayBuffer();

        let blob;

        switch (options.ugoiraMode) {
            case "zip": {
                blob = await this.convertUgoiraToZip(options, ugoiraData, zipArrayBuffer);

                break;
            }

            case "gif": {
                blob = await this.convertUgoiraToGif(options, ugoiraData, zipArrayBuffer);

                break;
            }

            case "apng": {
                blob = await this.convertUgoiraToApng(options, ugoiraData, zipArrayBuffer);

                break;
            }

            case "webp": {
                blob = await this.convertUgoiraToWebp(options, ugoiraData, zipArrayBuffer);

                break;
            }
        }

        this.emit("message", browser.i18n.getMessage("phDownload"));

        await this.download({
            blob: blob,
            filename: this.getFilename({ singleFilename: options.singleFilename, ext: this.getExt(blob) }),
            conflictAction: options.conflictAction
        });
    }

    async convertUgoiraToZip(options, ugoiraData, zipArrayBuffer) {
        this.emit("message", browser.i18n.getMessage("phLoad"));

        const zipObject = await JSZip.loadAsync(zipArrayBuffer);

        zipObject.file("animation.json", JSON.stringify({ ugokuIllustData: ugoiraData }));

        const zipBlob = await zipObject.generateAsync({ type: "blob" });

        return zipBlob;
    }

    async convertUgoiraToGif(options, ugoiraData, zipArrayBuffer) {
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

        const gifWorkerBlob = await this.resource({ path: "lib/gif.worker.js", type: "text/javascript" });
        const gif = new GIF({
            quality: 1,
            workers: 4,
            workerScript: URL.createObjectURL(gifWorkerBlob)
        });

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

        return imageBlob;
    }

    async convertUgoiraToApng(options, ugoiraData, zipArrayBuffer) {
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

        const apng = new Apng();

        for (let i = 0; i < convertedImageBlobs.length; i++) {
            const convertedImageBlob = convertedImageBlobs[i];

            apng.add(convertedImageBlob, { duration: ugoiraData.frames[i].delay });
        }

        const imageBlob = await apng.render();

        return imageBlob;
    }

    async convertUgoiraToWebp(options, ugoiraData, zipArrayBuffer) {
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

        const webp = new Webp();

        for (let i = 0; i < convertedImageBlobs.length; i++) {
            const convertedImageBlob = convertedImageBlobs[i];

            webp.add(convertedImageBlob, { duration: ugoiraData.frames[i].delay });
        }

        const imageBlob = await webp.render();

        return imageBlob;
    }

    async downloadNovel(options) {
        this.emit("message", browser.i18n.getMessage("phFetch"));

        const textBlob = new Blob([this.data.content.replace(/\r\n|\r|\n/g, "\r\n")], { type: "text/plain" });

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
        const isMobile = document.querySelector("div#root") === null;

        let parent;

        if (isMobile) {
            parent = document.querySelector(".work-interactions");
        } else {
            parent = document.querySelector("main section section");
        }

        if (parent === null) {
            setTimeout(this.addButtonWork.bind(this), 100);
            return;
        }

        const div = document.createElement("div");
        const a = document.createElement("a");
        const icon = document.createElement("span");
        const span = document.createElement("span");

        const listener = async () => {
            a.removeEventListener("click", listener);
            a.classList.add("off");

            try {
                await this.downloadPixiv();

                span.textContent = browser.i18n.getMessage("phDone");
            } catch (err) {
                span.textContent = browser.i18n.getMessage("phRetry");

                alert(err.message);
                console.error(err);
            }

            a.addEventListener("click", listener);
            a.classList.remove("off");
        };

        div.style.marginRight = "20px";

        a.classList.add("px-button-new");

        icon.textContent = "⬇";

        span.textContent = this.getDownloaded() ? browser.i18n.getMessage("phDone") : "Px Downloader";

        a.addEventListener("click", listener);

        a.appendChild(icon);
        a.appendChild(span);
        div.appendChild(a);

        if (isMobile) {
            div.classList.add("f-title-xs");
            parent.insertBefore(div, parent.childNodes[1]);
        } else {
            parent.appendChild(div);
        }

        const buttonListener = message => {
            span.textContent = message;
        };

        this.on("message", buttonListener);

        const buttonObserver = new MutationObserver(mutations => {
            const target = Array.from(document.querySelectorAll("main section section")).find(elem => elem.children.length > 2);

            if (target === void 0) return;
            if (!mutations.some(mutation => Array.from(mutation.addedNodes).some(addedNode => addedNode.contains(target)))) return;

            if (this.button.element.parentElement !== null) {
                this.button.element.parentElement.removeChild(this.button.element);
            }

            target.appendChild(this.button.element);
        });

        buttonObserver.observe(document, {
            childList: true,
            subtree: true
        });

        this.button = {
            element: div,
            listener: buttonListener,
            observer: buttonObserver
        };
    }

    removeButton() {
        switch (this.page) {
            case "illust":
            case "novel": {
                this.removeButtonWork();

                break;
            }

            case "imageList":
            case "imageSeries":
            case "novelList":
            case "novelSeries": {
                //this.removeButtonList();

                break;
            }
        }
    }

    removeButtonWork() {
        if (this.button === null) return;

        if (this.button.element.parentElement !== null) {
            this.button.element.parentElement.removeChild(this.button.element);
        }

        this.off("message", this.button.listener);

        this.button.observer.disconnect();

        this.button = null;
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
