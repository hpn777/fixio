const {FIXClient, fixutil} = require("./FIXClient.js");

const client = new FIXClient("FIX.4.2", "initiator", "acceptor", { resetSeqNumOnReconect: false })

client.connect(1234,'localhost');
client.jsonIn$.subscribe((response)=>{if(response.GapFillFlag != 'Y') console.log('initiator jsonIn',response)})
client.jsonOut$.subscribe((response)=>{if(response.GapFillFlag != 'Y') console.log('initiator jsonOut',response)})
client.error$.subscribe((x)=>{console.log(x)})

process.on('SIGINT', function() {
    client.logoff()
    setTimeout(() => {process.exit() }, 1000)
});