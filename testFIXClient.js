const { FIXClient } = require('./FIXClient')

const client = new FIXClient("FIX.4.4", "initiator", "acceptor", {})

client.jsonIn$.subscribe(json => {
    console.log('initiator jsonIn', json)
})
client.jsonOut$.subscribe(json => {
    console.log('initiator jsonOut', json)
})
client.error$.subscribe(e => console.log(e))
client.connect(1234, 'localhost')

