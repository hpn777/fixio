import { Subject, fromEvent, NEVER } from 'rxjs'
import { tap, map, share, catchError, mergeMap } from 'rxjs/operators'
import { TcpNetConnectOpts, createServer } from 'net'
import { convertToJSON } from './fixutils'
import { FrameDecoder } from './handlers/FrameDecoder'
import { FIXSession, FIXSessionOptions, FIXConnection } from './handlers/FIXSession'

export * as fixutil from './fixutils'

export type SessionHolder =
    & FIXConnection
    & Pick<FIXSession, 'send' | 'resetFIXSession'>

export type FIXServerOptions =
    & FIXSessionOptions
    & Pick<TcpNetConnectOpts, 'host' | 'port'>

export class FIXServer {
    public readonly port: FIXServerOptions['port']
    public readonly host: FIXServerOptions['host']
    public readonly options: FIXServerOptions
    public readonly fixSessions: Partial<Record<string, SessionHolder>> = {}
    public readonly connect$ = new Subject
    public readonly logon$ = new Subject<string>()
    public readonly logoff$ = new Subject
    public readonly fixIn$ = new Subject<string>()
    public readonly dataIn$ = new Subject<{ readonly msg: ReturnType<FIXSession['decode']>, readonly senderId: keyof FIXServer['fixSessions'] }>()
    public readonly jsonIn$ = new Subject<{ readonly msg: ReturnType<typeof convertToJSON>, readonly senderId: keyof FIXServer['fixSessions'] }>()
    public readonly fixOut$ = new Subject<string>()
    public readonly dataOut$ = new Subject
    public readonly jsonOut$ = new Subject<{ readonly msg: ReturnType<typeof convertToJSON>, readonly senderId: keyof FIXServer['fixSessions'] }>()
    public readonly end$ = new Subject<keyof FIXServer['fixSessions']>()
    public readonly close$ = new Subject<keyof FIXServer['fixSessions']>()
    public readonly error$ = new Subject<{ readonly error: unknown, readonly senderId: keyof FIXServer['fixSessions'] }>()

    public readonly server = createServer((connection) => {
        let fixSession: FIXSession
        const sessionHolder: SessionHolder = {
            connection,
            send: (msg, replay) => fixSession.send(msg, replay),
            resetFIXSession: (newSession) => fixSession.resetFIXSession(newSession),
        }
        fixSession = new FIXSession(sessionHolder, true, this.options)
        const frameDecoder = new FrameDecoder()
        let senderId: keyof FIXServer['fixSessions'];

        fromEvent<string>(fixSession, 'logon').pipe(
            tap((x) => {
                senderId = x
                this.fixSessions[x] = sessionHolder
            }),
        ).subscribe(this.logon$)

        fromEvent(fixSession, 'logoff').pipe(
            tap(() => {
                delete this.fixSessions[senderId]
            }),
        ).subscribe(this.logoff$)

        fromEvent(fixSession, 'dataOut').subscribe(this.dataOut$)

        const fixOut$ = fromEvent<string>(fixSession, 'fixOut').pipe(
            share(),
        )
        fixOut$.subscribe(this.fixOut$)

        fixOut$.pipe(
            map((msg) => ({ msg: convertToJSON(msg), senderId })),
        ).subscribe(this.jsonOut$ as any)

        fromEvent(connection, 'end').pipe(
            tap(() => {
                delete this.fixSessions[senderId]
            }),
            map(() => senderId),
        ).subscribe(this.end$)

        fromEvent(connection, 'close').pipe(
            tap(() => {
                delete this.fixSessions[senderId]
            }),
            map(() => senderId),
        ).subscribe(this.close$)

        fromEvent(connection, 'error').pipe(
            map((error) => ({ error, senderId })),
        ).subscribe(this.error$)

        const fixIn$ = fromEvent<any>(connection, 'data').pipe(
            mergeMap((raw: Buffer) => frameDecoder.decode(raw)),
            share(),
        )
        fixIn$.subscribe(this.fixIn$)

        fixIn$.pipe(
            map((msg) => {
                return ({ msg: convertToJSON(msg), senderId })
            }),
            catchError((error: unknown) => {
                connection.emit('error', error)
                return NEVER
            }),
        ).subscribe(this.jsonIn$)

        fixIn$.pipe(
            map((msg) => ({ msg: fixSession.decode(msg), senderId })),
            catchError((error: unknown) => {
                connection.emit('error', error)
                return NEVER
            }),
        ).subscribe(this.dataIn$)
    })

    public readonly listen = (callback?: () => void) => {
        this.server.listen(this.port, this.host, callback)
    }

    public readonly send = (targetId: keyof FIXServer['fixSessions'], ...args: Parameters<FIXSession['send']>) => {
        return this.fixSessions[targetId]?.send(...args)
    }

    public readonly resetFIXSession = (targetId: keyof FIXServer['fixSessions'], ...args: Parameters<FIXSession['resetFIXSession']>) => {
        return this.fixSessions[targetId]?.resetFIXSession(...args)
    }

    constructor(opt: FIXServerOptions) {
        this.port = opt.port
        this.host = opt.host
        this.options = opt
    }
}
