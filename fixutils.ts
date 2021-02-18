import { utc } from 'moment'
import { fixRepeatingGroups } from './resources/fixSchema'
import { resolveKey, keyvals } from './resources/fixtagnums'

const headerFields: Partial<Readonly<Record<keyvals, boolean>>> = {
    [keyvals.BeginString]: true,
    [keyvals.BodyLength]: true,
    [keyvals.MsgType]: true,
    [keyvals.CheckSum]: true,
    [keyvals.SendingTime]: true,
    [keyvals.SenderCompID]: true,
    [keyvals.SenderSubID]: true,
    [keyvals.TargetCompID]: true,
    [keyvals.MsgSeqNum]: true,
}

export let SOHCHAR = String.fromCharCode(1);

export function setSOHCHAR(char: string): void {
    SOHCHAR = char
}

export function getUTCTimeStamp() {
    return utc().format('YYYYMMDD-HH:mm:ss.SSS');
}

export function checksum(str: string) {
    let chksm = 0;
    for (let i = 0; i < str.length; i++) {
        chksm += str.charCodeAt(i);
    }

    chksm = chksm % 256;

    let checksumstr = '';
    if (chksm < 10) {
        checksumstr = '00' + (chksm + '');
    } else if (chksm >= 10 && chksm < 100) {
        checksumstr = '0' + (chksm + '');
    } else {
        checksumstr = '' + (chksm + '');
    }

    return checksumstr;
}

export function convertToFIX(
    msgraw: Readonly<Record<keyvals, unknown>>,
    fixVersion: unknown,
    timeStamp: unknown,
    senderCompID: unknown,
    targetCompID: unknown,
    outgoingSeqNum: unknown,
    options: {
        readonly senderSubID?: unknown;
        readonly targetSubID?: unknown;
        readonly senderLocationID?: unknown;
    },
): string {
    //defensive copy
    const msg: Record<keyvals, unknown> = { ...msgraw };

    delete msg[keyvals.BodyLength]; //bodylength
    delete msg[keyvals.CheckSum]; //checksum

    const headermsgarr: Array<unknown> = [];
    const bodymsgarr: Array<unknown> = [];
    //var trailermsgarr = [];

    headermsgarr.push('35=' + msg['35'], SOHCHAR);

    headermsgarr.push('49=' + (msg['49'] || senderCompID), SOHCHAR);

    if (options.senderSubID) {
        headermsgarr.push('50=' + (msg['50'] || options.senderSubID), SOHCHAR);
    }

    headermsgarr.push('56=' + (msg['56'] || targetCompID), SOHCHAR);

    if (options.targetSubID) {
        headermsgarr.push('57=' + (msg['57'] || options.targetSubID), SOHCHAR);
    }
    if (options.senderLocationID) {
        headermsgarr.push('142=' + (msg['142'] || options.senderLocationID), SOHCHAR);
    }

    headermsgarr.push('34=' + outgoingSeqNum, SOHCHAR);

    headermsgarr.push('52=' + timeStamp, SOHCHAR);

    for (const [tag, item] of (Object.entries(msg) as unknown as Array<[keyvals, unknown]>)) {
        if (headerFields[tag] !== true) {
            if (Array.isArray(item)) {
                bodymsgarr.push(tag, '=', item.length, SOHCHAR)
                for (const group of item) {
                    for (const [tag, item] of Object.entries(group)) {
                        bodymsgarr.push(tag, '=', item, SOHCHAR)
                    }
                }
            } else {
                bodymsgarr.push(tag, '=', item, SOHCHAR)
            }
        }
    }

    const headermsg = headermsgarr.join('');
    //var trailermsg = trailermsgarr.join('');
    const bodymsg = bodymsgarr.join('');

    var outmsgarr: Array<unknown> = [];
    outmsgarr.push('8=', msg['8'] || fixVersion, SOHCHAR);
    outmsgarr.push('9=', (headermsg.length + bodymsg.length), SOHCHAR);
    outmsgarr.push(headermsg);
    outmsgarr.push(bodymsg);
    //outmsgarr.push(trailermsg);

    let outmsg = outmsgarr.join('');

    outmsg += '10=' + checksum(outmsg) + SOHCHAR;

    return outmsg;
}

function convertToKeyvals(msg: string): ReadonlyArray<readonly [`${number}`, unknown]> {
    const keyvals: Array<[`${number}`, unknown]> = []
    let cursor = 0

    while (cursor < msg.length) {
        let i = cursor
        let attrLength = 0
        let key: `${number}` | undefined
        let value: unknown
        while (true) {
            if (msg[i] === '=') {
                key = msg.substr(cursor, attrLength) as any
                attrLength = 0
                cursor = i + 1
            }
            else if (msg[i] === SOHCHAR) {
                value = msg.substr(cursor, attrLength - 1)
                cursor = i + 1
                break;
            }
            attrLength++
            i++
        }

        keyvals.push([key as any, value])

        if (key === '212') {
            const xmlPair = ['213']
            const xmlLength = Number(value) + 5
            xmlPair[1] = msg.slice(cursor + 4, cursor + xmlLength - 1)
            keyvals.push(xmlPair as any)
            cursor += xmlLength
        }
    }

    return keyvals
}

export function convertToMap(msg: string) {
    const fix: Record<number, unknown> = {}
    const keyvals = convertToKeyvals(msg)

    let i = 0;
    while (i < keyvals.length) {
        const pair = keyvals[i]
        if (pair.length === 2) {
            const repeatinGroup = fixRepeatingGroups[pair[0]]
            if (!repeatinGroup) {
                fix[pair[0] as unknown as number] = pair[1]
                i++
            } else {
                const nr = Number(pair[1])
                if (nr) {
                    const response = repeatingGroupToMap(repeatinGroup, nr, keyvals.slice(i + 1));
                    fix[pair[0] as unknown as number] = response.repeatingGroup
                    i += (1 + response.length)
                } else {
                    throw new Error('Repeating Group: "' + pair.join('=') + '" is invalid')
                }
            }
        } else
            i++
    }

    return fix;
}

export function convertToJSON(msg: string): Partial<Readonly<Record<keyof typeof keyvals, unknown>>> {
    const fix: Partial<Record<keyof typeof keyvals, unknown>> = {}
    const msgKeyvals = convertToKeyvals(msg)

    let i = 0;
    while (i < msgKeyvals.length) {
        const [key, value] = msgKeyvals[i]
        const repeatingGroup = fixRepeatingGroups[key]
        if (repeatingGroup === undefined) {
            fix[resolveKey(key)] = value
            i++
        } else {
            const nr = Number(value)
            if (nr) {
                const response = repeatingGroupToJSON(repeatingGroup, nr, msgKeyvals.slice(i + 1))
                fix[resolveKey(key)] = response.repeatingGroup
                i += (1 + response.length)
            } else {
                throw new Error(`Repeating Group: "${key} = ${value}" is invalid`)
            }
        }
    }

    return fix;
}

function repeatingGroupToMap(
    repeatinGroup: ReadonlyArray<`${number}`>,
    nr: number,
    msgKeyvals: ReadonlyArray<readonly [`${number}`, unknown]>,
): {
    readonly length: number;
    readonly repeatingGroup: ReadonlyArray<Partial<Readonly<Record<number, unknown>>>>;
} {
    const response: {
        length: number;
        repeatingGroup: Array<Partial<Record<number, unknown>>>;
    } = {
        repeatingGroup: [],
        length: 0
    }
    for (let i = 0, k = 0; i < nr; i++) {
        const group: (typeof response)['repeatingGroup'][number] = {}
        let index = 0

        while (true) {
            if (repeatinGroup.indexOf(msgKeyvals[k][0]) === -1 || (repeatinGroup[0] === msgKeyvals[k][0] && index !== 0)) {
                break;
            } else {
                group[msgKeyvals[k][0] as unknown as number] = msgKeyvals[k][1]
                ++k
                ++index
            }
        }
        response.repeatingGroup.push(group)
        response.length = k
    }
    return response
}

function repeatingGroupToJSON(
    repeatingGroup: ReadonlyArray<`${number}`>,
    nr: number,
    keyvalPairs: ReadonlyArray<ReadonlyArray<any>>,
): {
    readonly length: number;
    readonly repeatingGroup: ReadonlyArray<Partial<Readonly<Record<keyof typeof keyvals, unknown>>>>;
} {
    const response: {
        length: number;
        repeatingGroup: Array<Partial<Record<keyof typeof keyvals, unknown>>>;
    } = {
        repeatingGroup: [],
        length: 0,
    }

    for (let i = 0, k = 0; i < nr; i++) {
        const group: (typeof response)['repeatingGroup'][number] = {}
        let index = 0

        while (true) {
            if (repeatingGroup.indexOf(keyvalPairs[k][0]) === -1 || (repeatingGroup[0] === keyvalPairs[k][0] && index !== 0)) {
                break;
            } else {
                group[resolveKey(keyvalPairs[k][0])] = keyvalPairs[k][1]
                ++k
                ++index
            }
        }

        response.repeatingGroup.push(group)
        response.length = k
    }

    return response
}
