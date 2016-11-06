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

        let secondPageUrl;

        this.util.fetch({ url: firstPageUrl, type: "text", init: { credentials: "include", referrer: location.href } }).then(firstPageText => {
            const domParser = new DOMParser();
            const firstPageDocument = domParser.parseFromString(firstPageText, "text/html");

            return Promise.all(Array.from(firstPageDocument.querySelectorAll(".item-container .full-size-container")).map(elem => {
                secondPageUrl = new URL(elem.getAttribute("href"), firstPageUrl).href;

                return this.util.fetch({ url: secondPageUrl, type: "text", init: { credentials: "include", referrer: firstPageUrl } });
            }));
        }).then(secondPageTexts => {
            let done = 0;

            return Promise.all(secondPageTexts.map(secondPageText => {
                const domParser = new DOMParser();
                const secondPageDocument = domParser.parseFromString(secondPageText, "text/html");

                const imageUrl = new URL(secondPageDocument.querySelector("img").getAttribute("src"), secondPageUrl).href;

                return this.util.fetch({ url: imageUrl, type: "blob", init: { credentials: "include", referrer: secondPageUrl } }).then(imageBlob => {
                    this.button.textContent = `Fetch: ${Math.floor((++done / secondPageTexts.length) * 100)}%`;

                    return imageBlob;
                });
            }));
        }).then(imageBlobs => {
            this.button.textContent = "Download";

            return Promise.all(imageBlobs.map((imageBlob, index) => {
                return this.download({
                    blob: imageBlob,
                    filename: this.getFilename({ dir: options.dir, file: options.file, page: options.page, index: index, ext: this.getExt(imageBlob) }),
                    conflictAction: options.conflictAction
                });
            }));
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

            let done = 0;

            return Promise.all(ugoiraData.frames.map(frame => {
                return new Promise((resolve, reject) => {
                    const sourceImageBlob = new Blob([zip.file(frame.file).asArrayBuffer()], { "type": ugoiraData.mime_type });
                    const sourceImageUrl = URL.createObjectURL(sourceImageBlob);

                    const img = document.createElement("img");

                    img.src = sourceImageUrl;

                    img.addEventListener("load", () => {
                        URL.revokeObjectURL(sourceImageUrl);

                        this.button.textContent = `Load: ${Math.floor((++done / ugoiraData.frames.length) * 100)}%`;

                        resolve(img);
                    });

                    img.addEventListener("error", err => {
                        URL.revokeObjectURL(sourceImageUrl);

                        reject(err);
                    });
                });
            }));
        }).then(imgElems => {
            this.button.textContent = "Process";

            imgElems.forEach((imgElem, index) => {
                gif.addFrame(imgElem, { delay: ugoiraData.frames[index].delay });
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

    resource(options) {
        return this.util.message({
            type: "resource",
            data: {
                path: options.path,
                type: options.type
            }
        }).then(url => {
            return this.util.fetch({ url: url, type: "blob" });
        });
    }

    download(options) {
        return this.util.read({ blob: options.blob, type: "dataurl" }).then(url => {
            return this.util.message({
                type: "download",
                data: {
                    url: url,
                    filename: options.filename,
                    conflictAction: options.conflictAction
                }
            });
        });
    }

    convert(options) {
        return this.util.read({ blob: options.blob, type: "dataurl" }).then(url => {
            return this.util.message({
                type: "convert",
                data: {
                    url: url,
                    type: options.type,
                    quality: options.quality
                }
            });
        }).then(url => {
            return this.util.fetch({ url: url, type: "blob" });
        });
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
