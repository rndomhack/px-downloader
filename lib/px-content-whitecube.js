/* global ExtensionUtil, JSZip, GIF, APng, WebP */
"use strict";

class PxContentWhitecube {
    init() {
        if (!this.hasOwnProperty("url")) {
            this.url = location.href;
        }

        if (this.url !== location.href) {
            console.log("reject");
            return;
        }

        if (document.querySelector(".content-container") === null) {
            setTimeout(() => {
                this.init();
            }, 100);

            return;
        }

        this.util = new ExtensionUtil();

        this.getPage();
        this.getMacro();
        this.addButton();
    }

    check() {
        if (/^\/whitecube\/user\/\d+\/(illust|novel)\/\d+$/.test(location.pathname)) return true;

        return false;
    }

    getPage() {
        const contentContainer = document.querySelector(".content-container");

        if (contentContainer === null) {
            throw new Error("getPage: Can't identify page");
        }

        if (contentContainer.classList.contains("illust")) {
            if (contentContainer.querySelectorAll(".main.wrapper.has-ugoira.ugoira").length !== 0) {
                this.page = "ugoira";
                return;
            }

            if (contentContainer.querySelectorAll(".main.wrapper:not(.no-count)").length > 1) {
                this.page = "multiple";
                return;
            }

            this.page = "illust";
            return;
        }

        if (contentContainer.classList.contains("novel")) {
            this.page = "novel";
            return;
        }
    }

    getMacro() {
        const macro = {};

        const match = location.pathname.match(/^\/whitecube\/user\/(\d+)\/.*?\/(\d+)$/);

        macro.id = match[2];
        macro.title = document.querySelector(".title-container ._title").textContent;

        macro.userId = match[1];
        macro.userName = document.querySelector(".header-container .header-author-container .user-view-popup .user-name").textContent;

        const dateString = document.querySelector(".header-container .header-author-container .meta .datetime").textContent;
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

        const dir = PxContentWhitecube.escape(this.replaceMacro(options.dir), true);
        const file = PxContentWhitecube.escape(this.replaceMacro(options.file), true);

        if (options.hasOwnProperty("index")) {
            const page = PxContentWhitecube.escape(this.replacePageMacro(options.page, options.index), true);

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
        const imageUrl = new URL(document.querySelector(".content-container .main.wrapper .illust-zoom-in.thumbnail-container").getAttribute("data-original-src"), location.href).href;

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
        const imageUrls = Array.from(document.querySelectorAll(".content-container .main.wrapper .illust-zoom-in.thumbnail-container")).map(elem => new URL(elem.getAttribute("data-original-src"), location.href).href);

        Promise.all(imageUrls.map(imageUrl => {
            let done = 0;

            return this.util.fetch({ url: imageUrl, type: "blob", init: { credentials: "include", referrer: location.href } }).then(imageBlob => {
                this.button.textContent = `Fetch: ${Math.floor((++done / imageUrls.length) * 100)}%`;

                return imageBlob;
            });
        })).then(imageBlobs => {
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
        const ugoiraData = JSON.parse(document.querySelector(".content-container .main.wrapper .ugoira.player-container").getAttribute("data-ugoira-meta"));
        const zipUrl = new URL(ugoiraData.src.replace("600x600", "1920x1080"), location.href).href;

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
        const ugoiraData = JSON.parse(document.querySelector(".content-container .main.wrapper .ugoira.player-container").getAttribute("data-ugoira-meta"));
        const zipUrl = new URL(ugoiraData.src.replace("600x600", "1920x1080"), location.href).href;
        const zipFrames = Array.from(Object.assign({ length: Object.keys(ugoiraData.frames).length }, ugoiraData.frames));

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

            return Promise.all(zipFrames.map(frame => {
                return new Promise((resolve, reject) => {
                    const sourceImageBlob = new Blob([zip.file(frame.file).asArrayBuffer()], { "type": ugoiraData.mime_type });
                    const sourceImageUrl = URL.createObjectURL(sourceImageBlob);

                    const img = document.createElement("img");

                    img.src = sourceImageUrl;

                    img.addEventListener("load", () => {
                        URL.revokeObjectURL(sourceImageUrl);

                        this.button.textContent = `Load: ${Math.floor((++done / zipFrames.length) * 100)}%`;

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
                gif.addFrame(imgElem, { delay: zipFrames[index].delay });
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
        const ugoiraData = JSON.parse(document.querySelector(".content-container .main.wrapper .ugoira.player-container").getAttribute("data-ugoira-meta"));
        const zipUrl = new URL(ugoiraData.src.replace("600x600", "1920x1080"), location.href).href;
        const zipFrames = Array.from(Object.assign({ length: Object.keys(ugoiraData.frames).length }, ugoiraData.frames));

        const aPng = new APng();

        this.util.fetch({ url: zipUrl, type: "arraybuffer", init: { credentials: "include", referrer: location.href } }).then(arrayBuffer => {
            this.button.textContent = "Convert";

            const zip = new JSZip(arrayBuffer);

            const convertedImageBlobs = [];

            let promise = Promise.resolve();

            let done = 0;

            zipFrames.forEach(frame => {
                promise = promise.then(() => {
                    const sourceImageBlob = new Blob([zip.file(frame.file).asArrayBuffer()], { "type": ugoiraData.mime_type });

                    return this.convert({
                        blob: sourceImageBlob,
                        type: "image/png",
                        quality: options.ugoiraQuality
                    }).then(convertedImageBlob => {
                        this.button.textContent = `Convert: ${Math.floor((++done / zipFrames.length) * 100)}%`;

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
                aPng.add(convertedImageBlob, { duration: zipFrames[index].delay });
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
        const ugoiraData = JSON.parse(document.querySelector(".content-container .main.wrapper .ugoira.player-container").getAttribute("data-ugoira-meta"));
        const zipUrl = new URL(ugoiraData.src.replace("600x600", "1920x1080"), location.href).href;
        const zipFrames = Array.from(Object.assign({ length: Object.keys(ugoiraData.frames).length }, ugoiraData.frames));

        const webP = new WebP();

        this.util.fetch({ url: zipUrl, type: "arraybuffer", init: { credentials: "include", referrer: location.href } }).then(arrayBuffer => {
            this.button.textContent = "Convert";

            const zip = new JSZip(arrayBuffer);

            const convertedImageBlobs = [];

            let promise = Promise.resolve();

            let done = 0;

            zipFrames.forEach(frame => {
                promise = promise.then(() => {
                    const sourceImageBlob = new Blob([zip.file(frame.file).asArrayBuffer()], { "type": ugoiraData.mime_type });

                    return this.convert({
                        blob: sourceImageBlob,
                        type: "image/webp",
                        quality: options.ugoiraQuality
                    }).then(convertedImageBlob => {
                        this.button.textContent = `Convert: ${Math.floor((++done / zipFrames.length) * 100)}%`;

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
                webP.add(convertedImageBlob, { duration: zipFrames[index].delay });
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
        const text = Array.from(document.querySelectorAll(".content-container .content-wrapper .novel-content .novel-body .novel-pages-wrapper .novel-pages .novel-page")).map(elem => {
            return Array.from(elem.children).map(elem2 => elem2.textContent).join("\r\n").trim();
        }).join("\r\n\r\n");

        const textBlob = new Blob([text], { type: "text/plain" });

        this.download({
            blob: textBlob,
            filename: this.getFilename({ dir: options.dir, file: options.file, ext: this.getExt(textBlob) }),
            conflictAction: options.conflictAction
        }).then(() => {
            this.button.textContent = "Done";
        }).catch(err => {
            this.button.textContent = "Failed";

            alert(err.message);
            console.error(err);
        });

        this.button.textContent = "Download";
    }

    addButton() {
        const parent = document.querySelector(".title-container");

        const button = document.createElement("div");

        const listener = () => {
            button.removeEventListener("click", listener);
            button.style.backgroundColor = "gray";

            this.downloadPixiv();
        };

        button.classList.add("_action-button");
        button.style.float = "right";
        button.style.width = "120px";
        button.style.textAlign = "center";
        button.textContent = "Px Downloader";

        button.addEventListener("click", listener);

        parent.appendChild(button, null);

        this.button = button;
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
        return str.replace(flag ? /([/\?\*:\|"<>~\\])/g : /([/\?\*:\|"<>~])/g, PxContentWhitecube.toFull);
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
