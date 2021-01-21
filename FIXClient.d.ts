import type { Subject } from 'rxjs';
import type { FIXSessionClient, FIXSessionOptions } from './handlers/FIXSession';
import type { Socket } from 'net';

export interface FIXClientOptions extends Omit<FIXSessionOptions, 'fixVersion' | 'senderCompID' | 'targetCompID'> {
    readonly ssl?: boolean;
    readonly autologon?: boolean;
}

export class FIXClient implements FIXSessionClient {
    constructor(fixVersion: string, senderCompID: string, targetCompID: string, opt?: FIXClientOptions);

    public readonly connection: Socket;
    public readonly connect$: Subject<unknown>;
    public readonly logon$: Subject<unknown>;
    public readonly logoff$: Subject<unknown>;
    public readonly fixIn$: Subject<unknown>;
    public readonly dataIn$: Subject<unknown>;
    public readonly jsonIn$: Subject<unknown>;
    public readonly fixOut$: Subject<unknown>;
    public readonly dataOut$: Subject<unknown>;
    public readonly jsonOut$: Subject<unknown>;
    public readonly end$: Subject<unknown>;
    public readonly close$: Subject<unknown>;
    public readonly error$: Subject<unknown>;

    public readonly send: (fix: unknown) => void;
    public readonly connect: (port: number, host: string, isReconnect?: boolean) => void;
    public readonly logon: (logonmsg?: unknown) => void;
    public readonly logoff: (logoffReason?: unknown) => void;
    public readonly resetFIXSession: (clearHistory?: unknown) => void;
}
