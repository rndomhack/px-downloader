import browser from "webextension-polyfill";

import messenger from "./messenger";

export default class PxContent {
    constructor(url) {
        this._url = url;
        this._page = PxContent.getPage(url);
        this._id = PxContent.getId(url);
        this._button = null;
    }

    get url() {
        return this._url;
    }

    get page() {
        return this._page;
    }

    get id() {
        return this._id;
    }

    check() {
        return this._page !== "";
    }

    addButton() {
        switch (this._page) {
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
        if (this._button !== null) return;

        const isMobile = document.querySelector("div#root") === null;

        // Button element
        const button = document.createElement("button");

        button.classList.add("px-button");

        if (isMobile) {
            button.classList.add("mobile");
            button.classList.add("c-gray-90");
        }

        // Button listener
        const listener = async () => {
            button.removeEventListener("click", listener);
            button.disabled = true;

            try {
                await this.download(({ state, progress }) => {
                    let message = browser.i18n.getMessage(`ph${state.charAt(0).toUpperCase() + state.slice(1)}`);

                    if (progress) {
                        message += `: ${Math.floor(progress * 100)}%`;
                    }

                    span.textContent = message;
                });

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

        // Button icon
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

        // Button text
        const span = document.createElement("span");

        if (PxContent.getDownloaded(this._page, this._id)) {
            span.textContent = browser.i18n.getMessage("phDone");
            button.classList.add("downloaded");
        } else {
            span.textContent = "Px Downloader";
        }

        button.appendChild(span);

        // Add button
        const addButton = (parent) => {
            if (isMobile) {
                parent.insertBefore(button, parent.firstChild);
            } else {
                parent.appendChild(button);
            }
        };

        const parent = document.querySelector("main section div:first-child section, .work-interactions");

        if (parent !== null) {
            addButton(parent);
        }

        // Button observer
        const buttonObserver = new MutationObserver(mutations => {
            if (document.contains(button)) return;

            for (const mutation of mutations) {
                for (const addedNode of mutation.addedNodes) {
                    if (addedNode.nodeType !== Node.ELEMENT_NODE) continue;

                    const addedNodeParent = addedNode.querySelector("main section div:first-child section, .work-interactions");

                    if (addedNodeParent !== null) addButton(addedNodeParent);
                }
            }
        });

        buttonObserver.observe(document, {
            childList: true,
            subtree: true
        });

        this._button = {
            element: button,
            observer: buttonObserver
        };
    }

    removeButton() {
        switch (this._page) {
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
        if (this._button === null) return;

        // Button observer
        this._button.observer.disconnect();

        // Button element
        if (this._button.element.parentNode !== null) {
            this._button.element.parentNode.removeChild(this._button.element);
        }

        this._button = null;
    }

    async download(callback) {
        await messenger.sendMessage("download", {
            page: this._page,
            id: this._id
        }, callback);

        PxContent.setDownloaded(this._page, this._id);
    }

    static getDownloaded(page, id) {
        const key = `${page}_${id}`;

        const value = localStorage.getItem("pxDownloaded");

        if (value === null) return false;

        const downloaded = JSON.parse(value);

        if (!downloaded.includes(key)) return false;

        return true;
    }

    static setDownloaded(page, id) {
        const key = `${page}_${id}`;

        let value = localStorage.getItem("pxDownloaded");

        let downloaded = value === null ? [] : JSON.parse(value);

        if (downloaded.includes(key)) {
            downloaded.splice(downloaded.indexOf(key), 1);
        }

        downloaded.push(key);

        if (downloaded.length > 10000) {
            downloaded = downloaded.slice(-10000);
        }

        value = JSON.stringify(downloaded);

        localStorage.setItem("pxDownloaded", value);
    }


    static getPage(_url) {
        let page;

        const url = new URL(_url);

        if (/\/artworks\/\d+/.test(url.pathname)) {
            page = "illust";
        } else if (url.pathname === "/novel/show.php" && url.searchParams.get("id") !== null) {
            page = "novel";
        } else if (url.pathname === "/member_illust.php") {
            page = "imageList";
        } else if (/\/user\/\d+\/series\/\d+/.test(url.pathname)) {
            page = "imageSeries";
        } else if (url.pathname === "/novel/member.php") {
            page = "novelList";
        } else if (/\/novel\/series\/\d+/.test(url.pathname)) {
            page = "novelSeries";
        } else {
            page = "";
        }

        return page;
    }

    static getId(_url) {
        let id;

        const url = new URL(_url);
        const page = PxContent.getPage(_url);

        switch (page) {
            case "illust": {
                id = url.pathname.match(/\/artworks\/(\d+)/)[1];

                break;
            }

            case "novel": {
                id = url.searchParams.get("id");

                break;
            }

            case "novelSeries": {
                id = url.pathname.match(/\/novel\/series\/(\d+)/)[1]

                break;
            }

            default: {
                id = "";

                break;
            }
        }

        return id;
    }
}
