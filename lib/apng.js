"use strict";
var Apng = null;

(() => {
    var signature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    var crcTable = new Array(256);

    for (let i = 0; i < crcTable.length; i++) {
        let value = i;

        for (let j = 0; j < 8; j++) {
            value = (value & 1) ? (0xEDB88320 ^ (value >>> 1)) : value >>> 1;
        }

        crcTable[i] = value;
    }

    var crc32 = array => {
        var crc = -1;

        for (let i = 0; i < array.length; i++) {
            var index = (crc ^ array[i]) & 0xFF;
            crc = crcTable[index] ^ (crc >>> 8);
        }

        return crc ^ -1;
    };

    var createReader = (array, offset) => {
        return {
            array: array,
            offset: offset || 0
        };
    };

    /*
    var readByte = reader => {
        var value = reader.array[reader.offset];

        reader.offset += 1;

        return value;
    };
    */

    var readBytes = (reader, len) => {
        var value = 0;

        for (var i = 0; i < len; i++) {
            value += reader.array[reader.offset + i] << ((len - 1 - i) * 8);
        }

        reader.offset += len;

        return value;
    };

    var readArray = (reader, len) => {
        var value = new Uint8Array(reader.array.subarray(reader.offset, reader.offset + len));

        reader.offset += len;

        return value;
    };

    var readString = (reader, len) => {
        var array = Array.prototype.slice.call(reader.array.subarray(reader.offset, reader.offset + len));

        reader.offset += len;

        return String.fromCharCode.apply(String, array);
    };

    var writeByte = (reader, value) => {
        reader.array.set([value], reader.offset);
        reader.offset += 1;
    };

    var writeBytes = (reader, len, value) => {
        var array = [];

        for (var i = 0; i < len; i++) {
            array.push((value >>> ((len - 1 - i) * 8)) & 0xFF);
        }

        reader.array.set(array, reader.offset);
        reader.offset += len;
    };

    var writeArray = (reader, len, value) => {
        reader.array.set(value, reader.offset);
        reader.offset += value.length;
    };

    var writeString = (reader, len, value) => {
        len = len || value.length;

        var array = [];

        for (var i = 0; i < len; i++) {
            array.push(value.charCodeAt(i));
        }

        reader.array.set(array, reader.offset);
        reader.offset += len;
    };

    var readChunks = array => {
        var value = [];
        var obj = null;
        var reader = createReader(array, 8);

        do {
            obj = {};
            obj.length = readBytes(reader, 4);
            obj.type = readString(reader, 4);
            obj.data = readArray(reader, obj.length);
            obj.crc = readBytes(reader, 4);
            value.push(obj);
        } while (obj.type !== "IEND" && reader.offset < array.length);

        return value;
    };

    var makeChunk = (type, data) => {
        var len = type.length + data.length;
        var array = new Uint8Array(len + 8);
        var reader = createReader(array);

        writeBytes(reader, 4, data.length);
        writeString(reader, 4, type);
        writeArray(reader, null, data);
        writeBytes(reader, 4, crc32(array.subarray(4, len + 4)));

        return array;
    };

    var makeacTLChunk = options => {
        var array = new Uint8Array(8);
        var reader = createReader(array);

        writeBytes(reader, 4, options.frames);
        writeBytes(reader, 4, options.plays);

        array = makeChunk("acTL", array);

        return array;
    };

    var makefcTLChunk = options => {
        var array = new Uint8Array(26);
        var reader = createReader(array);

        writeBytes(reader, 4, options.number);
        writeBytes(reader, 4, options.width);
        writeBytes(reader, 4, options.height);
        writeBytes(reader, 4, "offset" in options ? options.offset[0] : 0);
        writeBytes(reader, 4, "offset" in options ? options.offset[1] : 0);
        writeBytes(reader, 2, options.delay[0]);
        writeBytes(reader, 2, options.delay[1]);
        writeByte(reader, options.dispose_op || 0);
        writeByte(reader, options.blend_op || 0);

        array = makeChunk("fcTL", array);

        return array;
    };

    var makefdATChunk = options => {
        var array = new Uint8Array(options.data.length + 4);
        var reader = createReader(array);

        writeBytes(reader, 4, options.number);
        writeArray(reader, null, options.data);

        array = makeChunk("fdAT", array);

        return array;
    };

    Apng = class {
        constructor(options) {
            options = options || {};

            this.events = {};
            this.canvas = document.createElement("canvas");
            this.frames = [];
            this.plays = options.plays || 0;
            this.delay = options.delay || [1, 10];
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
                var array = new Uint8Array(binary.split("").map(value => {
                    return value.charCodeAt(0);
                }));

                blob = new Blob([array], { type: "image/png" });
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
                    var array = new Uint8Array(frame.buffer);
                    var chunks = readChunks(array);

                    chunks.forEach(chunk => {
                        if (chunk.type === "IHDR") {
                            var reader = createReader(chunk.data);

                            frame.width = readBytes(reader, 4);
                            frame.height = readBytes(reader, 4);

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

                result.push(signature);
                result.push(makeChunk("IHDR", header));
                result.push(makeacTLChunk({
                    frames: frames.length,
                    plays: this.plays
                }));

                frames.forEach((frame, index) => {
                    result.push(makefcTLChunk({
                        number: number++,
                        width: frame.width,
                        height: frame.height,
                        offset: frame.offset,
                        delay: frame.delay
                    }));

                    if (index === 0) {
                        frame.data.forEach(value2 => {
                            result.push(makeChunk("IDAT", value2));
                        });
                    } else {
                        frame.data.forEach(value2 => {
                            result.push(makefdATChunk({
                                number: number++,
                                data: value2
                            }));
                        });
                    }
                });

                result.push(makeChunk("IEND", []));

                return new Blob(result, { "type": "image/png" });
            });

            return promise;
        }
    };
})();
