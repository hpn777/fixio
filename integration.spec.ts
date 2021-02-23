import { take } from 'rxjs/operators'
import { FIXClient } from './FIXClient'
import { FIXServer } from './FIXServer'
import { keyvals } from './resources/fixtagnums'

describe(`integration between ${FIXClient.name} and ${FIXServer.name}`, () => {
  let client: FIXClient
  let server: FIXServer

  beforeEach(async () => {
    client = new FIXClient("FIX.4.4", "initiator", "acceptor", {})
    server = new FIXServer({ host: 'localhost', port: 1234 })

    await new Promise<void>((resolve) => {
      server.listen(resolve)
    })

    await new Promise<void>((resolve) => {
      client.connect(server.port, server.host, undefined, resolve)
    })
  })

  afterEach(async () => {
    client.connection?.destroy()

    await new Promise<void>(
      (resolve, reject) => {
        server.server.close((error) => {
          if (!error) {
            resolve()
          } else {
            reject(error)
          }
        })
      }
    )
  })

  it(`client and server should be able to establish communication`, async () => {
    await Promise.race([
      client.dataIn$.pipe(take(1)).toPromise(),
      client.dataOut$.pipe(take(1)).toPromise(),
      server.dataIn$.pipe(take(1)).toPromise(),
      server.dataOut$.pipe(take(1)).toPromise(),
    ])
  })

  it(`client should be able to logon`, async () => {
    const [{ msg: logonmsg }] = await Promise.all([
      server.dataIn$.pipe(take(1)).toPromise(),
      client.logon(),
    ])

    expect(logonmsg).toMatchObject({
      [keyvals.MsgType]: 'A',
      [keyvals.MsgSeqNum]: '1',
    })
  })
})
