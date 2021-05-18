"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FrameDecoder = void 0;
const fixutils_1 = require("../fixutils");
const SOHCHAR = String.fromCharCode(1);
const re = new RegExp(SOHCHAR, "g");
const SIZEOFTAG10 = 8;
class FrameDecoder {
    constructor() {
        this.#buffer = '';
        this.decode = (data) => {
            this.#buffer += data.toString();
            const messages = [];
            while (this.#buffer.length > 0) {
                if (this.#buffer.length <= SIZEOFTAG10) {
                    return messages;
                }
                let msgLength = 0;
                let cursor = 0;
                while (cursor < this.#buffer.length) {
                    let i = cursor;
                    let attrLength = 0;
                    let key = '';
                    let value;
                    while (true) {
                        if (this.#buffer[i] === '=') {
                            key = this.#buffer.substr(cursor, attrLength);
                            attrLength = 0;
                            cursor = i + 1;
                        }
                        else if (this.#buffer[i] === SOHCHAR) {
                            value = this.#buffer.substr(cursor, attrLength - 1);
                            cursor = i + 1;
                            break;
                        }
                        attrLength++;
                        i++;
                    }
                    if (key === '9') {
                        msgLength = Number(value) + i + SIZEOFTAG10;
                        break;
                    }
                }
                let msg;
                if (!isNaN(msgLength) && this.#buffer.length >= msgLength) {
                    msg = this.#buffer.substring(0, msgLength);
                    if (msgLength === this.#buffer.length) {
                        this.#buffer = '';
                    }
                    else {
                        this.#buffer = this.#buffer.substring(msgLength);
                    }
                }
                else {
                    return messages;
                }
                const calculatedChecksum = fixutils_1.checksum(msg.substr(0, msg.length - 7));
                const extractedChecksum = msg.substr(msg.length - 4, 3);
                if (calculatedChecksum !== extractedChecksum) {
                    const error = '[WARNING] Discarding message because body length or checksum are wrong (expected checksum: '
                        + calculatedChecksum + ', received checksum: ' + extractedChecksum + '): [' + msg.replace(re, '|') + ']';
                    throw new Error(error);
                }
                messages.push(msg);
            }
            return messages;
        };
    }
    #buffer;
}
exports.FrameDecoder = FrameDecoder;
//# sourceMappingURL=FrameDecoder.js.map