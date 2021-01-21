import type { Subject } from 'rxjs'
import type { FIXSessionClient, FIXSessionOptions } from './handlers/FIXSession'

export interface FIXServerOptions extends FIXSessionOptions {
    readonly host: unknown;
    readonly port: unknown;
}

export interface FIXSessionHolder extends FIXSessionClient {
    readonly send: (fix: unknown) => void;
    readonly resetFIXSession: () => void;
}

export interface FIXData {
    senderId: string;
    msg: Record<string, string>;
}

export class FIXServer {
    constructor(opt: FIXServerOptions);

    public readonly fixSessions: Record<string, FIXSessionHolder>;
    public readonly connect$: Subject<unknown>;
    public readonly logon$: Subject<unknown>;
    public readonly logoff$: Subject<unknown>;
    public readonly fixIn$: Subject<unknown>;
    public readonly dataIn$: Subject<FIXData>;
    public readonly jsonIn$: Subject<unknown>;
    public readonly fixOut$: Subject<unknown>;
    public readonly dataOut$: Subject<unknown>;
    public readonly jsonOut$: Subject<unknown>;
    public readonly end$: Subject<unknown>;
    public readonly close$: Subject<unknown>;
    public readonly error$: Subject<unknown>;

    public readonly listen: (callback: () => void) => void;
    public readonly send: (targetId: string, fix: unknown) => void;
    public readonly resetFIXSession: (targetId: string) => void;
}
