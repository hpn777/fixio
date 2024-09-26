"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FIXClient = void 0;
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const net_1 = require("net");
const tls_1 = require("tls");
const FIXSession_1 = require("./handlers/FIXSession");
const FrameDecoder_1 = require("./handlers/FrameDecoder");
class FIXClient {
    #fixSession;
    #frameDecoder;
    #ssl;
    connect$ = new rxjs_1.Subject;
    logon$ = new rxjs_1.Subject;
    logoff$ = new rxjs_1.Subject;
    fixIn$ = new rxjs_1.Subject();
    dataIn$ = new rxjs_1.Subject();
    fixOut$ = new rxjs_1.Subject();
    dataOut$ = new rxjs_1.Subject();
    end$ = new rxjs_1.Subject;
    close$ = new rxjs_1.Subject;
    error$ = new rxjs_1.Subject;
    connection;
    logon = (logonmsg) => this.#fixSession.logon(logonmsg);
    logoff = (logoffReason) => this.#fixSession.logoff(logoffReason);
    resetFIXSession = (clearHistory) => this.#fixSession.resetFIXSession(clearHistory);
    send = (fix) => {
        if (this.connection) {
            this.#fixSession.send(fix);
        }
    };
    #port;
    #host;
    reconnect = () => this.connect(this.#port, this.#host, true);
    connect = (port, host, isReconnect, connectionListener) => {
        this.#host = host;
        this.#port = port;
        const socket = this.#ssl ? new tls_1.TLSSocket() : new net_1.Socket();
        this.connection = socket.connect({ port, host }, connectionListener);
        if (!isReconnect) {
            (0, rxjs_1.fromEvent)(this.#fixSession, 'logon').subscribe(this.logon$);
            (0, rxjs_1.fromEvent)(this.#fixSession, 'logoff').subscribe(this.logoff$);
            (0, rxjs_1.fromEvent)(this.#fixSession, 'dataOut').subscribe(this.dataOut$);
            const fixOut$ = (0, rxjs_1.fromEvent)(this.#fixSession, 'fixOut').pipe((0, operators_1.share)());
            fixOut$.subscribe(this.fixOut$);
        }
        (0, rxjs_1.fromEvent)(this.connection, 'connect').subscribe(this.connect$);
        (0, rxjs_1.fromEvent)(this.connection, 'error').subscribe(this.error$);
        (0, rxjs_1.fromEvent)(this.connection, 'end').subscribe(this.end$);
        (0, rxjs_1.fromEvent)(this.connection, 'close').subscribe(this.close$);
        const fixIn$ = (0, rxjs_1.fromEvent)(this.connection, 'data').pipe((0, operators_1.mergeMap)((raw) => this.#frameDecoder.decode(raw)), (0, operators_1.catchError)((ex) => {
            this.connection?.emit('error', ex);
            return rxjs_1.NEVER;
        }), (0, operators_1.share)());
        fixIn$.subscribe(this.fixIn$);
        const dataIn$ = fixIn$.pipe((0, operators_1.map)((msg) => this.#fixSession.decode(msg)), (0, operators_1.catchError)((ex) => {
            this.connection?.emit('error', ex);
            return rxjs_1.NEVER;
        }), (0, operators_1.mergeAll)(), (0, operators_1.share)());
        dataIn$.subscribe(this.dataIn$);
    };
    constructor(fixVersion, senderCompID, targetCompID, opt) {
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
}
exports.FIXClient = FIXClient;
//# sourceMappingURL=FIXClient.js.map