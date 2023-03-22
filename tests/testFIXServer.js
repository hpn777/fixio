const { FIXServer } = require('../dist/FIXServer')

const serverOptions = {
  port: 12345,
  host: 'localhost',
  resetSeqNumOnReconect: true
}

const server = new FIXServer(serverOptions)
server.dataIn$.subscribe(data => {
    console.log('dataIn', data)
})
server.dataIn$.subscribe(data => {
    console.log('dataOut', data)
})
server.error$.subscribe(e => console.error(e))
server.listen()

