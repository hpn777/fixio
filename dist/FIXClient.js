"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FIXClient = exports.fixutil = void 0;
const tslib_1 = require("tslib");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const net_1 = require("net");
const tls_1 = require("tls");
const fixutils_1 = require("./fixutils");
const FIXSession_1 = require("./handlers/FIXSession");
const FrameDecoder_1 = require("./handlers/FrameDecoder");
exports.fixutil = tslib_1.__importStar(require("./fixutils"));
class FIXClient {
    constructor(fixVersion, senderCompID, targetCompID, opt) {
        this.connect$ = new rxjs_1.Subject;
        this.logon$ = new rxjs_1.Subject;
        this.logoff$ = new rxjs_1.Subject;
        this.fixIn$ = new rxjs_1.Subject();
        this.dataIn$ = new rxjs_1.Subject();
        this.jsonIn$ = new rxjs_1.Subject();
        this.fixOut$ = new rxjs_1.Subject();
        this.dataOut$ = new rxjs_1.Subject();
        this.jsonOut$ = new rxjs_1.Subject();
        this.end$ = new rxjs_1.Subject;
        this.close$ = new rxjs_1.Subject;
        this.error$ = new rxjs_1.Subject;
        this.logon = (logonmsg) => this.#fixSession.logon(logonmsg);
        this.logoff = (logoffReason) => this.#fixSession.logoff(logoffReason);
        this.resetFIXSession = (clearHistory) => this.#fixSession.resetFIXSession(clearHistory);
        this.send = (fix) => {
            if (this.connection) {
                this.#fixSession.send(fix);
            }
        };
        this.reconnect = () => this.connect(this.#port, this.#host, true);
        this.connect = (port, host, isReconnect, connectionListener) => {
            this.#host = host;
            this.#port = port;
            const socket = this.#ssl ? new tls_1.TLSSocket() : new net_1.Socket();
            this.connection = socket.connect({ port, host }, connectionListener);
            if (!isReconnect) {
                rxjs_1.fromEvent(this.#fixSession, 'logon').subscribe(this.logon$);
                rxjs_1.fromEvent(this.#fixSession, 'logoff').subscribe(this.logoff$);
                rxjs_1.fromEvent(this.#fixSession, 'dataOut').subscribe(this.dataOut$);
                const fixOut$ = rxjs_1.fromEvent(this.#fixSession, 'fixOut').pipe(operators_1.share());
                fixOut$.subscribe(this.fixOut$);
                fixOut$.pipe(operators_1.map(fixutils_1.convertToJSON)).subscribe(this.jsonOut$);
            }
            rxjs_1.fromEvent(this.connection, 'connect').subscribe(this.connect$);
            rxjs_1.fromEvent(this.connection, 'error').subscribe(this.error$);
            rxjs_1.fromEvent(this.connection, 'end').subscribe(this.end$);
            rxjs_1.fromEvent(this.connection, 'close').subscribe(this.close$);
            const fixIn$ = rxjs_1.fromEvent(this.connection, 'data').pipe(operators_1.mergeMap((raw) => this.#frameDecoder.decode(raw)), operators_1.catchError((ex) => {
                this.connection?.emit('error', ex);
                return rxjs_1.NEVER;
            }), operators_1.share());
            fixIn$.subscribe(this.fixIn$);
            const dataIn$ = fixIn$.pipe(operators_1.map((msg) => this.#fixSession.decode(msg)), operators_1.catchError((ex) => {
                this.connection?.emit('error', ex);
                return rxjs_1.NEVER;
            }), operators_1.share());
            dataIn$.subscribe(this.dataIn$);
            fixIn$.pipe(operators_1.map(fixutils_1.convertToJSON)).subscribe(this.jsonIn$);
        };
        this.#fixSession = new FIXSession_1.FIXSession(this, false, {
            ...opt,
            senderCompID,
            targetCompID,
            fixVersion,
        });
        this.#frameDecoder = new FrameDecoder_1.FrameDecoder();
        this.close$.subscribe(() => {
            setTimeout(() => {
                try {
                    this.reconnect();
                }
                catch {
                }
            }, 5000);
        });
        if (opt?.autologon ?? true) {
            this.connect$.subscribe(() => {
                this.logon();
            });
        }
    }
    #fixSession;
    #frameDecoder;
    #ssl;
    #port;
    #host;
}
exports.FIXClient = FIXClient;
//# sourceMappingURL=FIXClient.js.map