const fix = require('./fix.js');
const {FIXServer} = require("./FIXServer.js");

const server = new FIXServer({resetSeqNumOnReconect: false})
server.jsonIn$.subscribe((x)=>{if(x.msg.GapFillFlag != 'Y') console.log('jsonIn', x)})
server.jsonOut$.subscribe((x)=>{if(x.msg.GapFillFlag != 'Y') console.log('jsonOut', x)})
server.error$.subscribe((x)=>{console.log(x)})
server.listen(1234, "localhost")

