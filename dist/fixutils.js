"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertToJSON = exports.convertToMap = exports.convertToFIX = exports.convertMapToFIX = exports.convertFieldsToFixTags = exports.checksum = exports.getUTCTimeStamp = exports.setSOHCHAR = exports.setFixSchema = exports.SOHCHAR = void 0;
const tslib_1 = require("tslib");
const fixSchema = tslib_1.__importStar(require("./resources/fixSchema"));
let repeatingGroups = fixSchema.repeatingGroups;
let keyvals = fixSchema.keyvals;
const headerFields = {
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
};
exports.SOHCHAR = String.fromCharCode(1);
function setFixSchema(fixGroups, fixKeyvals) {
    repeatingGroups = fixGroups;
    keyvals = fixKeyvals;
}
exports.setFixSchema = setFixSchema;
function setSOHCHAR(char) {
    exports.SOHCHAR = char;
}
exports.setSOHCHAR = setSOHCHAR;
function getUTCTimeStamp(date = new Date()) {
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
    ].join('');
}
exports.getUTCTimeStamp = getUTCTimeStamp;
function checksum(str) {
    let chksm = 0;
    for (let i = 0; i < str.length; i++) {
        chksm += str.charCodeAt(i);
    }
    chksm = chksm % 256;
    let checksumstr = '';
    if (chksm < 10) {
        checksumstr = '00' + (chksm + '');
    }
    else if (chksm >= 10 && chksm < 100) {
        checksumstr = '0' + (chksm + '');
    }
    else {
        checksumstr = '' + (chksm + '');
    }
    return checksumstr;
}
exports.checksum = checksum;
function convertFieldsToFixTags(instance) {
    const resultMap = new Map();
    for (const [field, value] of Object.entries(instance)) {
        let tag = null;
        try {
            tag = keyvals[field];
            if (tag)
                resultMap.set(tag, value);
        }
        catch (e) {
        }
        if (!tag) {
            resultMap.set(field, value);
        }
    }
    let result = Object.fromEntries(resultMap);
    return result;
}
exports.convertFieldsToFixTags = convertFieldsToFixTags;
function convertMapToFIX(map) {
    return convertToFIX(map, map[keyvals.BeginString], map[keyvals.SendingTime], map[keyvals.SenderCompID], map[keyvals.TargetCompID], map[keyvals.MsgSeqNum], {
        senderSubID: map[keyvals.SenderSubID],
    });
}
exports.convertMapToFIX = convertMapToFIX;
let grupToFix = (tag, item, bodymsgarr) => {
    bodymsgarr.push(tag, '=', item.length, exports.SOHCHAR);
    for (const group of item) {
        if (repeatingGroups[tag]) {
            repeatingGroups[tag].forEach(x => {
                if (Array.isArray(group[x])) {
                    grupToFix(x, group[x], bodymsgarr);
                }
                else if (group[x] !== undefined) {
                    bodymsgarr.push(x, '=', group[x], exports.SOHCHAR);
                }
            });
        }
        else {
            throw (new Error('Schema definition for the group is not defined.'));
        }
    }
};
function convertToFIX(msg, fixVersion, timeStamp, senderCompID, targetCompID, outgoingSeqNum, options) {
    delete msg[keyvals.BodyLength];
    delete msg[keyvals.CheckSum];
    const headermsgarr = [];
    const bodymsgarr = [];
    headermsgarr.push(keyvals.MsgType, '=', msg[keyvals.MsgType], exports.SOHCHAR);
    headermsgarr.push(keyvals.SenderCompID, '=', msg[keyvals.SenderCompID] || senderCompID, exports.SOHCHAR);
    headermsgarr.push(keyvals.TargetCompID, '=', msg[keyvals.TargetCompID] || targetCompID, exports.SOHCHAR);
    if (options.appVerID) {
        headermsgarr.push(keyvals.ApplVerID, '=', msg[keyvals.ApplVerID] || options.appVerID, exports.SOHCHAR);
    }
    if (options.senderSubID) {
        headermsgarr.push(keyvals.SenderSubID, '=', msg[keyvals.SenderSubID] || options.senderSubID, exports.SOHCHAR);
    }
    if (options.targetSubID) {
        headermsgarr.push(keyvals.TargetSubID, '=', msg[keyvals.TargetSubID] || options.targetSubID, exports.SOHCHAR);
    }
    if (options.senderLocationID) {
        headermsgarr.push(keyvals.SenderLocationID, '=', msg[keyvals.SenderLocationID] || options.senderLocationID, exports.SOHCHAR);
    }
    headermsgarr.push(keyvals.MsgSeqNum, '=', outgoingSeqNum, exports.SOHCHAR);
    headermsgarr.push(keyvals.SendingTime, '=', timeStamp, exports.SOHCHAR);
    if (msg[keyvals.LastMsgSeqNumProcessed] !== undefined) {
        headermsgarr.push(keyvals.LastMsgSeqNumProcessed, '=', msg[keyvals.LastMsgSeqNumProcessed], exports.SOHCHAR);
    }
    for (const [tag, item] of Object.entries(msg)) {
        if (headerFields[tag] !== true) {
            if (Array.isArray(item)) {
                grupToFix(tag, item, bodymsgarr);
            }
            else {
                bodymsgarr.push(tag, '=', item, exports.SOHCHAR);
            }
        }
    }
    const headermsg = headermsgarr.join('');
    const bodymsg = bodymsgarr.join('');
    const outmsgarr = [];
    outmsgarr.push(keyvals.BeginString, '=', msg[keyvals.BeginString] || fixVersion, exports.SOHCHAR);
    outmsgarr.push(keyvals.BodyLength, '=', (headermsg.length + bodymsg.length), exports.SOHCHAR);
    outmsgarr.push(headermsg);
    outmsgarr.push(bodymsg);
    let outmsg = outmsgarr.join('');
    outmsg += '10=' + checksum(outmsg) + exports.SOHCHAR;
    return outmsg;
}
exports.convertToFIX = convertToFIX;
function convertToKeyvals(msg, soh = exports.SOHCHAR) {
    const keyvals = [];
    let cursor = 0;
    while (cursor < msg.length) {
        let i = cursor;
        let attrLength = 0;
        let key;
        let value;
        while (true) {
            if (key === undefined && msg[i] === '=') {
                key = msg.substr(cursor, attrLength);
                attrLength = 0;
                cursor = i + 1;
            }
            else if (msg[i] === soh || msg[i] === undefined) {
                value = msg.substr(cursor, attrLength - 1);
                cursor = i + 1;
                break;
            }
            attrLength++;
            i++;
        }
        keyvals.push([key, value]);
        if (key === '212') {
            const xmlPair = ['213'];
            const xmlLength = Number(value) + 5;
            xmlPair[1] = msg.slice(cursor + 4, cursor + xmlLength - 1);
            keyvals.push(xmlPair);
            cursor += xmlLength;
        }
    }
    return keyvals;
}
function convertToMap(msg) {
    const fix = {};
    const msgKeyvals = convertToKeyvals(msg);
    let i = 0;
    while (i < msgKeyvals.length) {
        const pair = msgKeyvals[i];
        const repeatinGroup = repeatingGroups[pair[0]];
        if (!repeatinGroup) {
            fix[pair[0]] = pair[1];
            i++;
        }
        else {
            const nr = Number(pair[1]);
            if (!isNaN(nr)) {
                const response = repeatingGroupToMap(repeatinGroup, nr, msgKeyvals.slice(i + 1));
                fix[pair[0]] = response.repeatingGroup;
                i += (1 + response.length);
            }
            else {
                throw new Error('Repeating Group: "' + pair.join('=') + '" is invalid');
            }
        }
    }
    return fix;
}
exports.convertToMap = convertToMap;
function convertToJSON(msg) {
    const fix = {};
    const msgKeyvals = convertToKeyvals(msg);
    let i = 0;
    while (i < msgKeyvals.length) {
        const [key, value] = msgKeyvals[i];
        const repeatingGroup = repeatingGroups[key];
        if (repeatingGroup === undefined) {
            const nr = Number(value);
            fix[keyvals[key]] = !isNaN(nr) ? nr : value;
            i++;
        }
        else {
            const nr = Number(value);
            if (!isNaN(nr)) {
                const response = repeatingGroupToJSON(repeatingGroup, nr, msgKeyvals.slice(i + 1));
                fix[keyvals[key]] = response.repeatingGroup;
                i += (1 + response.length);
            }
            else {
                throw new Error(`Repeating Group: "${key} = ${value}" is invalid`);
            }
        }
    }
    return fix;
}
exports.convertToJSON = convertToJSON;
function repeatingGroupToMap(repeatinGroup, nr, msgKeyvals) {
    const response = {
        repeatingGroup: [],
        length: 0
    };
    for (let i = 0, k = 0; i < nr; i++) {
        const group = {};
        let index = 0;
        while (true) {
            if (k >= msgKeyvals.length)
                break;
            const pair = msgKeyvals[k];
            if (repeatinGroup.indexOf(msgKeyvals[k][0]) === -1 || (repeatinGroup[0] === msgKeyvals[k][0] && index !== 0)) {
                break;
            }
            else {
                const repeatinGroup = repeatingGroups[pair[0]];
                if (!repeatinGroup) {
                    group[pair[0]] = pair[1];
                    ++k;
                }
                else {
                    const nr = Number(pair[1]);
                    if (!isNaN(nr)) {
                        const response = repeatingGroupToMap(repeatinGroup, nr, msgKeyvals.slice(k + 1));
                        group[pair[0]] = response.repeatingGroup;
                        k += (1 + response.length);
                    }
                    else {
                        throw new Error('Repeating Group: "' + pair.join('=') + '" is invalid');
                    }
                }
                ++index;
            }
        }
        response.repeatingGroup.push(group);
        response.length = k;
    }
    return response;
}
function repeatingGroupToJSON(repeatingGroup, nr, msgKeyvals) {
    const response = {
        repeatingGroup: [],
        length: 0,
    };
    for (let i = 0, k = 0; i < nr; i++) {
        const group = {};
        let index = 0;
        while (true) {
            if (k >= msgKeyvals.length)
                break;
            const pair = msgKeyvals[k];
            if (repeatingGroup.indexOf(msgKeyvals[k][0]) === -1 || (repeatingGroup[0] === msgKeyvals[k][0] && index !== 0)) {
                break;
            }
            else {
                const repeatinGroup = repeatingGroups[pair[0]];
                if (!repeatinGroup) {
                    group[keyvals[pair[0]]] = pair[1];
                    ++k;
                }
                else {
                    const nr = Number(pair[1]);
                    if (!isNaN(nr)) {
                        const response = repeatingGroupToJSON(repeatinGroup, nr, msgKeyvals.slice(k + 1));
                        group[pair[0]] = response.repeatingGroup;
                        k += (1 + response.length);
                    }
                    else {
                        throw new Error('Repeating Group: "' + pair.join('=') + '" is invalid');
                    }
                }
                ++index;
            }
        }
        response.repeatingGroup.push(group);
        response.length = k;
    }
    return response;
}
//# sourceMappingURL=fixutils.js.map