import { Observable } from 'rxjs'
import { Socket } from 'net'

declare module 'fixio'

// { '44': 'value' }
interface FIXObject {
  [tag: string]: string
}

interface FIXData {
  senderId: string
  msg: FIXObject
}

interface FIXServerOptions {
  fixVersion: string
  port: number
  host: string
  senderCompID: string
  senderSubID: string
  targetCompID: string
  targetSubID: string
  isAuthenticFunc(fix: FIXObject, remoteAddress: string): boolean
}

declare function FIXServer(opt: FIXServerOptions): FIXServer

interface FIXSessionHolder {
  connection: Socket
  send(fix: FIXObject)
}

interface FIXServer {
  options: FIXServerOptions
  fixSessions: {
    [senderId: string]: FIXSessionHolder
  }
  listen(callback: () => void)
  send(targetId: string, fix: any)
  dataIn$: Observable<FIXData>
}

declare function FIXClient(
  protocol: string,
  senderCompID: string,
  targetCompID: string,
  opt: any
): FIXClient

interface FIXClient {
  connect(port: number, host: string): void
  send(data: any): void
  dataIn$: Observable<FIXData>,
  connect$: Observable<any>
  error$: Observable<any>
}
