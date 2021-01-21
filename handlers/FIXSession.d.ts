import type { Socket } from 'net';

export interface FIXSessionClient {
    readonly connection: Socket;
}

export interface FIXSessionOptions {
    readonly fixVersion?: unknown;
    readonly clearStorage?: unknown;
    readonly senderCompID?: unknown;
    readonly senderSubID?: unknown;
    readonly targetCompID?: unknown;
    readonly targetSubID?: unknown;
    readonly senderLocationID?: unknown;
    readonly logFolder?: unknown;
    readonly fileLogging?: unknown;
    readonly sendHeartbeats?: unknown;
    readonly expectHeartbeats?: unknown;
    readonly respondToLogon?: unknown;
    readonly resetSeqNumOnReconect?: unknown
    readonly isDuplicateFunc?: (senderId: unknown, targetId: unknown) => boolean;
    readonly isAuthenticFunc?: (fix: unknown, remoteAddress: unknown) => boolean;
}

export class FIXSession {
    constructor(fixClient: FIXSessionClient, isAcceptor: boolean, options?: FIXSessionOptions);

    public readonly decode: (raw: unknown) => unknown;
    public readonly logon: (logonmsg?: unknown) => void;
    public readonly logoff: (logoffReason?: string) => void;
    public readonly logToFile: (raw: unknown) => void;
    public readonly resetFIXSession: (newSession: unknown) => void;
    public readonly resendMessages: (BeginSeqNo: number, EndSeqNo: number) => void;
    public readonly send: (msg: unknown, replay?: unknown) => void;
}
