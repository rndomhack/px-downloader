/* global ExtensionUtil, JSZip, GIF, APng, WebP */
"use strict";

class PxContent {
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

        if (div === null) throw new Error("getPixiv: Can't find getPixiv element");

        this.pixiv = JSON.parse(div.textContent);
    }

    getPage() {
        if (document.querySelector(".works_display")) {
            if (document.querySelector(".works_display ._ugoku-illust-player-container")) {
                this.page = "ugoira";
                return;
            }

            if (document.querySelector(".works_display ._work.multiple")) {
                this.page = "multiple";
                return;
            }

            this.page = "illust";
            return;
        }

        if (document.querySelector(".novel-content")) {
            this.page = "novel";
            return;
        }

        throw new Error("getPage: Can't identify page");
    }

    getMacro() {
        const macro = {};

        macro.id = this.pixiv.context.illustId;
        macro.title = this.pixiv.context.illustTitle || document.querySelector(".work-info").querySelector(".title").textContent;

        macro.userId = this.pixiv.context.userId;
        macro.userName = this.pixiv.context.userName || document.querySelector(".user").textContent;

        const dateString = document.querySelector(".meta").firstChild.textContent;
        const dateArray = dateString.replace(/ /g, "").split(/[年月日:]/).map(value => parseInt(value, 10));
        const date = new Date(dateArray[0], dateArray[1] - 1, dateArray[2], dateArray[3], dateArray[4]);

        macro.YYYY = date.getFullYear().toString();
        macro.YY = date.getFullYear().toString().slice(-2);
        macro.M = (date.getMonth() + 1).toString();
        macro.MM = `0${date.getMonth() + 1}`.slice(-2);
        macro.D = date.getDate().toString();
        macro.DD = `0${date.getDate()}`.slice(-2);
        macro.day = ["日", "月", "火", "水", "木", "金", "土"][date.getDay()];
        macro.h = date.getHours().toString();
        macro.hh = `0${date.getHours()}`.slice(-2);
        macro.m = date.getMinutes().toString();
        macro.mm = `0${date.getMinutes()}`.slice(-2);

        this.macro = macro;
    }

    getFilename(options) {
        let filename;

        const dir = PxContent.escape(this.replaceMacro(options.dir), true);
        const file = PxContent.escape(this.replaceMacro(options.file), true);

        if (options.hasOwnProperty("index")) {
            const page = PxContent.escape(this.replacePageMacro(options.page, options.index), true);

            filename = `PxDownloader/${dir}/${file}/${page}.${options.ext}`;
        } else {
            filename = `PxDownloader/${dir}/${file}.${options.ext}`;
        }

        return filename;
    }

    getExt(blob) {
        switch (blob.type) {
            case "image/gif": {
                return "gif";
            }

            case "image/jpeg": {
                return "jpg";
            }

            case "image/png": {
                return "png";
            }

            case "image/webp": {
                return "webp";
            }

            case "text/plain": {
                return "txt";
            }

            case "application/zip": {
                return "zip";
            }

            default: {
                return "";
            }
        }
    }

    replaceMacro(str) {
        Object.keys(this.macro).forEach(key => {
            str = str.split("${" + key + "}").join(this.macro[key]);
        });

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

        Object.keys(macro).forEach(key => {
            str = str.split("${" + key + "}").join(macro[key]);
        });

        return str;
    }

    downloadPixiv() {
        this.util.getOptions([
            "dir",
            "file",
            "page",
            "conflictAction",
            "convertMode",
            "convertQuality",
            "ugoiraMode",
            "ugoiraQuality"
        ]).then(options => {
            switch (this.page) {
                case "illust": {
                    this.downloadIllust(options);
                    break;
                }

                case "multiple": {
                    this.downloadMultiple(options);
                    break;
                }

                case "ugoira": {
                    this.downloadUgoira(options);
                    break;
                }

                case "novel": {
                    this.downloadNovel(options);
                    break;
                }
            }
        });
    }

    downloadIllust(options) {
        const imageUrl = new URL(document.querySelector("._illust_modal .wrapper .original-image").getAttribute("data-src"), location.href).href;

        this.util.fetch({ url: imageUrl, type: "blob", init: { credentials: "include", referrer: location.href } }).then(imageBlob => {
            if (options.convertMode === "none") {
                return Promise.resolve(imageBlob);
            } else {
                this.button.textContent = "Convert";

                return this.convert({
                    blob: imageBlob,
                    type: `image/${options.convertMode}`,
                    quality: options.convertQuality
                });
            }
        }).then(imageBlob => {
            this.button.textContent = "Download";

            return this.download({
                blob: imageBlob,
                filename: this.getFilename({ dir: options.dir, file: options.file, ext: this.getExt(imageBlob) }),
                conflictAction: options.conflictAction
            });
        }).then(() => {
            this.button.textContent = "Done";
        }).catch(err => {
            this.button.textContent = "Failed";

            alert(err.message);
            console.error(err);
        });

        this.button.textContent = "Fetch";
    }

    downloadMultiple(options) {
        const firstPageUrl = new URL(document.querySelector(".works_display ._work.multiple").getAttribute("href"), location.href);

        this.util.fetch({ url: firstPageUrl, type: "text", init: { credentials: "include", referrer: location.href } }).then(firstPageText => {
            const firstPageDomParser = new DOMParser();
            const firstPageDocument = firstPageDomParser.parseFromString(firstPageText, "text/html");

            const imageBlobs = [];

            let promise = Promise.resolve();

            Array.from(firstPageDocument.querySelectorAll(".item-container .full-size-container")).forEach((elem, index, elems) => {
                const secondPageUrl = new URL(elem.getAttribute("href"), firstPageUrl).href;

                promise = promise.then(() => {
                    return this.util.fetch({ url: secondPageUrl, type: "text", init: { credentials: "include", referrer: firstPageUrl } });
                }).then(secondPageText => {
                    const secondPageDomParser = new DOMParser();
                    const secondPageDocument = secondPageDomParser.parseFromString(secondPageText, "text/html");

                    const imageUrl = new URL(secondPageDocument.querySelector("img").getAttribute("src"), secondPageUrl).href;

                    return this.util.fetch({ url: imageUrl, type: "blob", init: { credentials: "include", referrer: secondPageUrl } }).then(imageBlob => {
                        this.button.textContent = `Fetch: ${Math.floor(((index + 1) / elems.length) * 100)}%`;

                        imageBlobs.push(imageBlob);
                    });
                });
            });

            promise = promise.then(() => {
                return imageBlobs;
            });

            return promise;
        }).then(imageBlobs => {
            if (options.convertMode === "none") {
                return Promise.resolve(imageBlobs);
            } else {
                this.button.textContent = "Convert";

                const convertedImageBlobs = [];

                let promise = Promise.resolve();

                let done = 0;

                imageBlobs.forEach(imageBlob => {
                    promise = promise.then(() => {
                        return this.convert({
                            blob: imageBlob,
                            type: `image/${options.convertMode}`,
                            quality: options.convertQuality
                        });
                    }).then(convertedImageBlob => {
                        this.button.textContent = `Convert: ${Math.floor((++done / imageBlobs.length) * 100)}%`;

                        convertedImageBlobs.push(convertedImageBlob);
                    });
                });

                promise = promise.then(() => {
                    return convertedImageBlobs;
                });

                return promise;
            }
        }).then(imageBlobs => {
            this.button.textContent = "Download";

            let promise = Promise.resolve();

            imageBlobs.forEach((imageBlob, index) => {
                promise = promise.then(() => {
                    return this.download({
                        blob: imageBlob,
                        filename: this.getFilename({ dir: options.dir, file: options.file, page: options.page, index: index, ext: this.getExt(imageBlob) }),
                        conflictAction: options.conflictAction
                    });
                });
            });

            return promise;
        }).then(() => {
            this.button.textContent = "Done";
        }).catch(err => {
            this.button.textContent = "Failed";

            alert(err.message);
            console.error(err);
        });

        this.button.textContent = "Fetch";
    }

    downloadUgoira(options) {
        switch (options.ugoiraMode) {
            case "zip": {
                this.downloadUgoiraZip(options);
                break;
            }

            case "gif": {
                this.downloadUgoiraGif(options);
                break;
            }

            case "apng": {
                this.downloadUgoiraAPng(options);
                break;
            }

            case "webp": {
                this.downloadUgoiraWebP(options);
                break;
            }
        }
    }

    downloadUgoiraZip(options) {
        const ugoiraData = this.pixiv.context.ugokuIllustFullscreenData;
        const zipUrl = new URL(ugoiraData.src, location.href).href;

        this.util.fetch({ url: zipUrl, type: "arraybuffer", init: { credentials: "include", referrer: location.href } }).then(arrayBuffer => {
            const zip = new JSZip(arrayBuffer);

            const zipBlob = zip.generate({ type: "blob" });

            return zipBlob;
        }).then(zipBlob => {
            this.button.textContent = "Download";

            return this.download({
                blob: zipBlob,
                filename: this.getFilename({ dir: options.dir, file: options.file, ext: this.getExt(zipBlob) }),
                conflictAction: options.conflictAction
            });
        }).then(() => {
            this.button.textContent = "Done";
        }).catch(err => {
            this.button.textContent = "Failed";

            alert(err.message);
            console.error(err);
        });

        this.button.textContent = "Fetch";
    }

    downloadUgoiraGif(options) {
        const ugoiraData = this.pixiv.context.ugokuIllustFullscreenData;
        const zipUrl = new URL(ugoiraData.src, location.href).href;

        let gif = null;

        this.resource({ path: "lib/gif.worker.js", type: "text/javascript" }).then(workerBlob => {
            gif = new GIF({
                quality: 1,
                workers: 4,
                workerScript: URL.createObjectURL(workerBlob)
            });

            return this.util.fetch({ url: zipUrl, type: "arraybuffer", init: { credentials: "include", referrer: location.href } });
        }).then(arrayBuffer => {
            this.button.textContent = "Load";

            const zip = new JSZip(arrayBuffer);

            const loadedImageElements = [];

            let promise = Promise.resolve();

            let done = 0;

            ugoiraData.frames.forEach(frame => {
                promise = promise.then(() => {
                    return new Promise((resolve, reject) => {
                        const sourceImageBlob = new Blob([zip.file(frame.file).asArrayBuffer()], { "type": ugoiraData.mime_type });
                        const sourceImageUrl = URL.createObjectURL(sourceImageBlob);

                        const img = document.createElement("img");

                        img.src = sourceImageUrl;

                        img.addEventListener("load", () => {
                            URL.revokeObjectURL(sourceImageUrl);

                            this.button.textContent = `Load: ${Math.floor((++done / ugoiraData.frames.length) * 100)}%`;

                            loadedImageElements.push(img);
                            resolve();
                        });

                        img.addEventListener("error", err => {
                            URL.revokeObjectURL(sourceImageUrl);

                            reject(err);
                        });
                    });
                });
            });

            promise = promise.then(() => {
                return loadedImageElements;
            });

            return promise;
        }).then(loadedImageElements => {
            this.button.textContent = "Process";

            loadedImageElements.forEach((loadedImageElement, index) => {
                gif.addFrame(loadedImageElement, { delay: ugoiraData.frames[index].delay });
            });

            return new Promise(resolve => {
                gif.on("progress", ratio => {
                    this.button.textContent = `Process: ${Math.floor(ratio * 100)}%`;
                });

                gif.on("finished", blob => {
                    resolve(blob);
                });

                gif.render();
            });
        }).then(imageBlob => {
            this.button.textContent = "Download";

            return this.download({
                blob: imageBlob,
                filename: this.getFilename({ dir: options.dir, file: options.file, ext: this.getExt(imageBlob) }),
                conflictAction: options.conflictAction
            });
        }).then(() => {
            this.button.textContent = "Done";
        }).catch(err => {
            this.button.textContent = "Failed";

            alert(err.message);
            console.error(err);
        });

        this.button.textContent = "Fetch";
    }

    downloadUgoiraAPng(options) {
        const ugoiraData = this.pixiv.context.ugokuIllustFullscreenData;
        const zipUrl = new URL(ugoiraData.src, location.href).href;

        const aPng = new APng();

        this.util.fetch({ url: zipUrl, type: "arraybuffer", init: { credentials: "include", referrer: location.href } }).then(arrayBuffer => {
            this.button.textContent = "Convert";

            const zip = new JSZip(arrayBuffer);

            const convertedImageBlobs = [];

            let promise = Promise.resolve();

            let done = 0;

            ugoiraData.frames.forEach(frame => {
                promise = promise.then(() => {
                    const sourceImageBlob = new Blob([zip.file(frame.file).asArrayBuffer()], { "type": ugoiraData.mime_type });

                    return this.convert({
                        blob: sourceImageBlob,
                        type: "image/png",
                        quality: options.ugoiraQuality
                    }).then(convertedImageBlob => {
                        this.button.textContent = `Convert: ${Math.floor((++done / ugoiraData.frames.length) * 100)}%`;

                        convertedImageBlobs.push(convertedImageBlob);
                    });
                });
            });

            promise = promise.then(() => {
                return convertedImageBlobs;
            });

            return promise;
        }).then(convertedImageBlobs => {
            this.button.textContent = "Process";

            convertedImageBlobs.forEach((convertedImageBlob, index) => {
                aPng.add(convertedImageBlob, { duration: ugoiraData.frames[index].delay });
            });

            return aPng.render();
        }).then(imageBlob => {
            this.button.textContent = "Download";

            return this.download({
                blob: imageBlob,
                filename: this.getFilename({ dir: options.dir, file: options.file, ext: this.getExt(imageBlob) }),
                conflictAction: options.conflictAction
            });
        }).then(() => {
            this.button.textContent = "Done";
        }).catch(err => {
            this.button.textContent = "Failed";

            alert(err.message);
            console.error(err);
        });

        this.button.textContent = "Fetch";
    }

    downloadUgoiraWebP(options) {
        const ugoiraData = this.pixiv.context.ugokuIllustFullscreenData;
        const zipUrl = new URL(ugoiraData.src, location.href).href;

        const webP = new WebP();

        this.util.fetch({ url: zipUrl, type: "arraybuffer", init: { credentials: "include", referrer: location.href } }).then(arrayBuffer => {
            this.button.textContent = "Convert";

            const zip = new JSZip(arrayBuffer);

            const convertedImageBlobs = [];

            let promise = Promise.resolve();

            let done = 0;

            ugoiraData.frames.forEach(frame => {
                promise = promise.then(() => {
                    const sourceImageBlob = new Blob([zip.file(frame.file).asArrayBuffer()], { "type": ugoiraData.mime_type });

                    return this.convert({
                        blob: sourceImageBlob,
                        type: "image/webp",
                        quality: options.ugoiraQuality
                    }).then(convertedImageBlob => {
                        this.button.textContent = `Convert: ${Math.floor((++done / ugoiraData.frames.length) * 100)}%`;

                        convertedImageBlobs.push(convertedImageBlob);
                    });
                });
            });

            promise = promise.then(() => {
                return convertedImageBlobs;
            });

            return promise;
        }).then(convertedImageBlobs => {
            this.button.textContent = "Process";

            convertedImageBlobs.forEach((convertedImageBlob, index) => {
                webP.add(convertedImageBlob, { duration: ugoiraData.frames[index].delay });
            });

            return webP.render();
        }).then(imageBlob => {
            this.button.textContent = "Download";

            return this.download({
                blob: imageBlob,
                filename: this.getFilename({ dir: options.dir, file: options.file, ext: this.getExt(imageBlob) }),
                conflictAction: options.conflictAction
            });
        }).then(() => {
            this.button.textContent = "Done";
        }).catch(err => {
            this.button.textContent = "Failed";

            alert(err.message);
            console.error(err);
        });

        this.button.textContent = "Fetch";
    }

    downloadNovel(options) {
        const pageUrl = location.href;

        this.util.fetch({ url: pageUrl, type: "text", init: { credentials: "include", referrer: location.href } }).then(pageText => {
            const domParser = new DOMParser();
            const pageDocument = domParser.parseFromString(pageText, "text/html");

            const textBlob = new Blob([pageDocument.querySelector("#novel_text").textContent.replace(/\r\n|\r|\n/g, "\r\n")], { type: "text/plain" });

            return textBlob;
        }).then(textBlob => {
            this.button.textContent = "Download";

            return this.download({
                blob: textBlob,
                filename: this.getFilename({ dir: options.dir, file: options.file, ext: this.getExt(textBlob) }),
                conflictAction: options.conflictAction
            });
        }).then(() => {
            this.button.textContent = "Done";
        }).catch(err => {
            this.button.textContent = "Failed";

            alert(err.message);
            console.error(err);
        });

        this.button.textContent = "Fetch";
    }

    addButton() {
        const parent = document.querySelector(".user-reaction");

        const div = document.createElement("div");
        const a = document.createElement("a");

        const listener = () => {
            a.removeEventListener("click", listener);
            a.style.setProperty("background-image", "none", "important");

            this.downloadPixiv();
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
