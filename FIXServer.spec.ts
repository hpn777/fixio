import { FIXServer } from './FIXServer'

describe(FIXServer, () => {
  it(`should be able to create instance`, () => {
    const server = new FIXServer({
      port: 1234,
      host: 'localhost',
    })

    expect(server).toBeInstanceOf(FIXServer)
  })

  it(`should be able to subscribe to some subjects`, () => {
    const server = new FIXServer({
      port: 1234,
      host: 'localhost',
    })

    server.jsonIn$.subscribe()
    server.jsonOut$.subscribe()
    server.error$.subscribe()
  })
})
