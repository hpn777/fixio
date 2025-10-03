import { checksum, SOHCHAR } from '../fixutils'

//static vars
const re = new RegExp(SOHCHAR, "g")
const SIZEOFTAG10 = 8

export class FrameDecoder {
    #buffer: string = ''

    public readonly decode = (data: { toString(): string }): Array<string> => {
        this.#buffer += data.toString()
        const messages: Array<string> = []

        while (this.#buffer.length > 0) {
            //====================================Step 1: Extract complete FIX message====================================

            //If we don't have enough data to start extracting body length, wait for more data
            if (this.#buffer.length <= SIZEOFTAG10) {
                return messages
            }

            let msgLength = 0
            let cursor = 0
            while (cursor < this.#buffer.length) {
                let i = cursor
                let attrLength = 0
                let key = ''
                let value: string
                while (true) {
                    if (this.#buffer[i] === '=') {
                        // Phase 3: Use slice instead of substr for better performance
                        key = this.#buffer.slice(cursor, cursor + attrLength)
                        attrLength = 0
                        cursor = i + 1
                    }
                    else if (this.#buffer[i] === SOHCHAR) {
                        // Phase 3: Use slice instead of substr for better performance
                        value = this.#buffer.slice(cursor, cursor + attrLength - 1)
                        cursor = i + 1
                        break;
                    }
                    attrLength++
                    i++
                }
                if (key === '9') {
                    msgLength = Number(value) + i + SIZEOFTAG10

                    break;
                }
            }

            let msg: string
            if (!isNaN(msgLength) && this.#buffer.length >= msgLength) {
                // Phase 3: Use slice for better performance
                msg = this.#buffer.slice(0, msgLength);

                if (msgLength === this.#buffer.length) {
                    this.#buffer = '';
                }
                else {
                    // Phase 3: Use slice for better performance
                    this.#buffer = this.#buffer.slice(msgLength)
                }
            }
            else {//Message received!
                return messages
            }
            //====================================Step 2: Validate message====================================

            // Phase 3: Use slice instead of substr for better performance
            const calculatedChecksum = checksum(msg.slice(0, msg.length - 7));
            const extractedChecksum = msg.slice(msg.length - 4, msg.length - 1);

            if (calculatedChecksum !== extractedChecksum) {
                const error = '[WARNING] Discarding message because body length or checksum are wrong (expected checksum: '
                    + calculatedChecksum + ', received checksum: ' + extractedChecksum + '): [' + msg.replace(re, '|') + ']'
                throw new Error(error)
            }

            messages.push(msg)
        }

        return messages
    }
}
