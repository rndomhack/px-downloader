class Reader {
    constructor(buffer, position, isLittleEndian) {
        this.buffer = buffer;
        this.position = position || 0;
        this.isLittleEndian = isLittleEndian || false;
    }

    readBits(length) {
        if (this.position + length > this.buffer.length << 3) {
            this.position += length;
            return 0;
        }

        let value = 0;

        if (this.isLittleEndian) {
            for (let i = 0; i < length; i++) {
                const index = this.position >> 3;
                const shift = this.position & 0x07;

                value |= (this.buffer[index] >> shift & 0x01) << i;

                this.position++;
            }
        } else {
            for (let i = length - 1; i >= 0; i--) {
                const index = this.position >> 3;
                const shift = this.position & 0x07 ^ 0x07;

                value <<= 1;
                value |= this.buffer[index] >> shift & 0x01;

                this.position++;
            }
        }

        return value;
    }

    readBytes(length) {
        if (this.position + (length << 3) > this.buffer.length << 3) {
            this.position += length << 3;
            return new Uint8Array(0);
        }

        const start = this.position >> 3;

        this.position += length << 3;

        return this.buffer.subarray(start, start + length);
    }

    next(length) {
        this.position += length;
    }

    previous(length) {
        this.position -= length;
    }

    readString(length) {
        if (this.position + (length << 3) > this.buffer.length << 3) {
            this.position += length << 3;
            return "";
        }

        const value = String.fromCharCode(...this.buffer.subarray(this.position >> 3, (this.position >> 3) + length));

        this.position += length << 3;

        return value;
    }
}

class Writer {
    constructor(buffer, position, isLittleEndian) {
        this.buffer = buffer;
        this.position = position || 0;
        this.isLittleEndian = isLittleEndian || false;
    }

    writeBits(length, value) {
        if (this.position + length > this.buffer.length << 3) {
            this.position += length;
            return;
        }

        if (this.isLittleEndian) {
            for (let i = 0; i < length; i++) {
                const index = this.position >> 3;
                const shift = this.position & 0x07;

                this.buffer[index] = (this.buffer[index] & ~(1 << shift)) | ((value >> i & 0x01) << shift);

                this.position++;
            }
        } else {
            for (let i = length - 1; i >= 0; i--) {
                const index = this.position >> 3;
                const shift = this.position & 0x07 ^ 0x07;

                this.buffer[index] = (this.buffer[index] & ~(1 << shift)) | ((value >> i & 0x01) << shift);

                this.position++;
            }
        }
    }

    writeBytes(length, value) {
        if (this.position + (length << 3) > this.buffer.length << 3) {
            this.position += length << 3;
            return;
        }

        const start = this.position >> 3;

        this.position += length << 3;

        this.buffer.set(value.subarray(0, length), start);
    }

    next(length) {
        this.position += length;
    }

    previous(length) {
        this.position -= length;
    }

    writeString(length, value) {
        if (this.position + (length << 3) > this.buffer.length << 3) {
            this.position += length << 3;
            return;
        }

        while (length > 0) {
            const index = this.position >> 3;

            this.buffer[index] = value.charCodeAt(value.length - length);

            this.position += 8;
            length--;
        }
    }
}

function blobUrlToArrayBuffer(blobUrl) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.addEventListener("load", () => {
            resolve(xhr.response);
        });

        xhr.addEventListener("error", err => {
            reject(err);
        });

        xhr.open("GET", blobUrl);
        xhr.responseType = "arraybuffer";
        xhr.send();
    });
}

export default class Webp {
    constructor() {
        this.canvas = document.createElement("canvas");
        this.frames = [];
    }

    readChunks(buffer) {
        const chunks = [];
        const reader = new Reader(buffer, 0, true);

        while (reader.position < buffer.length << 3) {
            const chunk = {};

            chunk.id = reader.readString(4);
            const length = reader.readBits(32);
            chunk.data = reader.readBytes(length);

            if (length % 2 === 1) {
                reader.next(8);
            }

            chunks.push(chunk);
        }

        return chunks;
    }

    writeChunks(chunks) {
        const buffer = new Uint8Array(chunks.reduce((prev, chunk) => prev + 4 + 4 + chunk.data.length + chunk.data.length % 2, 0));
        const writer = new Writer(buffer, 0, true);

        for (const chunk of chunks) {
            writer.writeString(4, chunk.id);
            writer.writeBits(32, chunk.data.length);
            writer.writeBytes(chunk.data.length, chunk.data);

            if (chunk.data.length % 2 === 1) {
                writer.next(8);
            }
        }

        return buffer;
    }

    createRiffChunk(options) {
        const buffer = new Uint8Array(4 + options.buffer.length);
        const writer = new Writer(buffer, 0, true);

        writer.writeString(4, options.type);
        writer.writeBytes(options.buffer.length, options.buffer);

        return {
            id: "RIFF",
            data: buffer
        };
    }

    createVp8xChunk(options) {
        const buffer = new Uint8Array(10);
        const writer = new Writer(buffer, 0, true);

        writer.next(1);
        writer.writeBits(1, options.animation ? 1 : 0);
        writer.writeBits(1, options.xmpMetadata ? 1 : 0);
        writer.writeBits(1, options.exifMetadata ? 1 : 0);
        writer.writeBits(1, options.alpha ? 1 : 0);
        writer.writeBits(1, options.iccProfile ? 1 : 0);
        writer.next(2);
        writer.next(24);
        writer.writeBits(24, options.canvasWidthMinusOne);
        writer.writeBits(24, options.canvasHeightMinusOne);

        return {
            id: "VP8X",
            data: buffer
        };
    }

    createAnimChunk(options) {
        const buffer = new Uint8Array(6);
        const writer = new Writer(buffer, 0, true);

        writer.writeBits(32, options.backgroundColor);
        writer.writeBits(16, options.loopCount);

        return {
            id: "ANIM",
            data: buffer
        };
    }

    createAnmfChunk(options) {
        const buffer = new Uint8Array(16 + options.frameData.length);
        const writer = new Writer(buffer, 0, true);

        writer.writeBits(24, options.frameX || 0);
        writer.writeBits(24, options.frameY || 0);
        writer.writeBits(24, options.frameWidthMinusOne);
        writer.writeBits(24, options.frameHeightMinusOne);
        writer.writeBits(24, options.frameDuration);
        writer.writeBits(1, options.disposalMethod ? 1 : 0);
        writer.writeBits(1, options.blendingMethod ? 1 : 0);
        writer.next(6);
        writer.writeBytes(options.frameData.length, options.frameData);

        return {
            id: "ANMF",
            data: buffer
        };
    }

    add(image, {duration = 1000} = {}) {
        let blob;

        if (image instanceof Blob) {
            blob = image;
        } else if (image instanceof HTMLImageElement || image instanceof HTMLCanvasElement) {
            let canvas;

            if (image instanceof HTMLImageElement) {
                canvas = this.canvas;

                const ctx = canvas.getContext("2d");

                canvas.width = image.width;
                canvas.height = image.height;

                ctx.clearRect(0, 0, image.width, image.height);
                ctx.drawImage(image, 0, 0);
            } else {
                canvas = image;
            }

            const binary = atob(canvas.toDataURL("image/webp").split(",")[1]);
            const buffer = new Uint8Array(binary.split("").map(value => {
                return value.charCodeAt(0);
            }));

            blob = new Blob([buffer], { type: "image/webp" });
        } else {
            throw new Error("Unsupported image");
        }

        this.frames.push({
            blob: blob,
            buffer: null,
            duration: duration
        });
    }

    async render({loop = 0} = {}) {
        const rebuiltChunks = [];

        for (const frame of this.frames) {
            const isFirst = this.frames.indexOf(frame) === 0;

            const blobUrl = URL.createObjectURL(frame.blob);

            const arrayBuffer = await blobUrlToArrayBuffer(blobUrl);

            URL.revokeObjectURL(blobUrl);

            const buffer = new Uint8Array(arrayBuffer);

            const riffChunks = this.readChunks(buffer);

            if (riffChunks.length !== 1 || riffChunks[0].id !== "RIFF") {
                throw new Error("Can't find RIFF chunk");
            }

            const chunks = this.readChunks(riffChunks[0].data.subarray(4));

            const frameDataChunks = [];

            for (const chunk of chunks) {
                switch (chunk.id) {
                    case "ALPH": {
                        frameDataChunks.push(chunk);

                        break;
                    }

                    case "VP8 ":
                    case "VP8L": {
                        frameDataChunks.push(chunk);

                        const reader = new Reader(chunk.data, 0, true);

                        let widthMinusOne, heightMinusOne;

                        switch (chunk.id) {
                            case "VP8 ": {
                                reader.next(48);

                                widthMinusOne = (reader.readBits(16) & 0x3FFF) - 1;
                                heightMinusOne = (reader.readBits(16) & 0x3FFF) - 1;

                                break;
                            }

                            case "VP8L": {
                                reader.next(8);

                                widthMinusOne = reader.readBits(14);
                                heightMinusOne = reader.readBits(14);

                                break;
                            }
                        }

                        if (isFirst) {
                            rebuiltChunks.push(this.createVp8xChunk({
                                animation: true,
                                canvasWidthMinusOne: widthMinusOne,
                                canvasHeightMinusOne: heightMinusOne
                            }));

                            rebuiltChunks.push(this.createAnimChunk({
                                backgroundColor: 0x00000000,
                                loopCount: loop
                            }));
                        }

                        rebuiltChunks.push(this.createAnmfChunk({
                            frameWidthMinusOne: widthMinusOne,
                            frameHeightMinusOne: heightMinusOne,
                            frameDuration: frame.duration,
                            frameData: this.writeChunks(frameDataChunks)
                        }));

                        break;
                    }
                }
            }
        }

        return new Blob([this.writeChunks([this.createRiffChunk({ type: "WEBP", buffer: this.writeChunks(rebuiltChunks)})])], { "type": "image/webp" });
    }
}
