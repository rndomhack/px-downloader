const crc32Table = new Int32Array(256);

for (let i = 0; i < crc32Table.length; i++) {
    let value = i;

    for (let j = 0; j < 8; j++) {
        value = (value & 1) ? (0xEDB88320 ^ (value >>> 1)) : value >>> 1;
    }

    crc32Table[i] = value;
}

class Crc32 {
    static calc(buffer) {
        let crc = -1;

        for (let i = 0, l = buffer.length; i < l; i++) {
            crc = crc32Table[(crc ^ buffer[i]) & 0xFF] ^ (crc >>> 8);
        }

        return crc ^ -1;
    }
}

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

function fetch(options) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.addEventListener("load", () => {
            resolve(xhr.response);
        });

        xhr.addEventListener("error", err => {
            reject(err);
        });

        xhr.open("GET", options.url);
        xhr.responseType = options.responseType;
        xhr.send();
    });
}

export default class Apng {
    constructor() {
        this.canvas = document.createElement("canvas");
        this.frames = [];
    }

    getSignature() {
        return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    }

    readChunks(buffer) {
        const chunks = [];
        const reader = new Reader(buffer, 0, false);

        while (reader.position < buffer.length << 3) {
            const chunk = {};

            const length = reader.readBits(32);

            const crc32Start = reader.position >> 3;

            chunk.type = reader.readString(4);
            chunk.data = reader.readBytes(length);

            const crc32End = reader.position >> 3;

            if (reader.readBits(32) !== Crc32.calc(buffer.subarray(crc32Start, crc32End))) {
                throw new Error("Incorrect CRC32");
            }

            chunks.push(chunk);

            if (chunk.type === "IEND") break;
        }

        return chunks;
    }

    writeChunks(chunks) {
        const buffer = new Uint8Array(chunks.reduce((prev, chunk) => prev + 4 + 4 + chunk.data.length + 4, 0));
        const writer = new Writer(buffer, 0, false);

        for (const chunk of chunks) {
            writer.writeBits(32, chunk.data.length);

            const crc32Start = writer.position >> 3;

            writer.writeString(4, chunk.type);
            writer.writeBytes(chunk.data.length, chunk.data);

            const crc32End = writer.position >> 3;

            writer.writeBits(32, Crc32.calc(buffer.subarray(crc32Start, crc32End)));
        }

        return buffer;
    }

    createActlChunk(options) {
        const buffer = new Uint8Array(8);
        const writer = new Writer(buffer, 0, false);

        writer.writeBits(32, options.numFrames);
        writer.writeBits(32, options.numPlays);

        return {
            type: "acTL",
            data: buffer
        };
    }

    createFctlChunk(options) {
        const buffer = new Uint8Array(26);
        const writer = new Writer(buffer, 0, false);

        writer.writeBits(32, options.sequenceNumber);
        writer.writeBits(32, options.width);
        writer.writeBits(32, options.height);
        writer.writeBits(32, options.xOffset || 0);
        writer.writeBits(32, options.yoffset || 0);
        writer.writeBits(16, options.delayNum);
        writer.writeBits(16, options.delayDen);
        writer.writeBits(8, options.disposeOp || 0);
        writer.writeBits(8, options.blendOp || 0);

        return {
            type: "fcTL",
            data: buffer
        };
    }

    createFdatChunk(options) {
        const buffer = new Uint8Array(4 + options.frameData.length);
        const writer = new Writer(buffer, 0, false);

        writer.writeBits(32, options.sequenceNumber);
        writer.writeBytes(options.frameData.length, options.frameData);

        return {
            type: "fdAT",
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

            const binary = atob(canvas.toDataURL("image/png").split(",")[1]);
            const buffer = new Uint8Array(binary.split("").map(value => {
                return value.charCodeAt(0);
            }));

            blob = new Blob([buffer], { type: "image/png" });
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

        let sequenceNumber = 0;

        for (const frame of this.frames) {
            const isFirst = this.frames.indexOf(frame) === 0;

            const blobUrl = URL.createObjectURL(frame.blob);

            const arrayBuffer = await fetch({
                url: blobUrl,
                responseType: "arraybuffer"
            });

            URL.revokeObjectURL(blobUrl);

            const buffer = new Uint8Array(arrayBuffer);

            const chunks = this.readChunks(buffer.subarray(8));

            for (const chunk of chunks) {
                switch (chunk.type) {
                    case "IHDR": {
                        const reader = new Reader(chunk.data, 0, false);

                        const width = reader.readBits(32);
                        const height = reader.readBits(32);

                        if (sequenceNumber === 0) {
                            rebuiltChunks.push({
                                type: "IHDR",
                                data: chunk.data
                            });

                            rebuiltChunks.push(this.createActlChunk({
                                numFrames: this.frames.length,
                                numPlays: loop
                            }));
                        }

                        rebuiltChunks.push(this.createFctlChunk({
                            sequenceNumber: sequenceNumber++,
                            width: width,
                            height: height,
                            delayNum: frame.duration,
                            delayDen: 1000
                        }));

                        break;
                    }

                    case "IDAT": {
                        if (isFirst) {
                            rebuiltChunks.push({
                                type: "IDAT",
                                data: chunk.data
                            });
                        } else {
                            rebuiltChunks.push(this.createFdatChunk({
                                sequenceNumber: sequenceNumber++,
                                frameData: chunk.data
                            }));
                        }

                        break;
                    }
                }
            }
        }

        rebuiltChunks.push({
            type: "IEND",
            data: new Uint8Array(0)
        });

        return new Blob([this.getSignature(), this.writeChunks(rebuiltChunks)], { "type": "image/png" });
    }
}
