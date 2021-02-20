import { checksum } from '../fixutils'
import { Observable, from } from 'rxjs'

//static vars
const SOHCHAR = String.fromCharCode(1)
const re = new RegExp(SOHCHAR, "g")
const ENDOFTAG8 = 10
const STARTOFTAG9VAL = ENDOFTAG8 + 2;
const SIZEOFTAG10 = 8

export class FrameDecoder {
    #buffer: string = ''

    public readonly decode = (data: { toString(): string }): Observable<string> => {
        this.#buffer += data.toString()
        const messages: Array<string> = []

        while (this.#buffer.length > 0) {
            //====================================Step 1: Extract complete FIX message====================================

            //If we don't have enough data to start extracting body length, wait for more data
            if (this.#buffer.length <= ENDOFTAG8) {
                return from(messages)
            }

            const idxOfEndOfTag9 = Number(this.#buffer.substring(ENDOFTAG8).indexOf(SOHCHAR)) + ENDOFTAG8;
            const bodyLength = Number(this.#buffer.substring(STARTOFTAG9VAL, idxOfEndOfTag9));

            const msgLength = bodyLength + idxOfEndOfTag9 + SIZEOFTAG10

            let msg: string
            if (!isNaN(msgLength) && this.#buffer.length >= msgLength) {
                msg = this.#buffer.substring(0, msgLength);

                if (msgLength === this.#buffer.length) {
                    this.#buffer = '';
                }
                else {
                    this.#buffer = this.#buffer.substring(msgLength)
                }
            }
            else {//Message received!
                return from(messages)
            }
            //====================================Step 2: Validate message====================================

            const calculatedChecksum = checksum(msg.substr(0, msg.length - 7));
            const extractedChecksum = msg.substr(msg.length - 4, 3);

            if (calculatedChecksum !== extractedChecksum) {
                const error = '[WARNING] Discarding message because body length or checksum are wrong (expected checksum: '
                    + calculatedChecksum + ', received checksum: ' + extractedChecksum + '): [' + msg.replace(re, '|') + ']'
                throw new Error(error)
            }

            messages.push(msg)
        }

        return from(messages)
    }
}
