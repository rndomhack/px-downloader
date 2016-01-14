/* global chrome, JSZip, GIF, Apng, Whammy */
"use strict";

class PxContent {
    constructor() {
        this.getOptions();
        this.getPixiv();
        this.getPage();
    }

    init() {
        this.getMacro();
        this.addButton();
    }

    getOptions() {
        this.options = {
            dir: "${userName}(${userId})",
            file: "${title}(${id})",
            page: "${page2}",
            ugoiraMode: "gif",
            gifQuality: 1
        };
    }

    getPixiv() {
        var script = document.createElement("script");

        script.textContent = `
            (() => {
                var div = document.createElement("div");

                div.setAttribute("id", "getPixiv");
                div.style.display = "none"
                div.textContent = JSON.stringify({
                    context: typeof pixiv === "undefined" ? null : pixiv.context
                });

                document.body.appendChild(div);
            })();
        `;

        document.body.appendChild(script);

        var div = document.querySelector("#getPixiv");
        if (div === null) throw new Error("getPixiv is not found");

        this.pixiv = JSON.parse(div.textContent);
    }

    getPage() {
        if (document.querySelector(".works_display")) {
            if (document.querySelector("._ugoku-illust-player-container")) {
                this.page = "ugoira";
                return;
            }

            if (document.querySelector(".multiple")) {
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

        this.page = "";
        return;
    }

    getMacro() {
        var macro = {};

        macro.id = this.pixiv.context.illustId;
        macro.title = this.pixiv.context.illustTitle || document.querySelector(".work-info").querySelector(".title").textContent;

        macro.userId = this.pixiv.context.userId;
        macro.userName = this.pixiv.context.userName || document.querySelector(".user").textContent;

        var dateString = document.querySelector(".meta").firstChild.textContent;
        var dateArray = dateString.replace(/ /g, "").split(/[年月日:]/).map(value => parseInt(value, 10));
        var date = new Date(dateArray[0], dateArray[1] - 1, dateArray[2], dateArray[3], dateArray[4]);

        macro.YYYY = date.getFullYear().toString();
        macro.YY = date.getFullYear().toString().slice(-2);
        macro.M = (date.getMonth() + 1).toString();
        macro.MM = `0${date.getMonth() + 1}`.slice(-2);
        macro.D = date.getDate().toString();
        macro.DD = `0${date.getDate()}`.slice(-2);
        macro.h = date.getHours().toString();
        macro.hh = `0${date.getHours()}`.slice(-2);
        macro.m = date.getMinutes().toString();
        macro.mm = `0${date.getMinutes()}`.slice(-2);

        this.macro = macro;
    }

    replaceMacro(str) {
        Object.keys(this.macro).forEach(key => {
            str = str.split("${" + key + "}").join(this.macro[key]);
        });

        return str;
    }

    replacePageMacro(str, index) {
        var macro = {};

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

    check() {
        if (this.pixiv === null) return false;
        if (this.page === "") return false;

        return true;
    }

    download() {
        this.getOptions();

        switch (this.page) {
            case "illust":
                this.downloadIllust();
                break;

            case "multiple":
                this.downloadMultiple();
                break;

            case "ugoira":
                this.downloadUgoira();
                break;

            case "novel":
                this.downloadNovel();
                break;
        }
    }

    downloadUrl(url, type) {
        return new Promise((resolve, reject) => {
            var xhr = new XMLHttpRequest();

            xhr.addEventListener("load", () => {
                resolve(xhr.response);
            });

            xhr.addEventListener("error", err => {
                reject(err);
            });

            xhr.open("GET", url);
            xhr.responseType = type;
            xhr.send();
        });
    }

    downloadIllust() {
        var url = document.querySelector(".original-image").getAttribute("data-src");

        this.downloadUrl(url, "blob").then(blob => {
            var ext = blob.type === "image/png" ? ".png" :
                      blob.type === "image/jpeg" ? ".jpg" :
                      blob.type === "image/gif" ? ".gif" : "";

            return this.message("download", {
                url: URL.createObjectURL(blob),
                dir: PxContent.escape(this.replaceMacro(this.options.dir), true),
                file: `${PxContent.escape(this.replaceMacro(this.options.file), true)}${ext}`
            });
        }).then(() => {
            console.log("Download successful");
        }).catch(err => {
            console.error(`Download failed: ${err.message}`);
        });
    }

    downloadMultiple() {
        var pageUrl = document.querySelector(".works_display").querySelector(".multiple").getAttribute("href");

        this.downloadUrl(pageUrl, "document").then(doc => {
            return Promise.all(Array.from(doc.querySelectorAll(".full-size-container")).map(elem => {
                return this.downloadUrl(elem.getAttribute("href"), "document");
            }));
        }).then(docs => {
            return Promise.all(docs.map(doc => {
                return this.downloadUrl(doc.querySelector("img").getAttribute("src"), "blob");
            }));
        }).then(blobs => {
            return Promise.all(blobs.map((blob, index) => {
                var ext = blob.type === "image/png" ? ".png" :
                          blob.type === "image/jpeg" ? ".jpg" :
                          blob.type === "image/gif" ? ".gif" : "";

                return this.message("download", {
                    url: URL.createObjectURL(blob),
                    dir: PxContent.escape(this.replaceMacro(this.options.dir), true),
                    file: `${PxContent.escape(this.replaceMacro(this.options.file), true)}/${this.replacePageMacro(this.options.page, index)}${ext}`
                });
            }));
        }).then(() => {
            console.log("Download successful");
        }).catch(err => {
            console.error(`Download failed: ${err.message}`);
        });
    }

    downloadUgoira() {
        switch (this.options.ugoiraMode) {
            case "zip":
                this.downloadUgoiraZip();
                break;

            case "gif":
                this.downloadUgoiraGif();
                break;

            case "apng":
                this.downloadUgoiraApng();
                break;

            case "webm":
                this.downloadUgoiraWebM();
                break;
        }
    }

    downloadUgoiraZip() {
        var ugoiraData = this.pixiv.context.ugokuIllustFullscreenData;

        this.downloadUrl(ugoiraData.src, "arraybuffer").then(ab => {
            var zip = new JSZip(ab);
            zip.file("animation.json", JSON.stringify(this.pixiv.context));
            var blob = zip.generate({ type:"blob" });

            return this.message("download", {
                url: URL.createObjectURL(blob),
                dir: PxContent.escape(this.replaceMacro(this.options.dir), true),
                file: `${PxContent.escape(this.replaceMacro(this.options.file), true)}.zip`
            });
        }).then(() => {
            console.log("Download successful");
        }).catch(err => {
            console.error(`Download failed: ${err.message}`);
        });
    }

    downloadUgoiraGif() {
        var ugoiraData = this.pixiv.context.ugokuIllustFullscreenData;
        var gif = null;

        this.message("get", { url: chrome.runtime.getURL("lib/gif.worker.js"), type: "text" }).then(worker => {
            gif = new GIF({
                quality: this.options.gifQuality,
                workers: 4,
                workerScript: URL.createObjectURL(new Blob([worker]))
            });

            return this.downloadUrl(ugoiraData.src, "arraybuffer");
        }).then(ab => {
            var zip = new JSZip(ab);

            return Promise.all(ugoiraData.frames.map(frame => {
                return new Promise((resolve, reject) => {
                    var buffer = zip.file(frame.file).asArrayBuffer();
                    var blob = new Blob([buffer], { "type": ugoiraData.mime_type });

                    var img = document.createElement("img");

                    img.src = window.URL.createObjectURL(blob);

                    img.addEventListener("load", () => {
                        resolve(img);
                    });

                    img.addEventListener("error", err => {
                        reject(err);
                    });
                });
            }));

        }).then(imgs => {
            imgs.forEach((img, index) => {
                gif.addFrame(img, { delay: ugoiraData.frames[index].delay });
            });

            return new Promise(resolve => {
                gif.on("progress", ratio => {
                    this.button.textContent = `progress: ${Math.floor(ratio * 100)}%`;
                });

                gif.on("finished", blob => {
                    this.button.textContent = "Px Download";

                    resolve(blob);
                });

                gif.render();
            });
        }).then(blob => {
            return this.message("download", {
                url: URL.createObjectURL(blob),
                dir: PxContent.escape(this.replaceMacro(this.options.dir), true),
                file: `${PxContent.escape(this.replaceMacro(this.options.file), true)}.gif`
            });
        }).then(() => {
            console.log("Download successful");
        }).catch(err => {
            console.error(`Download failed: ${err.message}`);
        });
    }

    downloadUgoiraApng() {
        var ugoiraData = this.pixiv.context.ugokuIllustFullscreenData;
        var apng = new Apng();

        this.downloadUrl(ugoiraData.src, "arraybuffer").then(ab => {
            var zip = new JSZip(ab);
            var done = 0;

            return Promise.all(ugoiraData.frames.map(frame => {
                var buffer = zip.file(frame.file).asArrayBuffer();
                var blob = new Blob([buffer], { "type": ugoiraData.mime_type });

                return this.message("convert", {
                    url: URL.createObjectURL(blob),
                    type: "image/png",
                    quality: 1
                }).then(url => {
                    this.button.textContent = `convert: ${Math.floor((++done / ugoiraData.frames.length) * 100)}%`;

                    return this.downloadUrl(url, "blob");
                });
            }));

        }).then(imgs => {
            this.button.textContent = "Px Download";

            imgs.forEach((img, index) => {
                apng.add(img, { delay: [ugoiraData.frames[index].delay, 1000] });
            });

            return apng.render();
        }).then(blob => {
            return this.message("download", {
                url: URL.createObjectURL(blob),
                dir: PxContent.escape(this.replaceMacro(this.options.dir), true),
                file: `${PxContent.escape(this.replaceMacro(this.options.file), true)}.png`
            });
        }).then(() => {
            console.log("Download successful");
        }).catch(err => {
            console.error(`Download failed: ${err.message}`);
        });
    }

    downloadUgoiraWebM() {
        var ugoiraData = this.pixiv.context.ugokuIllustFullscreenData;
        var webm = new Whammy.Video();

        this.downloadUrl(ugoiraData.src, "arraybuffer").then(ab => {
            var zip = new JSZip(ab);
            var done = 0;

            return Promise.all(ugoiraData.frames.map(frame => {
                var buffer = zip.file(frame.file).asArrayBuffer();
                var blob = new Blob([buffer], { "type": ugoiraData.mime_type });

                return this.message("convert", {
                    url: URL.createObjectURL(blob),
                    type: "image/webp",
                    quality: 1
                }).then(url => {
                    this.button.textContent = `convert: ${Math.floor((++done / ugoiraData.frames.length) * 100)}%`;

                    return this.downloadUrl(url, "blob");
                }).then(dlBlob => {
                    return new Promise((resolve, reject) => {
                        var reader = new FileReader();

                        reader.addEventListener("load", () => {
                            resolve(reader.result);
                        });

                        reader.addEventListener("error", err => {
                            reject(err);
                        });

                        reader.readAsDataURL(dlBlob);
                    });
                });
            }));

        }).then(imgs => {
            this.button.textContent = "Px Download";

            imgs.forEach((img, index) => {
                webm.add(img, ugoiraData.frames[index].delay);
            });

            return new Promise((resolve, reject) => {
                webm.compile(false, output => {
                    if (!output) {
                        reject(new Error("Output is null"));
                        return;
                    }

                    resolve(output);
                });
            });
        }).then(blob => {
            return this.message("download", {
                url: URL.createObjectURL(blob),
                dir: PxContent.escape(this.replaceMacro(this.options.dir), true),
                file: `${PxContent.escape(this.replaceMacro(this.options.file), true)}.webm`
            });
        }).then(() => {
            console.log("Download successful");
        }).catch(err => {
            console.error(`Download failed: ${err.message}`);
        });
    }

    downloadNovel() {
        var pageUrl = location.href;

        this.downloadUrl(pageUrl, "document").then(doc => {
            return new Blob([doc.querySelector("#novel_text").textContent.replace(/\r\n|\r|\n/g, "\r\n")], { type: "text/plain" });
        }).then(blob => {
            return this.message("download", {
                url: URL.createObjectURL(blob),
                dir: PxContent.escape(this.replaceMacro(this.options.dir), true),
                file: `${PxContent.escape(this.replaceMacro(this.options.file), true)}.txt`
            });
        }).then(() => {
            console.log("Download successful");
        }).catch(err => {
            console.error(`Download failed: ${err.message}`);
        });
    }

    addButton() {
        var parent = document.querySelector(".user-reaction");

        var div = document.createElement("div");
        var a = document.createElement("a");

        var listener = () => {
            this.download();
            a.removeEventListener("click", listener);
        };

        div.classList.add("download-container");
        a.classList.add("_button");
        a.textContent = "Px Download";
        a.addEventListener("click", listener);

        div.appendChild(a);
        parent.insertBefore(div, null);

        this.button = a;
    }

    message(type, data) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                type: type,
                data: data
            }, response => {
                if (response.err) {
                    reject(new Error(response.err));
                }

                resolve(response.data);
            });
        });
    }

    static escape(str, flag) {
        return str.replace(flag ? /([/\?\*:\|"<>\\])/g : /([/\?\*:\|"<>])/g, PxContent.toFull);
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
