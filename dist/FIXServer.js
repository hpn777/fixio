"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FIXServer = void 0;
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const net_1 = require("net");
const fixutils_1 = require("./fixutils");
const FrameDecoder_1 = require("./handlers/FrameDecoder");
const FIXSession_1 = require("./handlers/FIXSession");
class FIXServer {
    port;
    host;
    options;
    fixSessions = {};
    connect$ = new rxjs_1.Subject;
    logon$ = new rxjs_1.Subject();
    logoff$ = new rxjs_1.Subject;
    fixIn$ = new rxjs_1.Subject();
    dataIn$ = new rxjs_1.Subject();
    jsonIn$ = new rxjs_1.Subject();
    fixOut$ = new rxjs_1.Subject();
    dataOut$ = new rxjs_1.Subject;
    end$ = new rxjs_1.Subject();
    close$ = new rxjs_1.Subject();
    error$ = new rxjs_1.Subject();
    server = (0, net_1.createServer)((connection) => {
        let fixSession;
        const sessionHolder = {
            connection,
            send: (msg, replay) => fixSession.send(msg, replay),
            resetFIXSession: (newSession) => fixSession.resetFIXSession(newSession),
        };
        fixSession = new FIXSession_1.FIXSession(sessionHolder, true, this.options);
        const frameDecoder = new FrameDecoder_1.FrameDecoder();
        let senderId;
        (0, rxjs_1.fromEvent)(fixSession, 'logon').pipe((0, operators_1.tap)((x) => {
            senderId = x;
            this.fixSessions[x] = sessionHolder;
        })).subscribe(this.logon$);
        (0, rxjs_1.fromEvent)(fixSession, 'logoff').pipe((0, operators_1.tap)(() => {
            delete this.fixSessions[senderId];
        })).subscribe(this.logoff$);
        (0, rxjs_1.fromEvent)(fixSession, 'dataOut').subscribe(this.dataOut$);
        const fixOut$ = (0, rxjs_1.fromEvent)(fixSession, 'fixOut').pipe((0, operators_1.share)());
        fixOut$.subscribe(this.fixOut$);
        (0, rxjs_1.fromEvent)(connection, 'end').pipe((0, operators_1.tap)(() => {
            delete this.fixSessions[senderId];
        }), (0, operators_1.map)(() => senderId)).subscribe(this.end$);
        (0, rxjs_1.fromEvent)(connection, 'close').pipe((0, operators_1.tap)(() => {
            delete this.fixSessions[senderId];
        }), (0, operators_1.map)(() => senderId)).subscribe(this.close$);
        (0, rxjs_1.fromEvent)(connection, 'error').pipe((0, operators_1.map)((error) => ({ error, senderId }))).subscribe(this.error$);
        const fixIn$ = (0, rxjs_1.fromEvent)(connection, 'data').pipe((0, operators_1.mergeMap)((raw) => frameDecoder.decode(raw)), (0, operators_1.share)());
        fixIn$.subscribe(this.fixIn$);
        fixIn$.pipe((0, operators_1.map)((msg) => {
            return ({ msg: (0, fixutils_1.convertToJSON)(msg), senderId });
        }), (0, operators_1.catchError)((error) => {
            connection.emit('error', error);
            return rxjs_1.NEVER;
        })).subscribe(this.jsonIn$);
        fixIn$.pipe((0, operators_1.map)(async (msg) => ({ msg: await fixSession.decode(msg), senderId })), (0, operators_1.catchError)((error) => {
            connection.emit('error', error);
            return rxjs_1.NEVER;
        }), (0, operators_1.mergeAll)()).subscribe(this.dataIn$);
    });
    listen = (callback) => {
        this.server.listen(this.port, this.host, callback);
    };
    send = (targetId, ...args) => {
        return this.fixSessions[targetId]?.send(...args);
    };
    resetFIXSession = (targetId, ...args) => {
        return this.fixSessions[targetId]?.resetFIXSession(...args);
    };
    constructor(opt) {
        this.port = opt.port;
        this.host = opt.host;
        this.options = opt;
    }
}
exports.FIXServer = FIXServer;
//# sourceMappingURL=FIXServer.js.map