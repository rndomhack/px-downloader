/* global chrome, JSZip, GIF, APng, WebP, storage */
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

        this.getPixiv();
        this.getPage();
        this.getMacro();
        this.addButton();
    }

    check() {
        if (/^\/whitecube\/user\/\d+\/(illust|novel)\/\d+$/.test(location.pathname)) return true;

        return false;
    }

    getOptions() {
        return new Promise(resolve => {
            storage.get([
                "dir",
                "file",
                "page",
                "conflictAction",
                "ugoiraMode",
                "ugoiraQuality"
            ], items => {
                this.options = items;
                resolve();
            });
        });
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

        if (div === null) throw new Error("getPixiv: getPixiv is null");

        this.pixiv = JSON.parse(div.textContent);
    }

    getPage() {
        const contentContainer = document.querySelector(".content-container");

        if (contentContainer === null) {
            throw new Error("getPage: contentContainer is null");
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

        macro.id = this.pixiv.context.illustId || match[2];
        macro.title = this.pixiv.context.illustTitle || document.querySelector(".title-container ._title").textContent;

        macro.userId = this.pixiv.context.userId || match[1];
        macro.userName = this.pixiv.context.userName || document.querySelector(".header-container .header-author-container .user-view-popup .user-name").textContent;

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

    download() {
        this.getOptions().then(() => {
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
        });
    }

    downloadUrl(url, type) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();

            xhr.addEventListener("load", () => {
                resolve(xhr.response);
            });

            xhr.addEventListener("error", err => {
                reject(err);
            });

            xhr.open("GET", url);
            xhr.responseType = type;
            xhr.withCredentials = true;
            xhr.send();
        });
    }

    downloadIllust() {
        const url = document.querySelector(".content-container .main.wrapper .illust-zoom-in.thumbnail-container").getAttribute("data-original-src");

        this.downloadUrl(url, "blob").then(blob => {
            const ext = blob.type === "image/png" ? ".png" :
                        blob.type === "image/jpeg" ? ".jpg" :
                        blob.type === "image/gif" ? ".gif" : "";

            const downloadUrl = URL.createObjectURL(blob);

            return this.message("download", {
                url: downloadUrl,
                dir: PxContentWhitecube.escape(this.replaceMacro(this.options.dir), true),
                file: `${PxContentWhitecube.escape(this.replaceMacro(this.options.file), true)}${ext}`,
                conflictAction: this.options.conflictAction
            }).then(() => {
                URL.revokeObjectURL(downloadUrl);
            });
        }).then(() => {
            console.log("Download successful");
        }).catch(err => {
            console.error(`Download failed: ${err.message}`);
            alert(`Download failed: ${err.message}`);
        });
    }

    downloadMultiple() {
        const urls = Array.from(document.querySelectorAll(".content-container .main.wrapper .illust-zoom-in.thumbnail-container")).map(elem => elem.getAttribute("data-original-src"));

        Promise.all(urls.map((url, index) => {
            return this.downloadUrl(url, "blob").then(blob => {
                const ext = blob.type === "image/png" ? ".png" :
                            blob.type === "image/jpeg" ? ".jpg" :
                            blob.type === "image/gif" ? ".gif" : "";

                const downloadUrl = URL.createObjectURL(blob);

                return this.message("download", {
                    url: downloadUrl,
                    dir: PxContentWhitecube.escape(this.replaceMacro(this.options.dir), true),
                    file: `${PxContentWhitecube.escape(this.replaceMacro(this.options.file), true)}/${this.replacePageMacro(this.options.page, index)}${ext}`,
                    conflictAction: this.options.conflictAction
                }).then(() => {
                    URL.revokeObjectURL(downloadUrl);
                });
            });
        })).then(() => {
            console.log("Download successful");
        }).catch(err => {
            console.error(`Download failed: ${err.message}`);
            alert(`Download failed: ${err.message}`);
        });
    }

    downloadUgoira() {
        switch (this.options.ugoiraMode) {
            case "zip": {
                this.downloadUgoiraZip();

                break;
            }

            case "gif": {
                this.downloadUgoiraGif();

                break;
            }

            case "apng": {
                this.downloadUgoiraAPng();

                break;
            }

            case "webp": {
                this.downloadUgoiraWebP();

                break;
            }
        }
    }

    downloadUgoiraZip() {
        const ugoiraData = JSON.parse(document.querySelector(".content-container .main.wrapper .ugoira.player-container").getAttribute("data-ugoira-meta"));

        ugoiraData.src = ugoiraData.src.replace("600x600", "1920x1080");

        ugoiraData.frames.length = Object.keys(ugoiraData.frames).length;
        ugoiraData.frames = Array.from(ugoiraData.frames);

        this.downloadUrl(ugoiraData.src, "arraybuffer").then(ab => {
            const zip = new JSZip(ab);

            zip.file("animation.json", JSON.stringify({ ugokuIllustFullscreenData: ugoiraData, ugokuIllustData: ugoiraData }));

            const blob = zip.generate({ type:"blob" });
            const downloadUrl = URL.createObjectURL(blob);

            return this.message("download", {
                url: downloadUrl,
                dir: PxContentWhitecube.escape(this.replaceMacro(this.options.dir), true),
                file: `${PxContentWhitecube.escape(this.replaceMacro(this.options.file), true)}.zip`,
                conflictAction: this.options.conflictAction
            }).then(() => {
                URL.revokeObjectURL(downloadUrl);
            });
        }).then(() => {
            console.log("Download successful");
        }).catch(err => {
            console.error(`Download failed: ${err.message}`);
            alert(`Download failed: ${err.message}`);
        });
    }

    downloadUgoiraGif() {
        const ugoiraData = JSON.parse(document.querySelector(".content-container .main.wrapper .ugoira.player-container").getAttribute("data-ugoira-meta"));
        let gif = null;

        ugoiraData.src = ugoiraData.src.replace("600x600", "1920x1080");

        ugoiraData.frames.length = Object.keys(ugoiraData.frames).length;
        ugoiraData.frames = Array.from(ugoiraData.frames);

        this.message("get", { url: chrome.runtime.getURL("lib/gif.worker.js"), type: "text" }).then(worker => {
            gif = new GIF({
                quality: 1,
                workers: 4,
                workerScript: URL.createObjectURL(new Blob([worker]))
            });

            return this.downloadUrl(ugoiraData.src, "arraybuffer");
        }).then(ab => {
            const zip = new JSZip(ab);

            return Promise.all(ugoiraData.frames.map(frame => {
                return new Promise((resolve, reject) => {
                    const buffer = zip.file(frame.file).asArrayBuffer();
                    const blob = new Blob([buffer], { "type": ugoiraData.mime_type });

                    const img = document.createElement("img");
                    const imgUrl = URL.createObjectURL(blob);

                    img.src = imgUrl;

                    img.addEventListener("load", () => {
                        URL.revokeObjectURL(imgUrl);
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
            const downloadUrl = URL.createObjectURL(blob);

            return this.message("download", {
                url: downloadUrl,
                dir: PxContentWhitecube.escape(this.replaceMacro(this.options.dir), true),
                file: `${PxContentWhitecube.escape(this.replaceMacro(this.options.file), true)}.gif`,
                conflictAction: this.options.conflictAction
            }).then(() => {
                URL.revokeObjectURL(downloadUrl);
            });
        }).then(() => {
            console.log("Download successful");
        }).catch(err => {
            console.error(`Download failed: ${err.message}`);
            alert(`Download failed: ${err.message}`);
        });
    }

    downloadUgoiraAPng() {
        const ugoiraData = JSON.parse(document.querySelector(".content-container .main.wrapper .ugoira.player-container").getAttribute("data-ugoira-meta"));
        const aPng = new APng();

        ugoiraData.src = ugoiraData.src.replace("600x600", "1920x1080");

        ugoiraData.frames.length = Object.keys(ugoiraData.frames).length;
        ugoiraData.frames = Array.from(ugoiraData.frames);

        this.downloadUrl(ugoiraData.src, "arraybuffer").then(ab => {
            const zip = new JSZip(ab);
            let done = 0;

            return Promise.all(ugoiraData.frames.map(frame => {
                const buffer = zip.file(frame.file).asArrayBuffer();
                const blob = new Blob([buffer], { "type": ugoiraData.mime_type });
                const convertUrl = URL.createObjectURL(blob);

                return this.message("convert", {
                    url: convertUrl,
                    type: "image/png",
                    quality: this.options.ugoiraQuality
                }).then(downloadUrl => {
                    this.button.textContent = `convert: ${Math.floor((++done / ugoiraData.frames.length) * 100)}%`;

                    URL.revokeObjectURL(convertUrl);

                    return this.downloadUrl(downloadUrl, "blob").then(img => {
                        URL.revokeObjectURL(downloadUrl);

                        return img;
                    });
                });
            }));

        }).then(imgs => {
            this.button.textContent = "Px Download";

            imgs.forEach((img, index) => {
                aPng.add(img, { duration: ugoiraData.frames[index].delay });
            });

            return aPng.render();
        }).then(blob => {
            const downloadUrl = URL.createObjectURL(blob);

            return this.message("download", {
                url: downloadUrl,
                dir: PxContentWhitecube.escape(this.replaceMacro(this.options.dir), true),
                file: `${PxContentWhitecube.escape(this.replaceMacro(this.options.file), true)}.png`,
                conflictAction: this.options.conflictAction
            }).then(() => {
                URL.revokeObjectURL(downloadUrl);
            });
        }).then(() => {
            console.log("Download successful");
        }).catch(err => {
            console.error(`Download failed: ${err.message}`);
            alert(`Download failed: ${err.message}`);
        });
    }

    downloadUgoiraWebP() {
        const ugoiraData = JSON.parse(document.querySelector(".content-container .main.wrapper .ugoira.player-container").getAttribute("data-ugoira-meta"));
        const webP = new WebP();

        ugoiraData.src = ugoiraData.src.replace("600x600", "1920x1080");

        ugoiraData.frames.length = Object.keys(ugoiraData.frames).length;
        ugoiraData.frames = Array.from(ugoiraData.frames);

        this.downloadUrl(ugoiraData.src, "arraybuffer").then(ab => {
            const zip = new JSZip(ab);
            let done = 0;

            return Promise.all(ugoiraData.frames.map(frame => {
                const buffer = zip.file(frame.file).asArrayBuffer();
                const blob = new Blob([buffer], { "type": ugoiraData.mime_type });
                const convertUrl = URL.createObjectURL(blob);

                return this.message("convert", {
                    url: convertUrl,
                    type: "image/webp",
                    quality: this.options.ugoiraQuality
                }).then(downloadUrl => {
                    this.button.textContent = `convert: ${Math.floor((++done / ugoiraData.frames.length) * 100)}%`;

                    URL.revokeObjectURL(convertUrl);

                    return this.downloadUrl(downloadUrl, "blob").then(img => {
                        URL.revokeObjectURL(downloadUrl);

                        return img;
                    });
                });
            }));

        }).then(imgs => {
            this.button.textContent = "Px Download";

            imgs.forEach((img, index) => {
                webP.add(img, { duration: ugoiraData.frames[index].delay });
            });

            return webP.render();
        }).then(blob => {
            const downloadUrl = URL.createObjectURL(blob);

            return this.message("download", {
                url: downloadUrl,
                dir: PxContentWhitecube.escape(this.replaceMacro(this.options.dir), true),
                file: `${PxContentWhitecube.escape(this.replaceMacro(this.options.file), true)}.webp`,
                conflictAction: this.options.conflictAction
            }).then(() => {
                URL.revokeObjectURL(downloadUrl);
            });
        }).then(() => {
            console.log("Download successful");
        }).catch(err => {
            console.error(`Download failed: ${err.message}`);
            alert(`Download failed: ${err.message}`);
        });
    }

    downloadNovel() {
        const text = Array.from(document.querySelectorAll(".content-container .content-wrapper .novel-content .novel-body .novel-pages-wrapper .novel-pages .novel-page")).map(elem => {
            return Array.from(elem.children).map(elem2 => elem2.textContent).join("\r\n").trim();
        }).join("\r\n\r\n");

        Promise.resolve(new Blob([text], { type: "text/plain" })).then(blob => {
            const downloadUrl = URL.createObjectURL(blob);

            return this.message("download", {
                url: downloadUrl,
                dir: PxContentWhitecube.escape(this.replaceMacro(this.options.dir), true),
                file: `${PxContentWhitecube.escape(this.replaceMacro(this.options.file), true)}.txt`,
                conflictAction: this.options.conflictAction
            }).then(() => {
                URL.revokeObjectURL(downloadUrl);
            });
        }).then(() => {
            console.log("Download successful");
        }).catch(err => {
            console.error(`Download failed: ${err.message}`);
            alert(`Download failed: ${err.message}`);
        });
    }

    addButton() {
        const parent = document.querySelector(".title-container");

        const button = document.createElement("div");

        const listener = () => {
            button.removeEventListener("click", listener);
            button.style.backgroundColor = "gray";

            this.download();
        };

        button.classList.add("_action-button");
        button.style.float = "right";
        button.style.width = "120px";
        button.style.textAlign = "center";
        button.textContent = "Px Download";

        button.addEventListener("click", listener);

        parent.appendChild(button, null);

        this.button = button;
    }

    message(type, data) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                type: type,
                data: data
            }, response => {
                if (response.error) {
                    reject(new Error(response.error));
                }

                resolve(response.data);
            });
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
