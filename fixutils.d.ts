export const setSOHCHAR: (char: string) => void;

export const getUTCTimeStamp: () => string;

export const checksum: (str: string) => string;


export const convertToFIX: (
    msgraw: unknown,
    fixVersion: unknown,
    timeStamp: unknown,
    senderCompID: unknown,
    targetCompID: unknown,
    outgoingSeqNum: unknown,
    options?: unknown,
) => void;

export const convertToKeyvals: (msg: string) => Array<[string, string]>;

export const convertToMap: (msg: string) => Record<string, unknown>;

export const convertToJSON: (msg: string) => Record<string, unknown>;
