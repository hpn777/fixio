import * as fixSchema from './resources/fixSchema'

let repeatingGroups = fixSchema.repeatingGroups
let keyvals = fixSchema.keyvals

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
    [keyvals.SenderLocationID]: true,
    [keyvals.LastMsgSeqNumProcessed]: true
}

export let SOHCHAR = String.fromCharCode(1);

export function setFixSchema(fixGroups: Record<string, string[]>, fixKeyvals: any): void {
  repeatingGroups = fixGroups
  keyvals = fixKeyvals
}

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

/**
 * Converts object fields to **known** FIX tags. 
 * Usefull before {@link convertMapToFIX} or {@link convertToFIX} or sending to fix server via {@link FIXClient}
 * 
 * @param instance - POJO, with human-readable field names
 * @returns key-value pairs, where key is a FIX tag. 
 * If object field name was unknown - returns this field as it was
 */
export function convertFieldsToFixTags(instance: object): Record<any, unknown> {
    const resultMap = new Map<any, unknown>();
    for (const [field, value] of Object.entries(instance)) {
        let tag: number | null = null

        try {
            tag = keyvals[field as keyof typeof keyvals];
            if (tag) resultMap.set(tag, value)
        } catch (e) {
            // nothing
        }

        if (!tag) {
            // if no tag found - put as is
            resultMap.set(field, value)
        }
    }

    let result = Object.fromEntries(resultMap);
    return result
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

let grupToFix = (tag: string, item:any, bodymsgarr: Array<unknown>) => {
    bodymsgarr.push(tag, '=', item.length, SOHCHAR)
    for (const group of item) {
        if (repeatingGroups[tag]) {
            repeatingGroups[tag].forEach(x => {
                if (Array.isArray(group[x])) {
                    grupToFix(x, group[x], bodymsgarr)
                } else if(group[x] !== undefined){
                    bodymsgarr.push(x, '=', group[x], SOHCHAR)
                }
            })
        }
        else {
            throw (new Error('Schema definition for the group is not defined.'))
        }
    }
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

    headermsgarr.push(keyvals.MsgType, '=', msg[keyvals.MsgType], SOHCHAR);

    headermsgarr.push(keyvals.SenderCompID, '=', msg[keyvals.SenderCompID] || senderCompID, SOHCHAR);

    headermsgarr.push(keyvals.TargetCompID, '=', msg[keyvals.TargetCompID] || targetCompID, SOHCHAR);

    if (options.appVerID) {
        headermsgarr.push(keyvals.ApplVerID, '=', msg[keyvals.ApplVerID] || options.appVerID, SOHCHAR);
    }

    if (options.senderSubID) {
        headermsgarr.push(keyvals.SenderSubID, '=', msg[keyvals.SenderSubID] || options.senderSubID, SOHCHAR);
    }

    if (options.targetSubID) {
        headermsgarr.push(keyvals.TargetSubID, '=', msg[keyvals.TargetSubID] || options.targetSubID, SOHCHAR);
    }
    if (options.senderLocationID) {
        headermsgarr.push(keyvals.SenderLocationID, '=', msg[keyvals.SenderLocationID] || options.senderLocationID, SOHCHAR);
    }

    headermsgarr.push(keyvals.MsgSeqNum, '=', outgoingSeqNum, SOHCHAR);

    headermsgarr.push(keyvals.SendingTime, '=', timeStamp, SOHCHAR);

    if(msg[keyvals.LastMsgSeqNumProcessed] !== undefined){
        headermsgarr.push(keyvals.LastMsgSeqNumProcessed, '=', msg[keyvals.LastMsgSeqNumProcessed], SOHCHAR);
    }

    

    for (const [tag, item] of Object.entries(msg)) {
        if (headerFields[tag] !== true) {
            if (Array.isArray(item)) {
                grupToFix(tag, item, bodymsgarr)
            } else {
                bodymsgarr.push(tag, '=', item, SOHCHAR)
            }
        }
    }

    const headermsg = headermsgarr.join('');
    const bodymsg = bodymsgarr.join('');

    const outmsgarr: Array<unknown> = [];
    outmsgarr.push(keyvals.BeginString, '=', msg[keyvals.BeginString] || fixVersion, SOHCHAR);
    outmsgarr.push(keyvals.BodyLength, '=', (headermsg.length + bodymsg.length), SOHCHAR);
    outmsgarr.push(headermsg);
    outmsgarr.push(bodymsg);

    let outmsg = outmsgarr.join('');

    outmsg += '10=' + checksum(outmsg) + SOHCHAR;

    return outmsg;
}

function convertToKeyvals(msg: string, soh = SOHCHAR): Array<[any, unknown]> {
    const keyvals: Array<[any, unknown]> = []
    let cursor = 0

    while (cursor < msg.length) {
        let i = cursor
        let attrLength = 0
        let key: any | undefined
        let value: unknown
        while (true) {
            if (key === undefined && msg[i] === '=') {
                key = msg.substr(cursor, attrLength) as any
                attrLength = 0
                cursor = i + 1
            }
            else if (msg[i] === soh || msg[i] === undefined) {
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
    const msgKeyvals = convertToKeyvals(msg)
    let i = 0;
    while (i < msgKeyvals.length) {
        const pair = msgKeyvals[i]
        const repeatinGroup = repeatingGroups[pair[0]]
        if (!repeatinGroup) {
            fix[pair[0] as unknown as number] = pair[1]
            i++
        } else {
            const nr = Number(pair[1])
            if (!isNaN(nr)) {
                const response = repeatingGroupToMap(repeatinGroup, nr, msgKeyvals.slice(i + 1));
                fix[pair[0] as unknown as number] = response.repeatingGroup
                i += (1 + response.length)
            } else {
                throw new Error('Repeating Group: "' + pair.join('=') + '" is invalid')
            }
        }
    }

    return fix;
}

export function convertToJSON(msg: string): Record<any, unknown> {
    const fix: Record<any, unknown> = {}
    const msgKeyvals = convertToKeyvals(msg)
    let i = 0;
    while (i < msgKeyvals.length) {
        const [key, value] = msgKeyvals[i]
        const repeatingGroup = repeatingGroups[key]
        if (repeatingGroup === undefined) {
            const nr = Number(value)
            fix[keyvals[key]] = !isNaN(nr) ? nr : value
            i++
        } else {
            const nr = Number(value)
            if (!isNaN(nr)) {
                const response = repeatingGroupToJSON(repeatingGroup, nr, msgKeyvals.slice(i + 1))
                fix[keyvals[key]] = response.repeatingGroup
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
        let index =0
        while (true) {
            if(k >= msgKeyvals.length) break
            const pair = msgKeyvals[k]
            if (repeatinGroup.indexOf(msgKeyvals[k][0]) === -1 || (repeatinGroup[0] === msgKeyvals[k][0] && index !== 0)) {
                break;
            } else {
                const repeatinGroup = repeatingGroups[pair[0]]
                if (!repeatinGroup) {
                    group[pair[0] as unknown as number] = pair[1]
                    ++k
                } else {
                    const nr = Number(pair[1])
                    if (!isNaN(nr)) {
                        const response = repeatingGroupToMap(repeatinGroup, nr, msgKeyvals.slice(k + 1));
                        group[pair[0]] = response.repeatingGroup
                        k += (1 + response.length)
                    } else {
                        throw new Error('Repeating Group: "' + pair.join('=') + '" is invalid')
                    }
                }

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
        length: 0,
    }

    for (let i = 0, k = 0; i < nr; i++) {
        const group: (typeof response)['repeatingGroup'][number] = {}
        let index = 0

        while (true) {
            if(k >= msgKeyvals.length) break
            const pair = msgKeyvals[k]
            if (repeatingGroup.indexOf(msgKeyvals[k][0]) === -1 || (repeatingGroup[0] === msgKeyvals[k][0] && index !== 0)) {
                break;
            } else {
                const repeatinGroup = repeatingGroups[pair[0]]
                if (!repeatinGroup) {
                    group[keyvals[pair[0]]] = pair[1]
                    ++k
                } else {
                    const nr = Number(pair[1])
                    if (!isNaN(nr)) {
                        const response = repeatingGroupToJSON(repeatinGroup, nr, msgKeyvals.slice(k + 1));
                        group[pair[0] as unknown as number] = response.repeatingGroup
                        k += (1 + response.length)
                    } else {
                        throw new Error('Repeating Group: "' + pair.join('=') + '" is invalid')
                    }
                }

                ++index
            }
        }

        response.repeatingGroup.push(group)
        response.length = k
    }

    return response
}
