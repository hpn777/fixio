"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FIXServer = exports.fixutil = void 0;
const tslib_1 = require("tslib");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const net_1 = require("net");
const fixutils_1 = require("./fixutils");
const FrameDecoder_1 = require("./handlers/FrameDecoder");
const FIXSession_1 = require("./handlers/FIXSession");
exports.fixutil = tslib_1.__importStar(require("./fixutils"));
class FIXServer {
    constructor(opt) {
        this.fixSessions = {};
        this.connect$ = new rxjs_1.Subject;
        this.logon$ = new rxjs_1.Subject();
        this.logoff$ = new rxjs_1.Subject;
        this.fixIn$ = new rxjs_1.Subject();
        this.dataIn$ = new rxjs_1.Subject();
        this.jsonIn$ = new rxjs_1.Subject();
        this.fixOut$ = new rxjs_1.Subject();
        this.dataOut$ = new rxjs_1.Subject;
        this.jsonOut$ = new rxjs_1.Subject();
        this.end$ = new rxjs_1.Subject();
        this.close$ = new rxjs_1.Subject();
        this.error$ = new rxjs_1.Subject();
        this.server = net_1.createServer((connection) => {
            let fixSession;
            const sessionHolder = {
                connection,
                send: (msg, replay) => fixSession.send(msg, replay),
                resetFIXSession: (newSession) => fixSession.resetFIXSession(newSession),
            };
            fixSession = new FIXSession_1.FIXSession(sessionHolder, true, this.options);
            const frameDecoder = new FrameDecoder_1.FrameDecoder();
            let senderId;
            rxjs_1.fromEvent(fixSession, 'logon').pipe(operators_1.tap((x) => {
                senderId = x;
                this.fixSessions[x] = sessionHolder;
            })).subscribe(this.logon$);
            rxjs_1.fromEvent(fixSession, 'logoff').pipe(operators_1.tap(() => {
                delete this.fixSessions[senderId];
            })).subscribe(this.logoff$);
            rxjs_1.fromEvent(fixSession, 'dataOut').subscribe(this.dataOut$);
            const fixOut$ = rxjs_1.fromEvent(fixSession, 'fixOut').pipe(operators_1.share());
            fixOut$.subscribe(this.fixOut$);
            fixOut$.pipe(operators_1.map((msg) => ({ msg: fixutils_1.convertToJSON(msg), senderId }))).subscribe(this.jsonOut$);
            rxjs_1.fromEvent(connection, 'end').pipe(operators_1.tap(() => {
                delete this.fixSessions[senderId];
            }), operators_1.map(() => senderId)).subscribe(this.end$);
            rxjs_1.fromEvent(connection, 'close').pipe(operators_1.tap(() => {
                delete this.fixSessions[senderId];
            }), operators_1.map(() => senderId)).subscribe(this.close$);
            rxjs_1.fromEvent(connection, 'error').pipe(operators_1.map((error) => ({ error, senderId }))).subscribe(this.error$);
            const fixIn$ = rxjs_1.fromEvent(connection, 'data').pipe(operators_1.mergeMap((raw) => frameDecoder.decode(raw)), operators_1.share());
            fixIn$.subscribe(this.fixIn$);
            fixIn$.pipe(operators_1.map((msg) => {
                return ({ msg: fixutils_1.convertToJSON(msg), senderId });
            }), operators_1.catchError((error) => {
                connection.emit('error', error);
                return rxjs_1.NEVER;
            })).subscribe(this.jsonIn$);
            fixIn$.pipe(operators_1.map((msg) => ({ msg: fixSession.decode(msg), senderId })), operators_1.catchError((error) => {
                connection.emit('error', error);
                return rxjs_1.NEVER;
            })).subscribe(this.dataIn$);
        });
        this.listen = (callback) => {
            this.server.listen(this.port, this.host, callback);
        };
        this.send = (targetId, ...args) => {
            return this.fixSessions[targetId]?.send(...args);
        };
        this.resetFIXSession = (targetId, ...args) => {
            return this.fixSessions[targetId]?.resetFIXSession(...args);
        };
        this.port = opt.port;
        this.host = opt.host;
        this.options = opt;
    }
}
exports.FIXServer = FIXServer;
//# sourceMappingURL=FIXServer.js.map