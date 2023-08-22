import { Subject, fromEvent, NEVER } from 'rxjs'
import { catchError, mergeMap, map, share, mergeAll } from 'rxjs/operators'
import { Socket, TcpSocketConnectOpts } from 'net'
import { TLSSocket } from 'tls'
import { convertToJSON } from './fixutils'
import { FIXConnection, FIXSession, FIXSessionOptions } from './handlers/FIXSession'
import { FrameDecoder } from './handlers/FrameDecoder'

export * as fixutil from './fixutils'

export interface FIXClientOptions extends Omit<FIXSessionOptions, 'senderCompID' | 'targetCompID' | 'fixVersion'> {
    readonly ssl?: boolean;
    readonly autologon?: boolean;
}

export class FIXClient implements FIXConnection {
    #fixSession: FIXSession

    #frameDecoder: FrameDecoder

    #ssl: FIXClientOptions['ssl']

    public readonly connect$ = new Subject
    public readonly logon$ = new Subject
    public readonly logoff$ = new Subject
    public readonly fixIn$ = new Subject<string>()
    public readonly dataIn$ = new Subject<Record<number, unknown>>()
    // public readonly jsonIn$ = new Subject<ReturnType<typeof convertToJSON>>()
    public readonly fixOut$ = new Subject<string>()
    public readonly dataOut$ = new Subject<Record<number, unknown>>()
    // public readonly jsonOut$ = new Subject<ReturnType<typeof convertToJSON>>()
    public readonly end$ = new Subject
    public readonly close$ = new Subject
    public readonly error$ = new Subject

    public connection: Socket | TLSSocket | undefined

    public readonly logon: FIXSession['logon'] = (logonmsg) => this.#fixSession.logon(logonmsg)

    public readonly logoff: FIXSession['logoff'] = (logoffReason) => this.#fixSession.logoff(logoffReason)

    public readonly resetFIXSession: FIXSession['resetFIXSession'] = (clearHistory) => this.#fixSession.resetFIXSession(clearHistory)

    public readonly send = (fix: Record<any, unknown>) => {
        if (this.connection) {
            this.#fixSession.send(fix)
        }
    }

    #port?: TcpSocketConnectOpts['port']

    #host?: TcpSocketConnectOpts['host']

    public readonly reconnect = () => this.connect(this.#port!, this.#host!, true)

    public readonly connect = (
        port: TcpSocketConnectOpts['port'],
        host: TcpSocketConnectOpts['host'],
        isReconnect?: boolean,
        connectionListener?: () => void,
    ) => {
        this.#host = host
        this.#port = port

        // @ts-ignore TLSSocket expects a socket instance, but it was not provided in the previous version
        const socket = this.#ssl ? new TLSSocket() : new Socket()
        this.connection = socket.connect({ port, host }, connectionListener)
        if (!isReconnect) {
            fromEvent(this.#fixSession, 'logon').subscribe(this.logon$)

            fromEvent(this.#fixSession, 'logoff').subscribe(this.logoff$)

            fromEvent<any>(this.#fixSession, 'dataOut').subscribe(this.dataOut$)

            const fixOut$ = fromEvent<string>(this.#fixSession, 'fixOut').pipe(share())
            fixOut$.subscribe(this.fixOut$)

            // fixOut$.pipe(map(convertToJSON)).subscribe(this.jsonOut$)
        }

        fromEvent(this.connection, 'connect').subscribe(this.connect$)

        fromEvent(this.connection, 'error').subscribe(this.error$)

        fromEvent(this.connection, 'end').subscribe(this.end$)

        fromEvent(this.connection, 'close').subscribe(this.close$)

        const fixIn$ = fromEvent<any>(this.connection, 'data').pipe(
            mergeMap((raw: Buffer) => this.#frameDecoder.decode(raw)),
            catchError((ex) => {
                this.connection?.emit('error', ex)
                return NEVER
            }),
            share(),
        )
        fixIn$.subscribe(this.fixIn$)

        const dataIn$ = fixIn$.pipe(
            map((msg) => this.#fixSession.decode(msg)),
            catchError((ex) => {
                this.connection?.emit('error', ex)
                return NEVER
            }),
            mergeAll(),
            share(),
        )
        dataIn$.subscribe(this.dataIn$)

        // fixIn$.pipe(map(convertToJSON)).subscribe(this.jsonIn$)
    }

    constructor(
        fixVersion: Required<FIXSessionOptions>['fixVersion'],
        senderCompID: Required<FIXSessionOptions>['senderCompID'],
        targetCompID: Required<FIXSessionOptions>['targetCompID'],
        opt: FIXClientOptions,
    ) {
        this.#fixSession = new FIXSession(
            this,
            false,
            {
                ...opt,
                senderCompID,
                targetCompID,
                fixVersion,
            },
        )
        this.#frameDecoder = new FrameDecoder()

        this.close$.subscribe(() => {
            setTimeout(
                () => {
                    try {
                        this.reconnect()
                    } catch {
                        // pass
                    }
                },
                5000,
            )
        })

        if (opt?.autologon ?? true) {
            this.connect$.subscribe(() => {
                this.logon()
            })
        }
    }
}
