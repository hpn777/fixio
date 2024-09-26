"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FIXSession = void 0;
const fs_1 = require("fs");
const readline_1 = require("readline");
const events_1 = require("events");
const fixutils_1 = require("../fixutils");
const fixSchema_1 = require("../resources/fixSchema");
const sessions = {};
class FIXSession extends events_1.EventEmitter {
    #fixClient;
    #isAcceptor;
    #session = {
        incomingSeqNum: 1,
        outgoingSeqNum: 1,
    };
    #timeOfLastIncoming = new Date().getTime();
    #heartbeatIntervalID;
    #timeOfLastOutgoing = new Date().getTime();
    #timeOfLastOutgoingHeartbeat = new Date().getTime();
    #testRequestID = 1;
    #isResendRequested = false;
    #isLogoutRequested = false;
    decode = async (raw) => {
        this.#timeOfLastIncoming = new Date().getTime();
        const fix = (0, fixutils_1.convertToMap)(raw);
        const msgType = fix[fixSchema_1.keyvals.MsgType];
        if (!this.#session.isLoggedIn && (msgType !== 'A' && msgType !== '5')) {
            const error = '[ERROR] First message must be logon:' + raw;
            throw new Error(error);
        }
        else if (!this.#session.isLoggedIn && msgType === 'A') {
            if (this.#isAcceptor) {
                this.#fixVersion = fix[fixSchema_1.keyvals.BeginString];
                this.#senderCompID = fix[fixSchema_1.keyvals.TargetCompID];
                this.#senderSubID = fix[fixSchema_1.keyvals.SenderSubID];
                this.#targetCompID = fix[fixSchema_1.keyvals.SenderCompID];
                this.#targetSubID = fix[fixSchema_1.keyvals.TargetSubID];
                if (this.#isDuplicateFunc(this.#senderCompID, this.#targetCompID)) {
                    const error = `[ERROR] Session already logged in: ${raw} `;
                    throw new Error(error);
                }
                if (!this.#isAuthenticFunc(fix, this.#fixClient.connection?.remoteAddress)) {
                    const error = `[ERROR] Session not authentic: ${raw} `;
                    throw new Error(error);
                }
                if (this.#resetSeqNumOnReconect) {
                    this.#session = {
                        incomingSeqNum: 1,
                        outgoingSeqNum: 1
                    };
                }
                else {
                    this.#session = await this.retriveSession(this.#senderCompID, this.#targetCompID);
                }
            }
            const heartbeatInMilliSeconds = parseInt(fix[fixSchema_1.keyvals.HeartBtInt] ?? this.#defaultHeartbeatSeconds, 10) * 1000;
            this.#heartbeatIntervalID = setInterval(() => {
                const currentTime = new Date().getTime();
                if (currentTime - this.#timeOfLastOutgoingHeartbeat > heartbeatInMilliSeconds && this.#sendHeartbeats) {
                    this.send({
                        [fixSchema_1.keyvals.MsgType]: '0'
                    });
                    this.#timeOfLastOutgoingHeartbeat = new Date().getTime();
                }
                if (currentTime - this.#timeOfLastIncoming > (heartbeatInMilliSeconds * 1.5) && this.#expectHeartbeats) {
                    this.send({
                        [fixSchema_1.keyvals.MsgType]: '1',
                        [fixSchema_1.keyvals.TestReqID]: this.#testRequestID++
                    });
                }
                if (currentTime - this.#timeOfLastIncoming > heartbeatInMilliSeconds * 2 && this.#expectHeartbeats) {
                    const error = this.#targetCompID + `[ERROR] No heartbeat from counter party in milliseconds ${(heartbeatInMilliSeconds * 1.5)} `;
                    this.#fixClient.connection?.emit('error', error);
                }
            }, heartbeatInMilliSeconds / 2);
            this.#fixClient.connection?.on('close', () => {
                clearInterval(this.#heartbeatIntervalID);
            });
            this.#session.isLoggedIn = true;
            this.emit('logon', this.#targetCompID);
            if (this.#isAcceptor && this.#respondToLogon) {
                this.send(fix);
            }
        }
        const msgSeqNum = Number(fix[fixSchema_1.keyvals.MsgSeqNum]);
        if (msgType !== '4' && msgType !== '5' && fix[fixSchema_1.keyvals.PossDupFlag] !== 'Y') {
            if (msgSeqNum >= this.#requestResendTargetSeqNum) {
                this.#isResendRequested = false;
            }
            if (msgSeqNum < this.#session.incomingSeqNum && !this.#isResendRequested) {
                const error = `[ERROR] Incoming sequence number[${msgSeqNum}]lower than expected[${this.#session.incomingSeqNum}]`;
                this.logoff(error);
                throw new Error(error + ' : ' + raw);
            }
            else if (msgSeqNum > this.#session.incomingSeqNum && (this.#requestResendTargetSeqNum == 0 || this.#requestResendRequestedSeqNum !== this.#requestResendTargetSeqNum)) {
                this.requestResend(this.#session.incomingSeqNum, msgSeqNum);
            }
        }
        if (msgType !== '4' && (msgSeqNum === this.#session.incomingSeqNum || this.#isResendRequested)) {
            this.#session.incomingSeqNum = msgSeqNum + 1;
        }
        switch (msgType) {
            case '1':
                this.send({
                    [fixSchema_1.keyvals.MsgType]: '0',
                    [fixSchema_1.keyvals.TestReqID]: fix[fixSchema_1.keyvals.TestReqID],
                });
                break;
            case '2':
                this.resendMessages(fix[fixSchema_1.keyvals.BeginSeqNo] ? Number(fix[fixSchema_1.keyvals.BeginSeqNo]) : undefined, fix[fixSchema_1.keyvals.EndSeqNo] ? Number(fix[fixSchema_1.keyvals.EndSeqNo]) : undefined);
                break;
            case '4':
                const resetSeqNo = Number(fix[fixSchema_1.keyvals.NewSeqNo]);
                if (!Number.isNaN(resetSeqNo)) {
                    if (resetSeqNo >= this.#session.incomingSeqNum) {
                        if (resetSeqNo > this.#requestResendTargetSeqNum && this.#requestResendRequestedSeqNum !== this.#requestResendTargetSeqNum) {
                            this.#session.incomingSeqNum = this.#requestResendRequestedSeqNum + 1;
                            this.#isResendRequested = false;
                            this.requestResend(this.#session.incomingSeqNum, this.#requestResendTargetSeqNum);
                        }
                        else {
                            this.#session.incomingSeqNum = resetSeqNo;
                        }
                    }
                    else {
                        const error = '[ERROR] Seq-reset may not decrement sequence numbers';
                    }
                }
                else {
                    const error = '[ERROR] Seq-reset has invalid sequence numbers';
                    this.logoff(error);
                    throw new Error(error + ' : ' + raw);
                }
                break;
            case '5':
                if (!this.#isLogoutRequested) {
                    this.send(fix);
                    if (fix[fixSchema_1.keyvals.NextExpectedMsgSeqNum])
                        this.#session.outgoingSeqNum = Number(fix[fixSchema_1.keyvals.NextExpectedMsgSeqNum]);
                }
                setImmediate(() => {
                    this.#fixClient.connection?.destroy();
                });
                this.#session.isLoggedIn = false;
                this.emit('logoff', {
                    senderCompID: this.#senderCompID,
                    targetCompID: this.#targetCompID,
                    logoffReason: fix[fixSchema_1.keyvals.Text],
                });
                break;
        }
        return fix;
    };
    resetFIXSession = async (newSession = {}) => {
        this.#session = await this.retriveSession(this.#senderCompID, this.#targetCompID);
        if (newSession.incomingSeqNum) {
            this.#session.incomingSeqNum = newSession.incomingSeqNum;
        }
        this.#session.isLoggedIn = false;
        try {
            if (newSession.outgoingSeqNum) {
                this.#session.outgoingSeqNum = newSession.outgoingSeqNum;
                (0, fs_1.unlinkSync)(this.#logfilename);
            }
        }
        catch {
        }
    };
    logon = async (logonmsg = {
        [fixSchema_1.keyvals.MsgType]: 'A',
        [fixSchema_1.keyvals.EncryptMethod]: '0',
        [fixSchema_1.keyvals.HeartBtInt]: '10',
    }) => {
        if (this.#resetSeqNumOnReconect) {
            this.#session = {
                incomingSeqNum: 1,
                outgoingSeqNum: 1,
            };
        }
        else {
            this.#session = await this.retriveSession(this.#senderCompID, this.#targetCompID);
        }
        this.send(logonmsg);
    };
    logoff = (logoffReason = 'Graceful close') => {
        this.send({
            [fixSchema_1.keyvals.MsgType]: 5,
            [fixSchema_1.keyvals.Text]: logoffReason,
        });
        this.#session.isLoggedIn = false;
        this.#isLogoutRequested = true;
    };
    send = (immutableMsg, replay) => {
        const msg = { ...immutableMsg };
        if (!replay) {
            msg[fixSchema_1.keyvals.LastMsgSeqNumProcessed] = this.#session.incomingSeqNum - 1;
        }
        const outgoingSeqNum = replay ? msg[fixSchema_1.keyvals.MsgSeqNum] : this.#session.outgoingSeqNum;
        const outmsg = (0, fixutils_1.convertToFIX)(msg, this.#fixVersion, (0, fixutils_1.getUTCTimeStamp)(), this.#senderCompID, this.#targetCompID, outgoingSeqNum, {
            senderSubID: this.#senderSubID,
            targetSubID: this.#targetSubID,
            senderLocationID: this.#senderLocationID,
            appVerID: this.#appVerID
        });
        this.emit('dataOut', msg);
        this.emit('fixOut', outmsg);
        this.#fixClient.connection?.write(outmsg);
        if (!replay) {
            this.#timeOfLastOutgoing = new Date().getTime();
            this.#session.outgoingSeqNum++;
            this.logToFile(outmsg, this.#senderCompID, this.#targetCompID);
        }
    };
    #logfilename;
    #file = null;
    logToFile = (raw, senderCompID, targetCompID) => {
        if (this.#file === null) {
            let fileName = this.#logfilename = `${this.#logFolder}/${senderCompID}-${targetCompID}.log`;
            try {
                (0, fs_1.mkdirSync)(this.#logFolder);
            }
            catch {
            }
            try {
                if (this.#resetSeqNumOnReconect) {
                    (0, fs_1.unlinkSync)(fileName);
                }
            }
            catch {
            }
            this.#file = (0, fs_1.createWriteStream)(fileName, {
                'flags': 'a',
                'mode': 0o666,
            });
            this.#file.on('error', (error) => {
                this.#fixClient.connection?.emit('error', error);
            });
            if (this.#fixClient.connection) {
                this.#fixClient.connection.on('close', () => {
                    this.#file?.close();
                    this.#file = null;
                });
            }
        }
        this.#file.write(raw + '\n');
    };
    #requestResendRequestedSeqNum = 0;
    #requestResendTargetSeqNum = 0;
    requestResend = (start, target) => {
        this.#requestResendTargetSeqNum = target;
        const batchSize = 2000;
        if (this.#isResendRequested === false && start < this.#requestResendTargetSeqNum) {
            this.#isResendRequested = true;
            const send = (from, to = 0) => this.send({
                [fixSchema_1.keyvals.MsgType]: 2,
                [fixSchema_1.keyvals.BeginSeqNo]: from,
                [fixSchema_1.keyvals.EndSeqNo]: to,
            });
            if (target - start <= batchSize) {
                this.#requestResendRequestedSeqNum = this.#requestResendTargetSeqNum = 0;
                send(start);
            }
            else {
                this.#requestResendRequestedSeqNum = start + batchSize;
                send(start, this.#requestResendRequestedSeqNum);
            }
        }
    };
    resendMessages = (BeginSeqNo = 0, EndSeqNo = this.#session.outgoingSeqNum - 1) => {
        if (this.#logfilename) {
            const reader = (0, fs_1.createReadStream)(this.#logfilename, {
                'flags': 'r',
                'encoding': 'binary',
                'mode': 0o666
            });
            const lineReader = (0, readline_1.createInterface)({
                input: reader,
            });
            let fillGapBuffer = [];
            const sendFillGap = () => {
                if (fillGapBuffer.length > 0) {
                    this.send({
                        [fixSchema_1.keyvals.MsgType]: '4',
                        [fixSchema_1.keyvals.OrigSendingTime]: fillGapBuffer[0][fixSchema_1.keyvals.SendingTime],
                        [fixSchema_1.keyvals.GapFillFlag]: 'Y',
                        [fixSchema_1.keyvals.MsgSeqNum]: Number(fillGapBuffer[0][fixSchema_1.keyvals.MsgSeqNum]),
                        [fixSchema_1.keyvals.NewSeqNo]: Number(fillGapBuffer[fillGapBuffer.length - 1][fixSchema_1.keyvals.MsgSeqNum]) + 1,
                    }, true);
                    fillGapBuffer = [];
                }
            };
            lineReader.on('line', (line) => {
                const _fix = (0, fixutils_1.convertToMap)(line);
                const _msgType = `${_fix[fixSchema_1.keyvals.MsgType]}`;
                const _seqNo = Number(_fix[34]);
                if ((BeginSeqNo <= _seqNo) && (EndSeqNo >= _seqNo)) {
                    if (['A', '5', '2', '0', '1', '4'].includes(_msgType)) {
                        fillGapBuffer.push(_fix);
                        if (EndSeqNo === _seqNo) {
                            sendFillGap();
                        }
                    }
                    else {
                        sendFillGap();
                        this.send({
                            ..._fix,
                            [fixSchema_1.keyvals.OrigSendingTime]: _fix[fixSchema_1.keyvals.SendingTime],
                            [fixSchema_1.keyvals.PossDupFlag]: 'Y',
                            [fixSchema_1.keyvals.MsgSeqNum]: _seqNo,
                            [fixSchema_1.keyvals.NewSeqNo]: _seqNo + 1,
                        }, true);
                    }
                }
                else if (EndSeqNo < _seqNo) {
                    sendFillGap();
                    lineReader.removeAllListeners('line');
                    reader.close();
                }
            });
        }
    };
    retriveSession = async (senderCompID, targetCompID) => {
        let fileName = this.#logfilename = `${this.#logFolder}/${senderCompID}-${targetCompID}.log`;
        if ((0, fs_1.existsSync)(fileName)) {
            const reader = (0, fs_1.createReadStream)(fileName, {
                'flags': 'r',
                'encoding': 'binary',
                'mode': 0o666
            });
            const lineReader = (0, readline_1.createInterface)({
                input: reader,
            });
            let incomingSeqNum = 0;
            let outgoingSeqNum = 0;
            for await (const line of lineReader) {
                const _fix = (0, fixutils_1.convertToMap)(line);
                incomingSeqNum = Number(_fix[369]);
                outgoingSeqNum = Number(_fix[34]);
            }
            reader.close();
            return {
                incomingSeqNum: ++incomingSeqNum,
                outgoingSeqNum: ++outgoingSeqNum
            };
        }
        else {
            return {
                incomingSeqNum: 1,
                outgoingSeqNum: 1
            };
        }
    };
    #fixVersion;
    #senderCompID;
    #senderSubID;
    #targetCompID;
    #targetSubID;
    #appVerID;
    #senderLocationID;
    #logFolder;
    #isDuplicateFunc;
    #isAuthenticFunc;
    #resetSeqNumOnReconect;
    #defaultHeartbeatSeconds;
    #sendHeartbeats;
    #expectHeartbeats;
    #respondToLogon;
    #key;
    constructor(fixClient, isAcceptor, options) {
        super();
        this.#fixClient = fixClient;
        this.#isAcceptor = isAcceptor;
        this.#fixVersion = options.fixVersion;
        this.#senderCompID = options.senderCompID;
        this.#senderSubID = options.senderSubID;
        this.#targetCompID = options.targetCompID;
        this.#targetSubID = options.targetSubID;
        this.#senderLocationID = options.senderLocationID;
        this.#logFolder = options.logFolder ?? './storage';
        this.#key = `${this.#senderCompID}-${this.#targetCompID}`;
        this.#isDuplicateFunc = options.isDuplicateFunc ?? ((senderId, targetId) => sessions[`${senderId} -${targetId} `]?.isLoggedIn ?? false);
        this.#isAuthenticFunc = options.isAuthenticFunc ?? (() => true);
        this.#resetSeqNumOnReconect = options.resetSeqNumOnReconect ?? true;
        this.#defaultHeartbeatSeconds = options.defaultHeartbeatSeconds ?? '10';
        this.#sendHeartbeats = options.sendHeartbeats ?? true;
        this.#expectHeartbeats = options.expectHeartbeats ?? true;
        this.#respondToLogon = options.respondToLogon ?? true;
        (0, fixutils_1.setFixSchema)(options.reapeatingGroups ?? fixSchema_1.repeatingGroups, options.keyvals ?? fixSchema_1.keyvals);
    }
}
exports.FIXSession = FIXSession;
//# sourceMappingURL=FIXSession.js.map