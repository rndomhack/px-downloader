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
    constructor({util, url} = {}) {
        super();

        this.util = util || new ExtensionUtil();

        this.url = url || new URL(location.href);

        this.button = null;
    }

    get page() {
        if (this.hasOwnProperty("_page")) return this._page;

        let page;

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
        } else if (/\/novel\/series\/\d+/.test(this.url.pathname)) {
            page = "novelSeries";
        } else {
            page = "";
        }

        this._page = page;

        return page;
    }

    get id() {
        if (this.hasOwnProperty("_id")) return this._id;

        let id;

        switch (this.page) {
            case "illust": {
                id = this.url.pathname.match(/\/artworks\/(\d+)/)[1];

                break;
            }

            case "novel": {
                id = this.url.searchParams.get("id");

                break;
            }

            case "novelSeries": {
                id = this.url.pathname.match(/\/novel\/series\/(\d+)/)[1]

                break;
            }

            default: {
                id = "";

                break;
            }
        }

        this._id = id;

        return id;
    }

    check() {
        return this.page !== "";
    }

    getMacro(data) {
        const macro = {};

        if (data.hasOwnProperty("id")) {
            macro.id = data.id;
        } else {
            macro.id = "";
        }

        if (data.hasOwnProperty("title")) {
            macro.title = data.title;
        } else {
            macro.title = "";
        }

        if (data.hasOwnProperty("userId")) {
            macro.userId = data.userId;
        } else {
            macro.userId = "";
        }

        if (data.hasOwnProperty("userName")) {
            macro.userName = data.userName;
        } else {
            macro.userName = "";
        }

        if (data.hasOwnProperty("seriesNavData") && data.seriesNavData !== null) {
            macro.seriesId = data.seriesNavData.seriesId;
            macro.seriesTitle = data.seriesNavData.title;
        } else {
            macro.seriesId = "";
            macro.seriesTitle = "";
        }

        if (data.hasOwnProperty("createDate")) {
            const date = new Date(data.createDate);

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

    replaceMacro(macro, str, index) {
        if (index !== undefined) {
            let _macro = {};

            _macro.index = index.toString();
            _macro.index2 = index.toString().padStart(2, "0");
            _macro.index3 = index.toString().padStart(3, "0");
            _macro.index4 = index.toString().padStart(4, "0");

            _macro.page = (index + 1).toString();
            _macro.page2 = (index + 1).toString().padStart(2, "0");
            _macro.page3 = (index + 1).toString().padStart(3, "0");
            _macro.page4 = (index + 1).toString().padStart(4, "0");

            macro = Object.assign({}, macro, _macro);
        }

        for (const [key, value] of Object.entries(macro)) {
            str = str.split("${" + key + "}").join(PxContent.escape(value, true));
        }

        return str;
    }

    getDownloaded(id) {
        const value = localStorage.getItem("pxDownloaded");

        if (value === null) return false;

        const downloaded = JSON.parse(value);

        if (!downloaded.includes(id)) return false;

        return true;
    }

    setDownloaded(id) {
        let value = localStorage.getItem("pxDownloaded");

        let downloaded = value === null ? [] : JSON.parse(value);

        if (downloaded.includes(id)) {
            downloaded.splice(downloaded.indexOf(id), 1);
        }

        downloaded.push(id);

        if (downloaded.length > 10000) {
            downloaded = downloaded.slice(-10000);
        }

        value = JSON.stringify(downloaded);

        localStorage.setItem("pxDownloaded", value);
    }

    getFilename(macro, base, ext, index) {
        let filename;

        if (index === undefined) {
            filename = `${this.replaceMacro(macro, base)}.${ext}`;
        } else {
            filename = `${this.replaceMacro(macro, base, index)}.${ext}`;
        }

        filename = filename.replace(/\/+/g, "/").replace(/(^|\/)\./g, "$1\uFF0E").replace(/\.($|\/)/g, "\uFF0E$1").replace(/^\//, "");

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

    async downloadPixiv() {
        const options = await this.util.getOptions(Object.keys(defaultOptions));

        switch (this.page) {
            case "illust": {
                await this.downloadIllust(options);

                break;
            }

            case "novel": {
                await this.downloadNovel(options);

                break;
            }

            case "imageList":
            case "imageSeries": {
                await this.downloadImageList();

                break;
            }

            case "novelList": {
                await this.downloadNovelList();

                break;
            }

            case "novelSeries": {
                await this.downloadNovelSeries();

                break;
            }
        }

        this.setDownloaded(`${this.page}_${this.id}`);
    }

    async downloadIllust(options) {
        this.emit("message", browser.i18n.getMessage("phFetch"));

        const response = await fetch(`https://www.pixiv.net/ajax/illust/${this.id}`, { credentials: "include" });
        const json = await response.json();

        const data = json.body;

        if (data.illustType === 2) {
            // ugoira
            await this.downloadUgoira(options, data);

        } else if (data.pageCount !== 1) {
            // multiple
            await this.downloadMultiple(options, data);

        } else {
            // single
            await this.downloadSingle(options, data);
        }
    }

    async downloadSingle(options, data) {
        const imageUrl = data.urls[options.singleSize];

        const imageRespose = await fetch(imageUrl, { referrer: this.url.href });
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

        const macro = this.getMacro(data);

        await this.download({
            blob: imageBlob,
            filename: this.getFilename(macro, options.singleFilename, this.getExt(imageBlob)),
            conflictAction: options.conflictAction
        });
    }

    async downloadMultiple(options, data) {
        const response = await fetch(`https://www.pixiv.net/ajax/illust/${this.id}/pages`, { credentials: "include" });
        const json = await response.json();

        const pages = json.body;

        const imageUrls = pages.map(page => page.urls[options.multiSize]);

        let imageBlobs = [];

        for (let i = 0; i < imageUrls.length; i++) {
            const imageUrl = imageUrls[i];

            const imageRespose = await fetch(imageUrl, { referrer: this.url.href });
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

        const macro = this.getMacro(data);

        for (let i = 0; i < imageBlobs.length; i++) {
            const imageBlob = imageBlobs[i];

            await this.download({
                blob: imageBlob,
                filename: this.getFilename(macro, options.multiFilename, this.getExt(imageBlob), i),
                conflictAction: options.conflictAction
            });

            this.emit("message", `${browser.i18n.getMessage("phDownload")}: ${Math.floor(((i + 1) / imageBlobs.length) * 100)}%`);
        }
    }

    async downloadUgoira(options, data) {
        const ugoiraResponse = await fetch(`https://www.pixiv.net/ajax/illust/${this.id}/ugoira_meta`, { credentials: "include" });
        const ugoiraJson = await ugoiraResponse.json();
        const ugoiraData = ugoiraJson.body;

        const zipUrl = ugoiraData[{regular: "src", original: "originalSrc"}[options.ugoiraSize]];

        const zipResponse = await fetch(zipUrl, { referrer: this.url.href });
        const zipArrayBuffer = await zipResponse.arrayBuffer();

        let blob;

        switch (options.ugoiraMode) {
            case "zip": {
                blob = await this.convertUgoiraToZip(options, data, ugoiraData, zipArrayBuffer);

                break;
            }

            case "gif": {
                blob = await this.convertUgoiraToGif(options, data, ugoiraData, zipArrayBuffer);

                break;
            }

            case "apng": {
                blob = await this.convertUgoiraToApng(options, data, ugoiraData, zipArrayBuffer);

                break;
            }

            case "webp": {
                blob = await this.convertUgoiraToWebp(options, data, ugoiraData, zipArrayBuffer);

                break;
            }
        }

        this.emit("message", browser.i18n.getMessage("phDownload"));

        const macro = this.getMacro(data);

        await this.download({
            blob: blob,
            filename: this.getFilename(macro, options.singleFilename, this.getExt(blob)),
            conflictAction: options.conflictAction
        });
    }

    async convertUgoiraToZip(options, data, ugoiraData, zipArrayBuffer) {
        this.emit("message", browser.i18n.getMessage("phLoad"));

        const zipObject = await JSZip.loadAsync(zipArrayBuffer);

        zipObject.file("animation.json", JSON.stringify({ ugokuIllustData: ugoiraData }));

        const zipBlob = await zipObject.generateAsync({ type: "blob" });

        return zipBlob;
    }

    async convertUgoiraToGif(options, data, ugoiraData, zipArrayBuffer) {
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

        const gifWorkerResponse = await this.resource("lib/gif.worker.js");
        const gifWorkerBlob = await gifWorkerResponse.blob();
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

    async convertUgoiraToApng(options, data, ugoiraData, zipArrayBuffer) {
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

    async convertUgoiraToWebp(options, data, ugoiraData, zipArrayBuffer) {
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

        const response = await fetch(`https://www.pixiv.net/ajax/novel/${this.id}`, { credentials: "include" });
        const json = await response.json();

        const data = json.body;

        const textBlob = new Blob([data.content.replace(/\r\n|\r|\n/g, "\r\n")], { type: "text/plain" });

        this.emit("message", browser.i18n.getMessage("phDownload"));

        const macro = this.getMacro(data);

        await this.download({
            blob: textBlob,
            filename: this.getFilename(macro, options.novelFilename, this.getExt(textBlob)),
            conflictAction: options.conflictAction
        });
    }

    async downloadNovelSeries() {
        const response = await fetch(`https://www.pixiv.net/ajax/novel/series_content/${this.id}`, { credentials: "include" });
        const json = await response.json();

        const seriesContents = json.body.seriesContents;

        const ids = seriesContents.map(seriesContent => seriesContent.id);

        for (let i = 0; i < ids.length; i++) {
            const id = ids[i];

            const pxContent = new PxContent({
                util: this.util,
                url: new URL(`https://www.pixiv.net/novel/show.php?id=${id}`)
            });

            pxContent.on("message", message => {
                this.emit("message", `[${i + 1} / ${ids.length}]: ${message}`);
            });

            try {
                await pxContent.downloadPixiv();
            } catch (err) {
                throw new Error(`[${i + 1} / ${ids.length}]: ${err.message}`);
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

        // Button element
        const button = document.createElement("button");

        button.classList.add("px-button");

        if (isMobile) {
            button.classList.add("mobile");
            button.classList.add("c-gray-90");
        }

        const listener = async () => {
            button.removeEventListener("click", listener);
            button.disabled = true;

            try {
                await this.downloadPixiv();

                span.textContent = browser.i18n.getMessage("phDone");
                button.classList.add("downloaded");
            } catch (err) {
                span.textContent = browser.i18n.getMessage("phRetry");
                button.classList.remove("downloaded");

                alert(err.message);
                console.error(err);
            }

            button.addEventListener("click", listener);
            button.disabled = false;
        }

        button.addEventListener("click", listener);

        const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");

        icon.setAttributeNS(null, "viewBox", "0 0 32 32");
        icon.setAttributeNS(null, "width", "32");
        icon.setAttributeNS(null, "height", "32");
        icon.insertAdjacentHTML("beforeend", `
            <mask id="mask">
                <rect x="0" y="0" width="32" height="32" fill="white" />
                <path d="M21.358 6.7v6.39H27L16 25.7 5 13.09h5.642V6.7z" />
            </mask>
            <path d="M10.64 5.1c-1.104 0-2 .716-2 1.6v4.8H5c-.745 0-1.428.332-1.773.86s-.294 1.167.133 1.656l11 12.61c.374.43.987.685 1.64.685s1.266-.256 1.64-.685l11-12.61c.426-.49.477-1.127.133-1.656S27.745 11.5 27 11.5h-3.644V6.7c-.001-.883-.895-1.6-2-1.6z" mask="url(#mask)" />
        `);

        button.appendChild(icon);

        const span = document.createElement("span");

        button.appendChild(span);

        if (this.getDownloaded(`${this.page}_${this.id}`)) {
            span.textContent =  browser.i18n.getMessage("phDone");
            button.classList.add("downloaded");
        } else {
            span.textContent = "Px Downloader";
        }

        {
            const parent = document.querySelector("main section div:first-child section, .work-interactions");

            if (parent !== null) {
                if (isMobile) {
                    parent.insertBefore(button, parent.firstChild);
                } else {
                    parent.appendChild(button);
                }
            }
        }

        // Button listener
        const buttonListener = message => {
            span.textContent = message;
        }

        this.on("message", buttonListener);

        // Button observer
        const buttonObserver = new MutationObserver(mutations => {
            if (document.contains(button)) return;

            for (const mutation of mutations) {
                for (const addedNode of mutation.addedNodes) {
                    if (addedNode.nodeType !== Node.ELEMENT_NODE) continue;

                    const parent = addedNode.querySelector("main section div:first-child section, .work-interactions");

                    if (parent === null) continue;

                    if (isMobile) {
                        parent.insertBefore(button, parent.firstChild);
                    } else {
                        parent.appendChild(button);
                    }
                }
            }
        });

        buttonObserver.observe(document, {
            childList: true,
            subtree: true
        });


        this.button = {
            element: button,
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

        // Button observer
        this.button.observer.disconnect();

        // Button listener
        this.off("message", this.button.listener);

        // Button Element
        if (this.button.element.parentNode !== null) {
            this.button.element.parentNode.removeChild(this.button.element);
        }

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

    async fetch(resource, init) {
        let response;

        if (this.util.browser === "chrome") {
            const blobUrl = await this.util.message({
                type: "fetch",
                data: { resource, init }
            });

            response = await fetch(blobUrl);
        } else if (this.util.browser === "firefox") {
            const blob = await this.util.message({
                type: "fetch",
                data: { resource, init }
            });

            response = new Proxy({}, {
                get(target, key) {
                    switch(key) {
                        case "blob": {
                            return async () => blob;
                        }

                        case "arrayBuffer":
                        case "formData":
                        case "json":
                        case "text": {
                            return async () => {
                                const blobUrl = URL.createObjectURL(blob);
                                const blobResponse = await fetch(blobUrl);
                                const blobContent = await blobResponse[key]();

                                URL.revokeObjectURL(blobUrl);

                                return blobContent;
                            }
                        }

                        default: {
                            return target[key];
                        }
                    }
                }
            });
        } else {
            const dataUrl = await this.util.message({
                type: "fetch",
                data: { resource, init }
            });

            response = await fetch(dataUrl);
        }

        return response;
    }

    async resource(path) {
        let response;

        if (this.util.browser === "chrome") {
            const blobUrl = await this.util.message({
                type: "resource",
                data: { path }
            });

            response = await fetch(blobUrl);
        } else if (this.util.browser === "firefox") {
            const blob = await this.util.message({
                type: "resource",
                data: { path }
            });

            response = new Proxy({}, {
                get(target, key) {
                    switch(key) {
                        case "blob": {
                            return async () => blob;
                        }

                        case "arrayBuffer":
                        case "formData":
                        case "json":
                        case "text": {
                            return async () => {
                                const blobUrl = URL.createObjectURL(blob);
                                const blobResponse = await fetch(blobUrl);
                                const blobContent = await blobResponse[key]();

                                URL.revokeObjectURL(blobUrl);

                                return blobContent;
                            }
                        }

                        default: {
                            return target[key];
                        }
                    }
                }
            });
        } else {
            const dataUrl = await this.util.message({
                type: "resource",
                data: { path }
            });

            response = await fetch(dataUrl);
        }

        return response;
    }

    async download(options) {
        let downloadId;

        if (this.util.browser === "chrome") {
            downloadId = await this.util.message({
                type: "download",
                data: {
                    blobUrl: URL.createObjectURL(options.blob),
                    filename: options.filename,
                    conflictAction: options.conflictAction
                }
            });
        } else if (this.util.browser === "firefox") {
            downloadId = await this.util.message({
                type: "download",
                data: {
                    blob: options.blob,
                    filename: options.filename,
                    conflictAction: options.conflictAction
                }
            });
        } else {
            const dataUrl = await new Promise((resolve, reject) => {
                const fileReader = new FileReader();

                fileReader.addEventListener("load", () => {
                    resolve(fileReader.result);
                });

                fileReader.addEventListener("error", err => {
                    reject(err);
                });

                fileReader.readAsDataURL(options.blob);
            });

            downloadId = await this.util.message({
                type: "download",
                data: {
                    dataUrl: dataUrl,
                    filename: options.filename,
                    conflictAction: options.conflictAction
                }
            });
        }

        return downloadId;
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

    static escape(str, flag) {
        return str.replace(flag ? /([/?*:|"<>~\\])/g : /([/?*:|"<>~])/g, PxContent.toFull);
    }
}
