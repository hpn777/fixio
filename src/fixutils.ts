import { fixRepeatingGroups } from './resources/fixSchema'
import { resolveKey, keyvals } from './resources/fixtagnums'

const headerFields: Record<any, boolean> = {
    [keyvals.BeginString]: true,
    [keyvals.BodyLength]: true,
    [keyvals.MsgType]: true,
    [keyvals.CheckSum]: true,
    [keyvals.SendingTime]: true,
    [keyvals.SenderCompID]: true,
    [keyvals.SenderSubID]: true,
    [keyvals.TargetCompID]: true,
    [keyvals.MsgSeqNum]: true,
    [keyvals.ApplVerID]: true,
}

export let SOHCHAR = String.fromCharCode(1);

export function setSOHCHAR(char: string): void {
    SOHCHAR = char
}

/**
 * @returns `YYYYMMDD-HH:mm:ss.SSS`
 */
export function getUTCTimeStamp(date: Date = new Date()) {
    return [
        `${date.getUTCFullYear()}`.padStart(4, '0'),
        `${date.getUTCMonth() + 1}`.padStart(2, '0'),
        `${date.getUTCDate()}`.padStart(2, '0'),
        '-',
        `${date.getUTCHours()}`.padStart(2, '0'),
        ':',
        `${date.getUTCMinutes()}`.padStart(2, '0'),
        ':',
        `${date.getUTCSeconds()}`.padStart(2, '0'),
        '.',
        `${date.getUTCMilliseconds()}`.padStart(3, '0'),
    ].join('')
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

export function convertMapToFIX(map: Record<number, unknown>) {
    return convertToFIX(
        map,
        map[keyvals.BeginString],
        map[keyvals.SendingTime],
        map[keyvals.SenderCompID],
        map[keyvals.TargetCompID],
        map[keyvals.MsgSeqNum],
        {
            senderSubID: map[keyvals.SenderSubID],
        },
    );
}

export function convertToFIX(
    msg: Record<any, unknown>,
    fixVersion: unknown,
    timeStamp: unknown,
    senderCompID: unknown,
    targetCompID: unknown,
    outgoingSeqNum: unknown,
    options: {
        readonly senderSubID?: unknown
        readonly targetSubID?: unknown
        readonly senderLocationID?: unknown
        readonly appVerID?: unknown
    },
): string {
    //defensive copy
    delete msg[keyvals.BodyLength]; //bodylength
    delete msg[keyvals.CheckSum]; //checksum

    const headermsgarr: Array<unknown> = [];
    const bodymsgarr: Array<unknown> = [];

    headermsgarr.push('35=' + msg['35'], SOHCHAR);

    headermsgarr.push('49=' + (msg['49'] || senderCompID), SOHCHAR);

    headermsgarr.push('56=' + (msg['56'] || targetCompID), SOHCHAR);

    if (options.appVerID) {
        headermsgarr.push('1128=' + (msg['1128'] || options.appVerID), SOHCHAR);
    }

    if (options.senderSubID) {
        headermsgarr.push('50=' + (msg['50'] || options.senderSubID), SOHCHAR);
    }

    if (options.targetSubID) {
        headermsgarr.push('57=' + (msg['57'] || options.targetSubID), SOHCHAR);
    }
    if (options.senderLocationID) {
        headermsgarr.push('142=' + (msg['142'] || options.senderLocationID), SOHCHAR);
    }

    headermsgarr.push('34=' + outgoingSeqNum, SOHCHAR);

    headermsgarr.push('52=' + timeStamp, SOHCHAR);

    if(msg['369'] !== undefined){
        headermsgarr.push('369=' + msg['369'], SOHCHAR);
    }
    
    for (const [tag, item] of Object.entries(msg)) {
        if (headerFields[tag] !== true) {
            if (Array.isArray(item)) {
                bodymsgarr.push(tag, '=', item.length, SOHCHAR)
                for (const group of item) {
                    if (fixRepeatingGroups[tag]) {
                        fixRepeatingGroups[tag].forEach(x => {
                            bodymsgarr.push(x, '=', group[x], SOHCHAR)
                        })
                    }
                    else {
                        throw (new Error('Schema definition for the group is not defined.'))
                    }
                }
            } else {
                bodymsgarr.push(tag, '=', item, SOHCHAR)
            }
        }
    }

    const headermsg = headermsgarr.join('');
    const bodymsg = bodymsgarr.join('');

    const outmsgarr: Array<unknown> = [];
    outmsgarr.push('8=', msg['8'] || fixVersion, SOHCHAR);
    outmsgarr.push('9=', (headermsg.length + bodymsg.length), SOHCHAR);
    outmsgarr.push(headermsg);
    outmsgarr.push(bodymsg);

    let outmsg = outmsgarr.join('');

    outmsg += '10=' + checksum(outmsg) + SOHCHAR;

    return outmsg;
}

function convertToKeyvals(msg: string): Array<[any, unknown]> {
    const keyvals: Array<[any, unknown]> = []
    let cursor = 0

    while (cursor < msg.length) {
        let i = cursor
        let attrLength = 0
        let key: any | undefined
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
                if (!isNaN(nr)) {
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

export function convertToJSON(msg: string): Record<any, unknown> {
    const fix: Record<any, unknown> = {}
    const msgKeyvals = convertToKeyvals(msg)

    let i = 0;
    while (i < msgKeyvals.length) {
        const [key, value] = msgKeyvals[i]
        const repeatingGroup = fixRepeatingGroups[key]
        if (repeatingGroup === undefined) {
            const nr = Number(value)
            fix[resolveKey(key)] = !isNaN(nr) ? nr : value
            i++
        } else {
            const nr = Number(value)
            if (!isNaN(nr)) {
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
    repeatinGroup: Array<any>,
    nr: number,
    msgKeyvals: Array<[any, unknown]>,
): {
    readonly length: number;
    readonly repeatingGroup: Array<Record<any, unknown>>;
} {
    const response: {
        length: number;
        repeatingGroup: Array<Record<any, unknown>>;
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
                group[msgKeyvals[k][0]] = msgKeyvals[k][1]
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
    repeatingGroup: Array<any>,
    nr: number,
    keyvalPairs: Array<Array<any>>,
): {
    readonly length: number;
    readonly repeatingGroup: Array<Record<any, unknown>>;
} {
    const response: {
        length: number;
        repeatingGroup: Array<Record<any, unknown>>;
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
