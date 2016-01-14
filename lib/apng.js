"use strict";

var Apng = null;

(() => {
    class Crc32 {
        constructor() {
            this.table = new Array(256);

            for (let i = 0; i < this.table.length; i++) {
                let value = i;

                for (let j = 0; j < 8; j++) {
                    value = (value & 1) ? (0xEDB88320 ^ (value >>> 1)) : value >>> 1;
                }

                this.table[i] = value;
            }
        }

        calc(array) {
            var crc = -1;

            for (let i = 0; i < array.length; i++) {
                var index = (crc ^ array[i]) & 0xFF;
                crc = this.table[index] ^ (crc >>> 8);
            }

            return crc ^ -1;
        }
    }

    class Reader {
        constructor(options) {
            this.buffer = options.buffer;
            this.offset = options.offset || 0;
        }

        readBytes(length) {
            var value = 0;

            for (let i = 0; i < length; i++) {
                value += this.buffer[this.offset + i] << ((length - 1 - i) * 8);
            }

            this.offset += length;

            return value;
        }

        readBuffer(length) {
            var value = new Uint8Array(this.buffer.subarray(this.offset, this.offset + length));

            this.offset += length;

            return value;
        }

        readString(length) {
            var array = Array.from(this.buffer.subarray(this.offset, this.offset + length));

            this.offset += length;

            return String.fromCharCode.apply(String, array);
        }
    }

    class Writer {
        constructor(options) {
            this.buffer = options.buffer;
            this.offset = options.offset || 0;
        }

        writeBytes(length, value) {
            var array = [];

            for (let i = 0; i < length; i++) {
                array.push((value >>> ((length - 1 - i) * 8)) & 0xFF);
            }

            this.buffer.set(array, this.offset);
            this.offset += length;
        }

        writeBuffer(length, value) {
            length = length || value.length;

            this.buffer.set(value, this.offset);
            this.offset += value.length;
        }

        writeString(length, value) {
            length = length || value.length;

            var array = [];

            for (let i = 0; i < length; i++) {
                array.push(value.charCodeAt(i));
            }

            this.buffer.set(array, this.offset);
            this.offset += length;
        }
    }

    Apng = class {
        constructor(options) {
            options = options || {};

            this.events = {};
            this.canvas = document.createElement("canvas");
            this.frames = [];
            this.plays = options.plays || 0;
            this.delay = options.delay || [1, 10];
            this.crc32 = new Crc32();
        }

        getSignature() {
            return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
        }

        readChunks(buffer) {
            var chunks = [];
            var chunk = null;
            var reader = new Reader({ buffer: buffer, offset: 8 });

            do {
                chunk = {};

                chunk.length = reader.readBytes(4);
                chunk.type = reader.readString(4);
                chunk.data = reader.readBuffer(chunk.length);
                chunk.crc = reader.readBytes(4);

                chunks.push(chunk);
            } while (chunk.type !== "IEND" && reader.offset < buffer.length);

            return chunks;
        }

        createChunk(type, data) {
            var length = type.length + data.length;
            var buffer = new Uint8Array(length + 8);
            var writer = new Writer({ buffer: buffer });

            writer.writeBytes(4, data.length);
            writer.writeString(4, type);
            writer.writeBuffer(null, data);
            writer.writeBytes(4, this.crc32.calc(buffer.subarray(4, length + 4)));

            return buffer;
        }

        createacTLChunk(options) {
            var buffer = new Uint8Array(8);
            var writer = new Writer({ buffer: buffer });

            writer.writeBytes(4, options.frames);
            writer.writeBytes(4, options.plays);

            return this.createChunk("acTL", buffer);
        }

        createfcTLChunk(options) {
            var buffer = new Uint8Array(26);
            var writer = new Writer({ buffer: buffer });

            writer.writeBytes(4, options.number);
            writer.writeBytes(4, options.width);
            writer.writeBytes(4, options.height);
            writer.writeBytes(4, "offset" in options ? options.offset[0] : 0);
            writer.writeBytes(4, "offset" in options ? options.offset[1] : 0);
            writer.writeBytes(2, options.delay[0]);
            writer.writeBytes(2, options.delay[1]);
            writer.writeBytes(1, options.dispose_op || 0);
            writer.writeBytes(1, options.blend_op || 0);

            return this.createChunk("fcTL", buffer);
        }

        createfdATChunk(options) {
            var buffer = new Uint8Array(options.data.length + 4);
            var writer = new Writer({ buffer: buffer });

            writer.writeBytes(4, options.number);
            writer.writeBuffer(null, options.data);

            return this.createChunk("fdAT", buffer);
        }

        add(image, options) {
            options = options || {};

            var blob;

            if (image instanceof Blob) {
                blob = image;
            } else if (image instanceof HTMLImageElement || image instanceof HTMLCanvasElement) {
                let canvas, ctx;

                if (image instanceof HTMLImageElement) {
                    canvas = this.canvas;
                    ctx = canvas.getContext("2d");

                    canvas.width = image.width;
                    canvas.height = image.height;

                    ctx.clearRect(0, 0, image.width, image.height);
                    ctx.drawImage(image, 0, 0);
                } else {
                    canvas = image;
                }

                var binary = atob(canvas.toDataURL("image/png").split(",")[1]);
                var buffer = new Uint8Array(binary.split("").map(value => {
                    return value.charCodeAt(0);
                }));

                blob = new Blob([buffer], { type: "image/png" });
            } else {
                throw new Error("Unsupported image");
            }

            this.frames.push({
                data: [],
                blob: blob,
                width: 0,
                height: 0,
                offset: options.offset || [0, 0],
                delay: options.delay || this.delay
            });
        }

        render() {
            var promise = Promise.resolve();
            var frames = this.frames;
            var header = null;
            var result = [];

            frames.forEach(frame => {
                promise = promise.then(() => {
                    return new Promise((resolve, reject) => {
                        var reader = new FileReader();

                        reader.addEventListener("load", () => {
                            frame.buffer = reader.result;

                            resolve();
                        });

                        reader.addEventListener("error", err => {
                            reject(err);
                        });

                        reader.readAsArrayBuffer(frame.blob);
                    });
                }).then(() => {
                    var buffer = new Uint8Array(frame.buffer);
                    var chunks = this.readChunks(buffer);

                    chunks.forEach(chunk => {
                        if (chunk.type === "IHDR") {
                            var reader = new Reader({ buffer: chunk.data });

                            frame.width = reader.readBytes(4);
                            frame.height = reader.readBytes(4);

                            if (frames.indexOf(frame) === 0) {
                                header = chunk.data;
                            }
                        }

                        if (chunk.type === "IDAT") {
                            frame.data.push(chunk.data);
                        }
                    });
                });
            });

            promise = promise.then(() => {
                var number = 0;

                result.push(this.getSignature());
                result.push(this.createChunk("IHDR", header));
                result.push(this.createacTLChunk({
                    frames: frames.length,
                    plays: this.plays
                }));

                frames.forEach((frame, index) => {
                    result.push(this.createfcTLChunk({
                        number: number++,
                        width: frame.width,
                        height: frame.height,
                        offset: frame.offset,
                        delay: frame.delay
                    }));

                    if (index === 0) {
                        frame.data.forEach(value2 => {
                            result.push(this.createChunk("IDAT", value2));
                        });
                    } else {
                        frame.data.forEach(value2 => {
                            result.push(this.createfdATChunk({
                                number: number++,
                                data: value2
                            }));
                        });
                    }
                });

                result.push(this.createChunk("IEND", []));

                return new Blob(result, { "type": "image/png" });
            });

            return promise;
        }
    };
})();
