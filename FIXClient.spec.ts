import { FIXClient } from './FIXClient'

describe(FIXClient, () => {
    it(`should be possible to instantiate the client`, () => {
        const client = new FIXClient("FIX.4.4", "initiator", "acceptor", {})
        expect(client).toBeInstanceOf(FIXClient)
    })

    it(`should be able to subscribe to some subjects`, () => {
        const client = new FIXClient("FIX.4.4", "initiator", "acceptor", {})

        client.jsonIn$.subscribe()
        client.jsonOut$.subscribe()
        client.error$.subscribe()
    })
})
