import { mkdirSync, createWriteStream, unlinkSync, createReadStream, WriteStream, existsSync } from 'fs'
import { createInterface as createReadlineInterface } from 'readline'
import { EventEmitter } from 'events'
import { convertToMap, convertToFIX, getUTCTimeStamp } from '../fixutils'
import { keyvals } from '../resources/fixSchema'
import type { Socket } from 'net'

export interface FIXConnection {
    readonly connection?: Socket
}

export interface Session {
    incomingSeqNum: number;
    outgoingSeqNum: number;
    isLoggedIn?: boolean;
}

const sessions: Record<string, Session> = {}

export interface FIXSessionOptions {
    readonly storagePath: unknown;
    readonly fixVersion?: unknown;
    readonly senderCompID?: unknown;
    readonly senderSubID?: unknown;
    readonly targetCompID?: unknown;
    readonly targetSubID?: unknown;
    readonly appVerID?: unknown;
    readonly senderLocationID?: unknown;
    readonly logFolder?: string;
    readonly isDuplicateFunc?: (senderId: unknown, targetId: unknown) => boolean;
    readonly isAuthenticFunc?: (fix: ReturnType<typeof convertToMap>, fixClientRemoteAddress: string | undefined) => boolean;
    readonly retriveSession?: (senderId: unknown, targetId: unknown) => Session;
    readonly resetSeqNumOnReconect?: boolean;
    readonly defaultHeartbeatSeconds?: any;
    readonly sendHeartbeats?: boolean;
    readonly expectHeartbeats?: boolean;
    readonly respondToLogon?: boolean;
}

export class FIXSession extends EventEmitter {
    #fixClient: FIXConnection
    #isAcceptor: boolean

    #session: Session = {
        incomingSeqNum: 1,
        outgoingSeqNum: 1,
    }

    #timeOfLastIncoming = new Date().getTime();

    #heartbeatIntervalID?: NodeJS.Timer

    #timeOfLastOutgoing = new Date().getTime();

    #timeOfLastOutgoingHeartbeat = new Date().getTime();

    #testRequestID = 1;

    #isResendRequested = false

    #isLogoutRequested = false

    public readonly decode = async (raw: string) => {
        this.#timeOfLastIncoming = new Date().getTime();

        const fix = convertToMap(raw);

        const msgType = fix[keyvals.MsgType];

        //==Confirm first msg is logon==
        if (!this.#session.isLoggedIn && (msgType !== 'A' && msgType !== '5')) {
            const error = '[ERROR] First message must be logon:' + raw;
            throw new Error(error)
        }

        //==Process logon
        else if (!this.#session.isLoggedIn && msgType === 'A') {
            //==Process acceptor specific logic (Server)
            if (this.#isAcceptor) {
                this.#fixVersion = fix[keyvals.BeginString];
                //incoming sender and target are swapped because we want sender/comp
                //from our perspective, not the counter party's
                this.#senderCompID = fix[keyvals.TargetCompID]
                this.#senderSubID = fix[keyvals.SenderSubID]
                this.#targetCompID = fix[keyvals.SenderCompID]
                this.#targetSubID = fix[keyvals.TargetSubID]
                //==Check duplicate connections
                if (this.#isDuplicateFunc(this.#senderCompID, this.#targetCompID)) {
                    const error = `[ERROR] Session already logged in: ${raw} `;
                    throw new Error(error)
                }

                //==Authenticate connection
                if (!this.#isAuthenticFunc(fix, this.#fixClient.connection?.remoteAddress)) {
                    const error = `[ERROR] Session not authentic: ${raw} `;
                    throw new Error(error)
                }
                //==Sync sequence numbers from data store
                if (this.#resetSeqNumOnReconect) {
                    this.#session = {
                        incomingSeqNum: 1,
                        outgoingSeqNum: 1
                    }
                } else {
                    this.#session = await this.retriveSession(this.#senderCompID, this.#targetCompID)
                }
            } //End Process acceptor specific logic==

            const heartbeatInMilliSeconds = parseInt(fix[keyvals.HeartBtInt] as string ?? this.#defaultHeartbeatSeconds, 10) * 1000;

            //==Set heartbeat mechanism
            this.#heartbeatIntervalID = setInterval(() => {
                const currentTime = new Date().getTime();

                //==send heartbeats
                if (currentTime - this.#timeOfLastOutgoingHeartbeat > heartbeatInMilliSeconds && this.#sendHeartbeats) {
                    this.send({
                        [keyvals.MsgType]: '0'
                    }); //heartbeat
                    this.#timeOfLastOutgoingHeartbeat = new Date().getTime()
                }

                //==ask counter party to wake up
                if (currentTime - this.#timeOfLastIncoming > (heartbeatInMilliSeconds * 1.5) && this.#expectHeartbeats) {
                    this.send({
                        [keyvals.MsgType]: '1',
                        [keyvals.TestReqID]: this.#testRequestID++
                    }); //test req id
                }

                //==counter party might be dead, kill connection
                if (currentTime - this.#timeOfLastIncoming > heartbeatInMilliSeconds * 2 && this.#expectHeartbeats) {
                    const error = this.#targetCompID + `[ERROR] No heartbeat from counter party in milliseconds ${(heartbeatInMilliSeconds * 1.5)} `;
                    this.#fixClient.connection?.emit('error', error)
                    //throw new Error(error)
                }

            }, heartbeatInMilliSeconds / 2);

            this.#fixClient.connection?.on('close', () => {
                clearInterval(this.#heartbeatIntervalID!);
            });

            //==Logon successful
            this.#session.isLoggedIn = true;
            this.emit('logon', this.#targetCompID);
            //==Logon ack (acceptor)
            if (this.#isAcceptor && this.#respondToLogon) {
                this.send(fix);
            }

        } // End Process logon==

        const msgSeqNum = Number(fix[keyvals.MsgSeqNum])

        if (msgType !== '4' && msgType !== '5' && fix[keyvals.PossDupFlag] !== 'Y') {
            if (msgSeqNum >= this.#requestResendTargetSeqNum) {
                this.#isResendRequested = false;
            }

            if (msgSeqNum < this.#session.incomingSeqNum && !this.#isResendRequested) {
                const error = `[ERROR] Incoming sequence number[${msgSeqNum}]lower than expected[${this.#session.incomingSeqNum}]`
                this.logoff(error)
                throw new Error(error + ' : ' + raw)
            }
            //greater than expected
            else if (msgSeqNum > this.#session.incomingSeqNum && (this.#requestResendTargetSeqNum == 0 || this.#requestResendRequestedSeqNum !== this.#requestResendTargetSeqNum)) {
                this.requestResend(this.#session.incomingSeqNum, msgSeqNum)
            }
        }

        if (msgType !== '4' && (msgSeqNum === this.#session.incomingSeqNum || this.#isResendRequested)) {
            this.#session.incomingSeqNum = msgSeqNum + 1;
        }

        switch (msgType) {
            case '1': //==Process test request
                this.send({
                    [keyvals.MsgType]: '0',
                    [keyvals.TestReqID]: fix[keyvals.TestReqID],
                });
                break;
            case '2': //==Process resend-request
                this.resendMessages(
                    fix[keyvals.BeginSeqNo] ? Number(fix[keyvals.BeginSeqNo]) : undefined,
                    fix[keyvals.EndSeqNo] ? Number(fix[keyvals.EndSeqNo]) : undefined,
                );
                break;
            case '4':
                //==Process sequence-reset
                const resetSeqNo = Number(fix[keyvals.NewSeqNo])
                if (!Number.isNaN(resetSeqNo)) {
                    if (resetSeqNo >= this.#session.incomingSeqNum) {
                        if (resetSeqNo > this.#requestResendTargetSeqNum && this.#requestResendRequestedSeqNum !== this.#requestResendTargetSeqNum) {
                            this.#session.incomingSeqNum = this.#requestResendRequestedSeqNum + 1
                            this.#isResendRequested = false
                            this.requestResend(this.#session.incomingSeqNum, this.#requestResendTargetSeqNum)
                        } else {
                            this.#session.incomingSeqNum = resetSeqNo
                        }
                    } else {
                        const error = '[ERROR] Seq-reset may not decrement sequence numbers'
                        // self.logoff(error)
                        //throw new Error(error + ' : ' + raw)
                    }
                } else {
                    const error = '[ERROR] Seq-reset has invalid sequence numbers'
                    this.logoff(error)
                    throw new Error(error + ' : ' + raw)
                }
                break;
            case '5': //==Process logout
                if (!this.#isLogoutRequested) {
                    this.send(fix);

                    if (fix[keyvals.NextExpectedMsgSeqNum])
                        this.#session.outgoingSeqNum = Number(fix[keyvals.NextExpectedMsgSeqNum])
                }

                setImmediate(() => {
                    this.#fixClient.connection?.destroy()
                })
                this.#session.isLoggedIn = false
                //self.resetFIXSession(false)
                this.emit('logoff', {
                    senderCompID: this.#senderCompID,
                    targetCompID: this.#targetCompID,
                    logoffReason: fix[keyvals.Text],
                });
                break;
        }

        return fix
    }

    public readonly resetFIXSession = async (newSession: Partial<Session> = {}) => {
        this.#session = await this.retriveSession(this.#senderCompID, this.#targetCompID)

        if (newSession.incomingSeqNum) {
            this.#session.incomingSeqNum = newSession.incomingSeqNum
        }

        this.#session.isLoggedIn = false

        try {
            if (newSession.outgoingSeqNum) {
                this.#session.outgoingSeqNum = newSession.outgoingSeqNum
                unlinkSync(this.#logfilename!)
            }
        } catch {
            // pass
        }
    }

    public readonly logon = async (
        logonmsg: Record<any, unknown> = {
            [keyvals.MsgType]: 'A',
            [keyvals.EncryptMethod]: '0',
            [keyvals.HeartBtInt]: '10',
        },
    ) => {
        //==Sync sequence numbers from data store
        if (this.#resetSeqNumOnReconect) {
            this.#session = {
                incomingSeqNum: 1,
                outgoingSeqNum: 1,
            }
        } else {
            this.#session = await this.retriveSession(this.#senderCompID, this.#targetCompID)
        }
        this.send(logonmsg)
    }

    public readonly logoff = (logoffReason = 'Graceful close') => {
        this.send({
            [keyvals.MsgType]: 5,
            [keyvals.Text]: logoffReason,
        })
        this.#session.isLoggedIn = false
        this.#isLogoutRequested = true
    }

    public readonly send = (
        immutableMsg: Record<any, unknown>,
        replay?: boolean,
    ) => {
        const msg: Record<any, unknown> = { ...immutableMsg }
        if (!replay) {
            msg[keyvals.LastMsgSeqNumProcessed] = this.#session.incomingSeqNum - 1
        }

        const outgoingSeqNum = replay ? msg[keyvals.MsgSeqNum] : this.#session.outgoingSeqNum
        const outmsg = convertToFIX(
            msg,
            this.#fixVersion,
            getUTCTimeStamp(),
            this.#senderCompID,
            this.#targetCompID,
            outgoingSeqNum,
            {
                senderSubID: this.#senderSubID,
                targetSubID: this.#targetSubID,
                senderLocationID: this.#senderLocationID,
                appVerID: this.#appVerID
            },
        );

        this.emit('dataOut', msg)
        this.emit('fixOut', outmsg)

        this.#fixClient.connection?.write(outmsg)

        if (!replay) {
            this.#timeOfLastOutgoing = new Date().getTime()
            this.#session.outgoingSeqNum++
            this.logToFile(outmsg, this.#senderCompID, this.#targetCompID)
        }
    }

    #logfilename?: string

    #file: WriteStream | null = null

    public readonly logToFile = (raw: string, senderCompID: any, targetCompID: any) => {
        if (this.#file === null) {
          let fileName = this.#logfilename = `${this.#logFolder}/${senderCompID}-${targetCompID}.log`

          try {
              mkdirSync(this.#logFolder)
          } catch {
              // pass
          }

          try {
              if (this.#resetSeqNumOnReconect) {
                  unlinkSync(fileName);
              }
          } catch {
              // pass
          }

          this.#file = createWriteStream(
              fileName,
              {
                  'flags': 'a',
                  'mode': 0o666,
              },
          )
          this.#file.on('error', (error) => {
              this.#fixClient.connection?.emit('error', error)
          })

          if (this.#fixClient.connection) {
              this.#fixClient.connection.on('close', () => {
                  this.#file?.close()
                  this.#file = null
              })
          }
      }

      this.#file.write(raw + '\n');
    }

    #requestResendRequestedSeqNum = 0
    #requestResendTargetSeqNum = 0
    public readonly requestResend = (start: number, target: number) => {
        this.#requestResendTargetSeqNum = target
        const batchSize = 2000

        if (this.#isResendRequested === false && start < this.#requestResendTargetSeqNum) {
            this.#isResendRequested = true;

            const send = (from: number, to: number = 0) => this.send({
                [keyvals.MsgType]: 2,
                [keyvals.BeginSeqNo]: from,
                [keyvals.EndSeqNo]: to,
            });

            if (target - start <= batchSize) {
                this.#requestResendRequestedSeqNum = this.#requestResendTargetSeqNum = 0
                send(start)
            } else {
                this.#requestResendRequestedSeqNum = start + batchSize
                send(start, this.#requestResendRequestedSeqNum)
            }
        }
    }


    public readonly resendMessages = (BeginSeqNo: number = 0, EndSeqNo: number = this.#session.outgoingSeqNum - 1) => {
        if (this.#logfilename) {
            const reader = createReadStream(this.#logfilename, {
                'flags': 'r',
                'encoding': 'binary',
                'mode': 0o666
            })
            const lineReader = createReadlineInterface({
                input: reader,
            })


            let fillGapBuffer: Array<ReturnType<typeof convertToMap>> = []
            const sendFillGap = () => {
                if (fillGapBuffer.length > 0) {
                    this.send({
                        [keyvals.MsgType]: '4',
                        [keyvals.OrigSendingTime]: fillGapBuffer[0][keyvals.SendingTime],
                        [keyvals.GapFillFlag]: 'Y',
                        [keyvals.MsgSeqNum]: Number(fillGapBuffer[0][keyvals.MsgSeqNum]),
                        [keyvals.NewSeqNo]: Number(fillGapBuffer[fillGapBuffer.length - 1][keyvals.MsgSeqNum]) + 1,
                    }, true);
                    fillGapBuffer = []
                }
            }

            lineReader.on('line', (line) => {
                const _fix = convertToMap(line);
                const _msgType = `${_fix[keyvals.MsgType]}`;
                const _seqNo = Number(_fix[34]);
                if ((BeginSeqNo <= _seqNo) && (EndSeqNo >= _seqNo)) {
                    if (['A', '5', '2', '0', '1', '4'].includes(_msgType)) {
                        //send seq-reset with gap-fill Y
                        fillGapBuffer.push(_fix)

                        if (EndSeqNo === _seqNo) {
                            sendFillGap()
                        }
                    } else {
                        //send seq-reset with gap-fill Y
                        sendFillGap()
                        //send msg w/ posdup Y
                        this.send({
                            ..._fix,
                            [keyvals.OrigSendingTime]: _fix[keyvals.SendingTime],
                            [keyvals.PossDupFlag]: 'Y',
                            [keyvals.MsgSeqNum]: _seqNo,
                            [keyvals.NewSeqNo]: _seqNo + 1,
                        }, true);
                    }
                } else if (EndSeqNo < _seqNo) {
                    sendFillGap()
                    lineReader.removeAllListeners('line')
                    reader.close()
                }
            })
        }
    }

    public readonly retriveSession = async (senderCompID: any, targetCompID: any):Promise<Session> => {
      let fileName = this.#logfilename = `${this.#logFolder}/${senderCompID}-${targetCompID}.log`
      
      if(existsSync(fileName)){
        const reader = createReadStream(fileName, {
          'flags': 'r',
          'encoding': 'binary',
          'mode': 0o666
        })
        const lineReader = createReadlineInterface({
          input: reader,
        })
  
        let incomingSeqNum = 0
        let outgoingSeqNum = 0
        for await (const line of lineReader) {
          const _fix = convertToMap(line)
          incomingSeqNum = Number(_fix[369])
          outgoingSeqNum = Number(_fix[34])
        }
        reader.close()
        return{
          incomingSeqNum: ++incomingSeqNum,
          outgoingSeqNum: ++outgoingSeqNum
        }
      }
      else{
        return {
          incomingSeqNum: 1,
          outgoingSeqNum: 1
        }
      }
  }

    #fixVersion: Required<FIXSessionOptions>['fixVersion']

    #senderCompID: Required<FIXSessionOptions>['senderCompID']

    #senderSubID: Required<FIXSessionOptions>['senderSubID']

    #targetCompID: Required<FIXSessionOptions>['targetCompID']

    #targetSubID: Required<FIXSessionOptions>['targetSubID']

    #appVerID: Required<FIXSessionOptions>['appVerID']

    #senderLocationID: Required<FIXSessionOptions>['senderLocationID']

    #logFolder: Required<FIXSessionOptions>['logFolder']

    #isDuplicateFunc: Required<FIXSessionOptions>['isDuplicateFunc']

    #isAuthenticFunc: Required<FIXSessionOptions>['isAuthenticFunc']

    #resetSeqNumOnReconect: Required<FIXSessionOptions>['resetSeqNumOnReconect']

    #defaultHeartbeatSeconds: Required<FIXSessionOptions>['defaultHeartbeatSeconds']

    #sendHeartbeats: Required<FIXSessionOptions>['sendHeartbeats']

    #expectHeartbeats: Required<FIXSessionOptions>['expectHeartbeats']

    #respondToLogon: Required<FIXSessionOptions>['respondToLogon']

    #key: string

    constructor(fixClient: FIXConnection, isAcceptor: boolean, options: FIXSessionOptions) {
        super()
        this.#fixClient = fixClient
        this.#isAcceptor = isAcceptor
        this.#fixVersion = options.fixVersion
        this.#senderCompID = options.senderCompID
        this.#senderSubID = options.senderSubID
        this.#targetCompID = options.targetCompID
        this.#targetSubID = options.targetSubID
        this.#senderLocationID = options.senderLocationID

        this.#logFolder = options.logFolder ?? './storage'

        this.#key = `${this.#senderCompID}-${this.#targetCompID}`
        this.#isDuplicateFunc = options.isDuplicateFunc ?? ((senderId, targetId) => sessions[`${senderId} -${targetId} `]?.isLoggedIn ?? false)
        this.#isAuthenticFunc = options.isAuthenticFunc ?? (() => true)

        this.#resetSeqNumOnReconect = options.resetSeqNumOnReconect ?? true
        this.#defaultHeartbeatSeconds = options.defaultHeartbeatSeconds ?? '10'
        this.#sendHeartbeats = options.sendHeartbeats ?? true
        this.#expectHeartbeats = options.expectHeartbeats ?? true
        this.#respondToLogon = options.respondToLogon ?? true
    }
}
