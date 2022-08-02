import JSZip from "jszip";
import GIF from "gif.js";

import downloader from "./downloader";
import Apng from "./apng";
import Webp from "./webp";
// import { buildInputFile, execute } from "wasm-imagemagick";
// import { createFFmpeg, fetchFile } from "@ffmpeg/ffmpeg";

// const ffmpeg = createFFmpeg();

// let ffmpegPromise = ffmpeg.load();

export default class PxBackground {
    constructor(page, id, options, callback) {
        this._page = page;
        this._id = id;
        this._options = options;
        this._callback = callback;
    }

    get page() {
        return this._page;
    }

    get id() {
        return this._id;
    }

    get options() {
        return this._options;
    }

    get callback() {
        return this._callback;
    }

    async download() {
        switch (this._page) {
            case "illust": {
                await this.downloadIllust();

                break;
            }

            case "novel": {
                await this.downloadNovel();

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
    }

    async downloadIllust() {
        this._callback({ state: "fetch" });

        const response = await fetch(`https://www.pixiv.net/ajax/illust/${this._id}`, { credentials: "include" });
        const json = await response.json();

        const data = json.body;

        if (data.illustType === 2) {
            // ugoira
            await this.downloadUgoira(data);

        } else if (data.pageCount !== 1) {
            // multiple
            await this.downloadMultiple(data);

        } else {
            // single
            await this.downloadSingle(data);
        }
    }

    async downloadSingle(data) {
        const imageUrl = data.urls[this._options.singleSize];

        const imageRespose = await fetch(imageUrl);
        let imageBlob = await imageRespose.blob();

        if (this._options.convertMode !== "none") {
            this._callback({ state: "convert" });

            imageBlob = await this.convert({
                blob: imageBlob,
                type: `image/${this._options.convertMode}`,
                quality: this._options.convertQuality
            });
        }

        this._callback({ state: "download" });

        const macro = PxBackground.getMacro(data);

        await downloader.download({
            blob: imageBlob,
            filename: PxBackground.getFilename(macro, this._options.singleFilename, PxBackground.getExt(imageBlob.type)),
            conflictAction: this._options.conflictAction,
            saveAs: false,
            forceFilename: this._options.forceFilename,
            disableShelf: this._options.disableShelf
        });
    }

    async downloadMultiple(data) {
        const response = await fetch(`https://www.pixiv.net/ajax/illust/${this._id}/pages`, { credentials: "include" });
        const json = await response.json();

        const pages = json.body;

        const imageUrls = pages.map(page => page.urls[this._options.multiSize]);

        let imageBlobs = [];

        for (let i = 0; i < imageUrls.length; i++) {
            const imageUrl = imageUrls[i];

            const imageRespose = await fetch(imageUrl);
            const imageBlob = await imageRespose.blob();

            this._callback({ state: "fetch", progress: (i + 1) / imageUrls.length });

            imageBlobs.push(imageBlob);
        }

        if (this._options.convertMode !== "none") {
            this._callback({ state: "convert" });

            const convertedImageBlobs = [];

            for (let i = 0; i < imageBlobs.length; i++) {
                const imageBlob = imageBlobs[i];

                const convertedImageBlob = await this.convert({
                    blob: imageBlob,
                    type: `image/${this._options.convertMode}`,
                    quality: this._options.convertQuality
                });

                this._callback({ state: "convert", progress: (i + 1) / imageBlobs.length });

                convertedImageBlobs.push(convertedImageBlob);
            }

            imageBlobs = convertedImageBlobs;
        }

        this._callback({ state: "download" });

        const macro = PxBackground.getMacro(data);

        for (let i = 0; i < imageBlobs.length; i++) {
            const imageBlob = imageBlobs[i];

            await downloader.download({
                blob: imageBlob,
                filename: PxBackground.getFilename(macro, this._options.multiFilename, PxBackground.getExt(imageBlob.type), i),
                conflictAction: this._options.conflictAction,
                saveAs: false,
                forceFilename: this._options.forceFilename,
                disableShelf: this._options.disableShelf
            });

            this._callback({ state: "download", progress: (i + 1) / imageBlobs.length });
        }
    }

    async downloadUgoira(data) {
        const ugoiraResponse = await fetch(`https://www.pixiv.net/ajax/illust/${this._id}/ugoira_meta`, { credentials: "include" });
        const ugoiraJson = await ugoiraResponse.json();
        const ugoiraData = ugoiraJson.body;

        const zipUrl = ugoiraData[{regular: "src", original: "originalSrc"}[this._options.ugoiraSize]];

        const zipResponse = await fetch(zipUrl);
        const zipArrayBuffer = await zipResponse.arrayBuffer();

        let blob;

        switch (this._options.ugoiraMode) {
            case "zip": {
                blob = await this.convertUgoiraToZip(ugoiraData, zipArrayBuffer);

                break;
            }

            case "gif": {
                blob = await this.convertUgoiraToGif(ugoiraData, zipArrayBuffer);

                break;
            }

            case "apng": {
                blob = await this.convertUgoiraToApng(ugoiraData, zipArrayBuffer);

                break;
            }

            case "webp": {
                blob = await this.convertUgoiraToWebp(ugoiraData, zipArrayBuffer);

                break;
            }
        }

        this._callback({ state: "download" });

        const macro = PxBackground.getMacro(data);

        await downloader.download({
            blob: blob,
            filename: PxBackground.getFilename(macro, this._options.singleFilename, PxBackground.getExt(blob.type)),
            conflictAction: this._options.conflictAction,
            saveAs: false,
            forceFilename: this._options.forceFilename,
            disableShelf: this._options.disableShelf
        });
    }

    async convertUgoiraToZip(ugoiraData, zipArrayBuffer) {
        this._callback({ state: "load" });

        const zipObject = await JSZip.loadAsync(zipArrayBuffer);

        zipObject.file("animation.json", JSON.stringify({ ugokuIllustData: ugoiraData }));

        const zipBlob = await zipObject.generateAsync({ type: "blob" });

        return zipBlob;
    }

    async convertUgoiraToGif(ugoiraData, zipArrayBuffer) {
        this._callback({ state: "load" });

        const zipObject = await JSZip.loadAsync(zipArrayBuffer);

        const loadedImageElements = [];

        for (let i = 0; i < ugoiraData.frames.length; i++) {
            const frame = ugoiraData.frames[i];

            const sourceImageArrayBuffer = await zipObject.file(frame.file).async("arraybuffer");
            const sourceImageBlob = new Blob([sourceImageArrayBuffer], { "type": ugoiraData.mime_type });
            const sourceImageUrl = URL.createObjectURL(sourceImageBlob);

            const loadedImageElement = await PxBackground.getImageElement(sourceImageUrl);

            URL.revokeObjectURL(sourceImageUrl);

            this._callback({ state: "load", progress: (i + 1) / ugoiraData.frames.length });

            loadedImageElements.push(loadedImageElement);
        }

        this._callback({ state: "process" });

        const gif = new GIF({
            quality: 1,
            workers: 4,
            workerScript: "lib/gif.worker.js"
        });

        for (let i = 0; i < loadedImageElements.length; i++) {
            const loadedImageElement = loadedImageElements[i];

            gif.addFrame(loadedImageElement, { delay: ugoiraData.frames[i].delay });
        }

        const imageBlob = await new Promise(resolve => {
            gif.on("progress", ratio => {
                this._callback({ state: "process", progress: ratio });
            });

            gif.on("finished", blob => {
                resolve(blob);
            });

            gif.render();
        });

        return imageBlob;
    }

    async convertUgoiraToApng(ugoiraData, zipArrayBuffer) {
        this._callback({ state: "convert" });

        const zipObject = await JSZip.loadAsync(zipArrayBuffer);

        const convertedImageBlobs = [];

        for (let i = 0; i < ugoiraData.frames.length; i++) {
            const frame = ugoiraData.frames[i];

            const sourceImageArrayBuffer = await zipObject.file(frame.file).async("arraybuffer");
            const sourceImageBlob = new Blob([sourceImageArrayBuffer], { "type": ugoiraData.mime_type });

            const convertedImageBlob = await this.convert({
                blob: sourceImageBlob,
                type: "image/png",
                quality: this._options.ugoiraQuality
            });

            this._callback({ state: "convert", progress: (i + 1) / ugoiraData.frames.length });

            convertedImageBlobs.push(convertedImageBlob);
        }

        this._callback({ state: "process" });

        const apng = new Apng();

        for (let i = 0; i < convertedImageBlobs.length; i++) {
            const convertedImageBlob = convertedImageBlobs[i];

            apng.add(convertedImageBlob, { duration: ugoiraData.frames[i].delay });
        }

        const imageBlob = await apng.render();

        return imageBlob;
    }

    async convertUgoiraToWebp(ugoiraData, zipArrayBuffer) {
        this._callback({ state: "convert" });

        const zipObject = await JSZip.loadAsync(zipArrayBuffer);

        const convertedImageBlobs = [];

        for (let i = 0; i < ugoiraData.frames.length; i++) {
            const frame = ugoiraData.frames[i];

            const sourceImageArrayBuffer = await zipObject.file(frame.file).async("arraybuffer");
            const sourceImageBlob = new Blob([sourceImageArrayBuffer], { "type": ugoiraData.mime_type });

            const convertedImageBlob = await this.convert({
                blob: sourceImageBlob,
                type: "image/webp",
                quality: this._options.ugoiraQuality
            });

            this._callback({ state: "convert", progress: (i + 1) / ugoiraData.frames.length });

            convertedImageBlobs.push(convertedImageBlob);
        }

        this._callback({ state: "process" });

        const webp = new Webp();

        for (let i = 0; i < convertedImageBlobs.length; i++) {
            const convertedImageBlob = convertedImageBlobs[i];

            webp.add(convertedImageBlob, { duration: ugoiraData.frames[i].delay });
        }

        const imageBlob = await webp.render();

        return imageBlob;
    }

    async downloadNovel() {
        this._callback({ state: "fetch" });

        const response = await fetch(`https://www.pixiv.net/ajax/novel/${this._id}`, { credentials: "include" });
        const json = await response.json();

        const data = json.body;

        const textBlob = new Blob([data.content.replace(/\r\n|\r|\n/g, "\r\n")], { type: "text/plain" });

        this._callback({ state: "download" });

        const macro = PxBackground.getMacro(data);
        let novelFilename
        console.log(macro.seriesId)
        if (macro.seriesId){
            novelFilename = this._options.novelSeriesFilename;
        } else {
            novelFilename = this._options.novelFilename;
        }
        await downloader.download({
            blob: textBlob,
            filename: PxBackground.getFilename(macro, novelFilename, PxBackground.getExt(textBlob.type)),
            conflictAction: this._options.conflictAction,
            saveAs: false,
            forceFilename: this._options.forceFilename,
            disableShelf: this._options.disableShelf
        });
    }

    async convert(options) {
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

        // const imageName = `input.${PxBackground.getExt(options.blob.type)}`;
        // const convertedImageName = `output.${PxBackground.getExt(options.type)}`;

        // const args = [];

        // args.push("-i", imageName);

        // if (options.hasOwnProperty("quality")) {
        //     switch (options.type) {
        //         case "image/jpeg": {
        //             args.push("-qmin", "1");
        //             args.push("-qscale:v", `${Math.floor((1 - options.quality) * 30) + 1}`);

        //             break;
        //         }

        //         case "image/png": {
        //             args.push("-compression_level", `${Math.floor(options.quality * 100)}`);

        //             break;
        //         }

        //         case "image/webp": {
        //             args.push("-qmin", "1");
        //             args.push("-qscale:v", `${Math.floor(options.quality * 100)}`);

        //             break;
        //         }
        //     }
        // }

        // args.push(convertedImageName);

        // ffmpeg.FS("writeFile", imageName, await fetchFile(options.blob));

        // console.log(args);

        // ffmpegPromise = ffmpegPromise.then(() => {
        //     return ffmpeg.run(...args);
        // });

        // await ffmpegPromise;

        // const data = ffmpeg.FS("readFile", convertedImageName);

        // ffmpeg.FS("unlink", imageName);
        // ffmpeg.FS("unlink", convertedImageName);

        // return new Blob([data], { type: options.type });

        // const args = [];

        // if (options.hasOwnProperty("quality")) {
        //     switch (options.type) {
        //         case "image/jpeg":
        //         case "image/webp": {
        //             args.push("-quality", `${Math.max(Math.floor(options.quality * 100), 1)}`);

        //             break;
        //         }

        //         case "image/png": {
        //             args.push("-quality", `${Math.max(Math.min(Math.floor(options.quality * 10), 9), 1)}6`);

        //             break;
        //         }
        //     }
        // }

        // console.log(options.quality, `convert ${imageName} ${args.join(" ")} ${convertedImageName}`);

        // const { outputFiles, exitCode, stderr } = await execute({
        //     inputFiles: [
        //         await buildInputFile(blobUrl, imageName)
        //     ],
        //     commands: [
        //       `convert ${imageName} ${args.join(" ")} ${convertedImageName}`
        //     ]
        // });

        // if (exitCode !== 0) {
        //     throw Error(stderr);
        // }

        // console.log(outputFiles);

        // return new Blob([outputFiles[0].blob], { type: options.type });


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
        return str.replace(flag ? /([/?*:|"<>~\\])/g : /([/?*:|"<>~])/g, PxBackground.toFull);
    }

    static getImageElement(url) {
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

    static getFilename(macro, base, ext, index) {
        let filename;

        if (index === undefined) {
            filename = `${PxBackground.replaceMacro(macro, base)}.${ext}`;
        } else {
            filename = `${PxBackground.replaceMacro(macro, base, index)}.${ext}`;
        }

        filename = filename.replace(/\/+/g, "/").replace(/(^|\/)\./g, "$1\uFF0E").replace(/\.($|\/)/g, "\uFF0E$1").replace(/^\//, "");

        return filename;
    }

    static getExt(type) {
        let ext = "";

        switch (type) {
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

    static getMacro(data) {
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
            macro.seriesId = data.seriesNavData.seriesId.toString();
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
            macro.weekday = new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(date);
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

    static replaceMacro(macro, str, index) {
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
            str = str.split("${" + key + "}").join(PxBackground.escape(value, true));
        }

        return str;
    }
}
