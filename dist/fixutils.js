"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertToJSON = exports.convertToMap = exports.convertToFIX = exports.convertMapToFIX = exports.checksum = exports.getUTCTimeStamp = exports.setSOHCHAR = exports.SOHCHAR = void 0;
const fixSchema_1 = require("./resources/fixSchema");
const headerFields = {
    [fixSchema_1.keyvals.BeginString]: true,
    [fixSchema_1.keyvals.BodyLength]: true,
    [fixSchema_1.keyvals.MsgType]: true,
    [fixSchema_1.keyvals.CheckSum]: true,
    [fixSchema_1.keyvals.SendingTime]: true,
    [fixSchema_1.keyvals.SenderCompID]: true,
    [fixSchema_1.keyvals.SenderSubID]: true,
    [fixSchema_1.keyvals.TargetCompID]: true,
    [fixSchema_1.keyvals.MsgSeqNum]: true,
    [fixSchema_1.keyvals.ApplVerID]: true,
    [fixSchema_1.keyvals.SenderLocationID]: true,
    [fixSchema_1.keyvals.LastMsgSeqNumProcessed]: true
};
exports.SOHCHAR = String.fromCharCode(1);
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
function convertMapToFIX(map) {
    return convertToFIX(map, map[fixSchema_1.keyvals.BeginString], map[fixSchema_1.keyvals.SendingTime], map[fixSchema_1.keyvals.SenderCompID], map[fixSchema_1.keyvals.TargetCompID], map[fixSchema_1.keyvals.MsgSeqNum], {
        senderSubID: map[fixSchema_1.keyvals.SenderSubID],
    });
}
exports.convertMapToFIX = convertMapToFIX;
let grupToFix = (tag, item, bodymsgarr) => {
    bodymsgarr.push(tag, '=', item.length, exports.SOHCHAR);
    for (const group of item) {
        if (fixSchema_1.repeatingGroups[tag]) {
            fixSchema_1.repeatingGroups[tag].forEach(x => {
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
    delete msg[fixSchema_1.keyvals.BodyLength];
    delete msg[fixSchema_1.keyvals.CheckSum];
    const headermsgarr = [];
    const bodymsgarr = [];
    headermsgarr.push(fixSchema_1.keyvals.MsgType, '=', msg[fixSchema_1.keyvals.MsgType], exports.SOHCHAR);
    headermsgarr.push(fixSchema_1.keyvals.SenderCompID, '=', msg[fixSchema_1.keyvals.SenderCompID] || senderCompID, exports.SOHCHAR);
    headermsgarr.push(fixSchema_1.keyvals.TargetCompID, '=', msg[fixSchema_1.keyvals.TargetCompID] || targetCompID, exports.SOHCHAR);
    if (options.appVerID) {
        headermsgarr.push(fixSchema_1.keyvals.ApplVerID, '=', msg[fixSchema_1.keyvals.ApplVerID] || options.appVerID, exports.SOHCHAR);
    }
    if (options.senderSubID) {
        headermsgarr.push(fixSchema_1.keyvals.SenderSubID, '=', msg[fixSchema_1.keyvals.SenderSubID] || options.senderSubID, exports.SOHCHAR);
    }
    if (options.targetSubID) {
        headermsgarr.push(fixSchema_1.keyvals.TargetSubID, '=', msg[fixSchema_1.keyvals.TargetSubID] || options.targetSubID, exports.SOHCHAR);
    }
    if (options.senderLocationID) {
        headermsgarr.push(fixSchema_1.keyvals.SenderLocationID, '=', msg[fixSchema_1.keyvals.SenderLocationID] || options.senderLocationID, exports.SOHCHAR);
    }
    headermsgarr.push(fixSchema_1.keyvals.MsgSeqNum, '=', outgoingSeqNum, exports.SOHCHAR);
    headermsgarr.push(fixSchema_1.keyvals.SendingTime, '=', timeStamp, exports.SOHCHAR);
    if (msg[fixSchema_1.keyvals.LastMsgSeqNumProcessed] !== undefined) {
        headermsgarr.push(fixSchema_1.keyvals.LastMsgSeqNumProcessed, '=', msg[fixSchema_1.keyvals.LastMsgSeqNumProcessed], exports.SOHCHAR);
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
    outmsgarr.push(fixSchema_1.keyvals.BeginString, '=', msg[fixSchema_1.keyvals.BeginString] || fixVersion, exports.SOHCHAR);
    outmsgarr.push(fixSchema_1.keyvals.BodyLength, '=', (headermsg.length + bodymsg.length), exports.SOHCHAR);
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
        const repeatinGroup = fixSchema_1.repeatingGroups[pair[0]];
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
        const repeatingGroup = fixSchema_1.repeatingGroups[key];
        if (repeatingGroup === undefined) {
            const nr = Number(value);
            fix[fixSchema_1.keyvals[key]] = !isNaN(nr) ? nr : value;
            i++;
        }
        else {
            const nr = Number(value);
            if (!isNaN(nr)) {
                const response = repeatingGroupToJSON(repeatingGroup, nr, msgKeyvals.slice(i + 1));
                fix[fixSchema_1.keyvals[key]] = response.repeatingGroup;
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
                const repeatinGroup = fixSchema_1.repeatingGroups[pair[0]];
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
                const repeatinGroup = fixSchema_1.repeatingGroups[pair[0]];
                if (!repeatinGroup) {
                    group[fixSchema_1.keyvals[pair[0]]] = pair[1];
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