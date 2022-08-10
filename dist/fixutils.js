"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertToJSON = exports.convertToMap = exports.convertToFIX = exports.convertMapToFIX = exports.checksum = exports.getUTCTimeStamp = exports.setSOHCHAR = exports.SOHCHAR = void 0;
const fixSchema_1 = require("./resources/fixSchema");
const fixtagnums_1 = require("./resources/fixtagnums");
const headerFields = {
    [fixtagnums_1.keyvals.BeginString]: true,
    [fixtagnums_1.keyvals.BodyLength]: true,
    [fixtagnums_1.keyvals.MsgType]: true,
    [fixtagnums_1.keyvals.CheckSum]: true,
    [fixtagnums_1.keyvals.SendingTime]: true,
    [fixtagnums_1.keyvals.SenderCompID]: true,
    [fixtagnums_1.keyvals.SenderSubID]: true,
    [fixtagnums_1.keyvals.TargetCompID]: true,
    [fixtagnums_1.keyvals.MsgSeqNum]: true,
    [fixtagnums_1.keyvals.ApplVerID]: true,
    [fixtagnums_1.keyvals.SenderLocationID]: true,
    [fixtagnums_1.keyvals.LastMsgSeqNumProcessed]: true
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
    return convertToFIX(map, map[fixtagnums_1.keyvals.BeginString], map[fixtagnums_1.keyvals.SendingTime], map[fixtagnums_1.keyvals.SenderCompID], map[fixtagnums_1.keyvals.TargetCompID], map[fixtagnums_1.keyvals.MsgSeqNum], {
        senderSubID: map[fixtagnums_1.keyvals.SenderSubID],
    });
}
exports.convertMapToFIX = convertMapToFIX;
function convertToFIX(msg, fixVersion, timeStamp, senderCompID, targetCompID, outgoingSeqNum, options) {
    delete msg[fixtagnums_1.keyvals.BodyLength];
    delete msg[fixtagnums_1.keyvals.CheckSum];
    const headermsgarr = [];
    const bodymsgarr = [];
    headermsgarr.push(fixtagnums_1.keyvals.MsgType, '=', msg[fixtagnums_1.keyvals.MsgType], exports.SOHCHAR);
    headermsgarr.push(fixtagnums_1.keyvals.SenderCompID, '=', msg[fixtagnums_1.keyvals.SenderCompID] || senderCompID, exports.SOHCHAR);
    headermsgarr.push(fixtagnums_1.keyvals.TargetCompID, '=', msg[fixtagnums_1.keyvals.TargetCompID] || targetCompID, exports.SOHCHAR);
    if (options.appVerID) {
        headermsgarr.push(fixtagnums_1.keyvals.ApplVerID, '=', msg[fixtagnums_1.keyvals.ApplVerID] || options.appVerID, exports.SOHCHAR);
    }
    if (options.senderSubID) {
        headermsgarr.push(fixtagnums_1.keyvals.SenderSubID, '=', msg[fixtagnums_1.keyvals.SenderSubID] || options.senderSubID, exports.SOHCHAR);
    }
    if (options.targetSubID) {
        headermsgarr.push(fixtagnums_1.keyvals.SenderSubID, '=', msg[fixtagnums_1.keyvals.SenderSubID] || options.targetSubID, exports.SOHCHAR);
    }
    if (options.senderLocationID) {
        headermsgarr.push(fixtagnums_1.keyvals.SenderLocationID, '=', msg[fixtagnums_1.keyvals.SenderLocationID] || options.senderLocationID, exports.SOHCHAR);
    }
    headermsgarr.push(fixtagnums_1.keyvals.MsgSeqNum, '=', outgoingSeqNum, exports.SOHCHAR);
    headermsgarr.push(fixtagnums_1.keyvals.SendingTime, '=', timeStamp, exports.SOHCHAR);
    if (msg[fixtagnums_1.keyvals.LastMsgSeqNumProcessed] !== undefined) {
        headermsgarr.push(fixtagnums_1.keyvals.LastMsgSeqNumProcessed, '=', msg[fixtagnums_1.keyvals.LastMsgSeqNumProcessed], exports.SOHCHAR);
    }
    for (const [tag, item] of Object.entries(msg)) {
        if (headerFields[tag] !== true) {
            if (Array.isArray(item)) {
                bodymsgarr.push(tag, '=', item.length, exports.SOHCHAR);
                for (const group of item) {
                    if (fixSchema_1.fixRepeatingGroups[tag]) {
                        fixSchema_1.fixRepeatingGroups[tag].forEach(x => {
                            bodymsgarr.push(x, '=', group[x], exports.SOHCHAR);
                        });
                    }
                    else {
                        throw (new Error('Schema definition for the group is not defined.'));
                    }
                }
            }
            else {
                bodymsgarr.push(tag, '=', item, exports.SOHCHAR);
            }
        }
    }
    const headermsg = headermsgarr.join('');
    const bodymsg = bodymsgarr.join('');
    const outmsgarr = [];
    outmsgarr.push(fixtagnums_1.keyvals.BeginString, '=', msg['8'] || fixVersion, exports.SOHCHAR);
    outmsgarr.push(fixtagnums_1.keyvals.BodyLength, '=', (headermsg.length + bodymsg.length), exports.SOHCHAR);
    outmsgarr.push(headermsg);
    outmsgarr.push(bodymsg);
    let outmsg = outmsgarr.join('');
    outmsg += '10=' + checksum(outmsg) + exports.SOHCHAR;
    return outmsg;
}
exports.convertToFIX = convertToFIX;
function convertToKeyvals(msg) {
    const keyvals = [];
    let cursor = 0;
    while (cursor < msg.length) {
        let i = cursor;
        let attrLength = 0;
        let key;
        let value;
        while (true) {
            if (msg[i] === '=') {
                key = msg.substr(cursor, attrLength);
                attrLength = 0;
                cursor = i + 1;
            }
            else if (msg[i] === exports.SOHCHAR) {
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
    const keyvals = convertToKeyvals(msg);
    let i = 0;
    while (i < keyvals.length) {
        const pair = keyvals[i];
        if (pair.length === 2) {
            const repeatinGroup = fixSchema_1.fixRepeatingGroups[pair[0]];
            if (!repeatinGroup) {
                fix[pair[0]] = pair[1];
                i++;
            }
            else {
                const nr = Number(pair[1]);
                if (!isNaN(nr)) {
                    const response = repeatingGroupToMap(repeatinGroup, nr, keyvals.slice(i + 1));
                    fix[pair[0]] = response.repeatingGroup;
                    i += (1 + response.length);
                }
                else {
                    throw new Error('Repeating Group: "' + pair.join('=') + '" is invalid');
                }
            }
        }
        else
            i++;
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
        const repeatingGroup = fixSchema_1.fixRepeatingGroups[key];
        if (repeatingGroup === undefined) {
            const nr = Number(value);
            fix[(0, fixtagnums_1.resolveKey)(key)] = !isNaN(nr) ? nr : value;
            i++;
        }
        else {
            const nr = Number(value);
            if (!isNaN(nr)) {
                const response = repeatingGroupToJSON(repeatingGroup, nr, msgKeyvals.slice(i + 1));
                fix[(0, fixtagnums_1.resolveKey)(key)] = response.repeatingGroup;
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
            if (repeatinGroup.indexOf(msgKeyvals[k][0]) === -1 || (repeatinGroup[0] === msgKeyvals[k][0] && index !== 0)) {
                break;
            }
            else {
                group[msgKeyvals[k][0]] = msgKeyvals[k][1];
                ++k;
                ++index;
            }
        }
        response.repeatingGroup.push(group);
        response.length = k;
    }
    return response;
}
function repeatingGroupToJSON(repeatingGroup, nr, keyvalPairs) {
    const response = {
        repeatingGroup: [],
        length: 0,
    };
    for (let i = 0, k = 0; i < nr; i++) {
        const group = {};
        let index = 0;
        while (true) {
            if (repeatingGroup.indexOf(keyvalPairs[k][0]) === -1 || (repeatingGroup[0] === keyvalPairs[k][0] && index !== 0)) {
                break;
            }
            else {
                group[(0, fixtagnums_1.resolveKey)(keyvalPairs[k][0])] = keyvalPairs[k][1];
                ++k;
                ++index;
            }
        }
        response.repeatingGroup.push(group);
        response.length = k;
    }
    return response;
}
//# sourceMappingURL=fixutils.js.map