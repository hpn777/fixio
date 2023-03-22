const { FIXServer } = require('../dist/FIXServer')

const serverOptions = {
  port: 12345,
  host: 'localhost',
  resetSeqNumOnReconect: true
}

const server = new FIXServer(serverOptions)
server.jsonIn$.subscribe(json => {
    console.log('jsonIn', json)
})
server.jsonOut$.subscribe(json => {
    console.log('jsonOut', json)
})
server.error$.subscribe(e => console.error(e))
server.listen()

