import * as fixSchema from './resources/fixSchema';
import type { FIXMessage, FIXKeyValuePair, FIXNumericMessage, FIXConversionOptions, RepeatingGroupResult, FIXKeyvals, RepeatingGroups } from './types';

let repeatingGroups = fixSchema.repeatingGroups
let keyvals = fixSchema.keyvals

const headerFields: Record<number, boolean> = {
    [keyvals.BeginString]: true,
    [keyvals.BodyLength]: true,
    [keyvals.MsgType]: true,
    [keyvals.CheckSum]: true,
    [keyvals.SendingTime]: true,
    [keyvals.SenderCompID]: true,
    [keyvals.SenderSubID]: true,
    [keyvals.TargetCompID]: true,
    [keyvals.OnBehalfOfCompID]: true,
    [keyvals.DeliverToCompID]: true,
    [keyvals.SecureDataLen]: true,
    [keyvals.SecureData]: true,
    [keyvals.TargetSubID]: true,
    [keyvals.TargetLocationID]: true,
    [keyvals.OnBehalfOfSubID]: true,
    [keyvals.OnBehalfOfLocationID]: true,
    [keyvals.DeliverToSubID]: true,
    [keyvals.DeliverToLocationID]: true,
    [keyvals.PossDupFlag]: true,
    [keyvals.PossResend]: true,
    [keyvals.OrigSendingTime]: true,
    [keyvals.XmlDataLen]: true,
    [keyvals.XmlData]: true,
    [keyvals.MessageEncoding]: true,
    [keyvals.MsgSeqNum]: true,
    [keyvals.ApplVerID]: true,
    [keyvals.SenderLocationID]: true,
    [keyvals.LastMsgSeqNumProcessed]: true
}

export let SOHCHAR = String.fromCharCode(1);

// Cache for field name to tag conversions (Phase 1 optimization)
const fieldToTagCache = new Map<string, number | null>();

export function setFixSchema(fixGroups: RepeatingGroups, fixKeyvals: FIXKeyvals): void {
  repeatingGroups = fixGroups
  keyvals = fixKeyvals
  // Clear cache when schema changes
  fieldToTagCache.clear();
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
    // Optimized: Direct character code access (fastest for small strings)
    let chksm = 0;
    for (let i = 0; i < str.length; i++) {
        chksm += str.charCodeAt(i);
    }

    chksm = chksm % 256;

    // Phase 2: Optimize string formatting with padStart
    return chksm.toString().padStart(3, '0');
}

/**
 * Converts object fields to **known** FIX tags. 
 * Usefull before {@link convertMapToFIX} or {@link convertToFIX} or sending to fix server via {@link FIXClient}
 * 
 * @param instance - POJO, with human-readable field names
 * @returns key-value pairs, where key is a FIX tag. 
 * If object field name was unknown - returns this field as it was
 */
export function convertFieldsToFixTags(instance: object): FIXMessage {
    const resultMap = new Map<number | string, unknown>();
    for (const [field, value] of Object.entries(instance)) {
        // Check cache first (Phase 1 optimization)
        let tag: number | null = fieldToTagCache.get(field) ?? null;
        
        if (tag === null && !fieldToTagCache.has(field)) {
            // Not in cache, perform lookup
            try {
                tag = keyvals[field as keyof typeof keyvals];
                // Cache the result (even if null)
                fieldToTagCache.set(field, tag ?? null);
                if (tag) resultMap.set(tag, value)
            } catch (e) {
                // Cache as not found
                fieldToTagCache.set(field, null);
            }
        } else if (tag) {
            resultMap.set(tag, value)
        }

        if (!tag) {
            // if no tag found - put as is
            resultMap.set(field, value)
        }
    }

    let result = Object.fromEntries(resultMap);
    return result as FIXMessage
}

export function convertMapToFIX(map: Record<number, unknown>) {
    return convertToFIX(
        map as FIXMessage,
        map[keyvals.BeginString],
        map[keyvals.SendingTime],
        map[keyvals.SenderCompID],
        map[keyvals.TargetCompID],
        map[keyvals.MsgSeqNum],
        {
            senderSubID: map[keyvals.SenderSubID] as string | undefined,
        },
    );
}

// Phase 2: Already using array push pattern - optimized
let grupToFix = (tag: string, item: FIXMessage[], bodymsgarr: Array<unknown>) => {
    bodymsgarr.push(tag, '=', item.length, SOHCHAR)
    for (const group of item) {
        if (repeatingGroups[tag]) {
            repeatingGroups[tag].forEach(x => {
                const value = group[x]
                if (Array.isArray(value)) {
                    grupToFix(x, value as FIXMessage[], bodymsgarr)
                } else if(value !== undefined){
                    bodymsgarr.push(x, '=', value, SOHCHAR)
                }
            })
        }
        else {
            throw (new Error('Schema definition for the group is not defined.'))
        }
    }
}

export function convertToFIX(
    msg: FIXMessage,
    fixVersion: unknown,
    timeStamp: unknown,
    senderCompID: unknown,
    targetCompID: unknown,
    outgoingSeqNum: unknown,
    options: FIXConversionOptions,
): string {
    //defensive copy
    delete msg[keyvals.BodyLength]; //bodylength
    delete msg[keyvals.CheckSum]; //checksum

    const headermsgarr: Array<unknown> = [];
    const bodymsgarr: Array<unknown> = [];

    headermsgarr.push(keyvals.MsgType, '=', msg[keyvals.MsgType], SOHCHAR);
    delete msg[keyvals.MsgType]
    
    headermsgarr.push(keyvals.SenderCompID, '=', msg[keyvals.SenderCompID] || senderCompID, SOHCHAR);
    delete msg[keyvals.SenderCompID]
    
    headermsgarr.push(keyvals.TargetCompID, '=', msg[keyvals.TargetCompID] || targetCompID, SOHCHAR);
    delete msg[keyvals.TargetCompID]

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
        const numTag = Number(tag)
        const isBodyTag = headerFields[numTag] !== true
        
        if (Array.isArray(item)) {
            grupToFix(tag, item as FIXMessage[], isBodyTag ? bodymsgarr: headermsgarr)
        } else {
            (isBodyTag ? bodymsgarr : headermsgarr).push(tag, '=', item, SOHCHAR)
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

function convertToKeyvals(msg: string, soh = SOHCHAR): FIXKeyValuePair[] {
    const keyvals: FIXKeyValuePair[] = []
    let cursor = 0

    while (cursor < msg.length) {
        let i = cursor
        let attrLength = 0
        let key: string | undefined
        let value: unknown
        while (true) {
            if (key === undefined && msg[i] === '=') {
                // Phase 1: Use slice instead of substr for better performance
                key = msg.slice(cursor, cursor + attrLength)
                attrLength = 0
                cursor = i + 1
            }
            else if (msg[i] === soh || msg[i] === undefined) {
                // Phase 1: Use slice instead of substr for better performance
                value = msg.slice(cursor, cursor + attrLength - 1)
                cursor = i + 1
                break;
            }
            attrLength++
            i++
        }

        keyvals.push([key as string, value as string])

        if (key === '212') {
            const xmlLength = Number(value) + 5
            const xmlValue = msg.slice(cursor + 4, cursor + xmlLength - 1)
            keyvals.push(['213', xmlValue])
            cursor += xmlLength
        }
    }

    return keyvals
}

export function convertToMap(msg: string): FIXNumericMessage {
    const fix: FIXNumericMessage = {}
    const msgKeyvals = convertToKeyvals(msg)
    let i = 0;
    while (i < msgKeyvals.length) {
        const pair = msgKeyvals[i]
        const repeatinGroup = repeatingGroups[pair[0]]
        if (!repeatinGroup) {
            fix[pair[0] as unknown as number] = pair[1] as any
            i++
        } else {
            const nr = Number(pair[1])
            if (!isNaN(nr)) {
                const response = repeatingGroupToMap(repeatinGroup, nr, msgKeyvals.slice(i + 1));
                fix[pair[0] as unknown as number] = response.repeatingGroup as any
                i += (1 + response.length)
            } else {
                throw new Error('Repeating Group: "' + pair.join('=') + '" is invalid')
            }
        }
    }

    return fix;
}

export function convertToJSON(msg: string): FIXMessage {
    const fix: FIXMessage = {}
    const msgKeyvals = convertToKeyvals(msg)
    let i = 0;
    while (i < msgKeyvals.length) {
        const [key, value] = msgKeyvals[i]
        const repeatingGroup = repeatingGroups[key]
        if (repeatingGroup === undefined) {
            const nr = Number(value)
            fix[keyvals[key as any]] = !isNaN(nr) ? nr : value
            i++
        } else {
            const nr = Number(value)
            if (!isNaN(nr)) {
                const response = repeatingGroupToJSON(repeatingGroup, nr, msgKeyvals.slice(i + 1))
                fix[keyvals[key as any]] = response.repeatingGroup as any
                i += (1 + response.length)
            } else {
                throw new Error(`Repeating Group: "${key} = ${value}" is invalid`)
            }
        }
    }

    return fix;
}

function repeatingGroupToMap(
    repeatinGroup: string[],
    nr: number,
    msgKeyvals: FIXKeyValuePair[],
): RepeatingGroupResult {
    // Phase 1: Create Set for O(1) lookup instead of O(n) indexOf
    const groupFieldsSet = new Set(repeatinGroup);
    const firstField = repeatinGroup[0];
    
    const response: {
        length: number;
        repeatingGroup: Array<FIXNumericMessage>;
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
            const fieldKey = String(msgKeyvals[k][0]);
            // Phase 1: Use Set.has() instead of indexOf for better performance
            if (!groupFieldsSet.has(fieldKey) || (fieldKey === firstField && index !== 0)) {
                break;
            } else {
                const repeatinGroup = repeatingGroups[pair[0]]
                if (!repeatinGroup) {
                    group[pair[0] as unknown as number] = pair[1] as any
                    ++k
                } else {
                    const nr = Number(pair[1])
                    if (!isNaN(nr)) {
                        const response = repeatingGroupToMap(repeatinGroup, nr, msgKeyvals.slice(k + 1));
                        (group as any)[pair[0]] = response.repeatingGroup
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
    repeatingGroup: string[],
    nr: number,
    msgKeyvals: FIXKeyValuePair[],
): RepeatingGroupResult {
    // Phase 1: Create Set for O(1) lookup instead of O(n) indexOf
    const groupFieldsSet = new Set(repeatingGroup);
    const firstField = repeatingGroup[0];
    
    const response: {
        length: number;
        repeatingGroup: Array<FIXMessage>;
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
            const fieldKey = String(msgKeyvals[k][0]);
            // Phase 1: Use Set.has() instead of indexOf for better performance
            if (!groupFieldsSet.has(fieldKey) || (fieldKey === firstField && index !== 0)) {
                break;
            } else {
                const repeatinGroup = repeatingGroups[pair[0]]
                if (!repeatinGroup) {
                    (group as any)[keyvals[pair[0] as any]] = pair[1]
                    ++k
                } else {
                    const nr = Number(pair[1])
                    if (!isNaN(nr)) {
                        const response = repeatingGroupToJSON(repeatinGroup, nr, msgKeyvals.slice(k + 1));
                        group[pair[0] as unknown as number] = response.repeatingGroup as any
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
