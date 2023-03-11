const { FIXClient } = require('../dist/FIXClient')
const fixutil = require('../dist/fixutils')

const client = new FIXClient("FIXT.1.1", "initiator", "acceptor", {autologon: false, resetSeqNumOnReconect: false})

client.jsonIn$.subscribe(json => {
    console.log('initiator jsonIn', json)
})
client.jsonOut$.subscribe(json => {
    console.log('initiator jsonOut', json)
})
client.error$.subscribe(e => console.log(e))
client.connect(1234, 'localhost')

client.logon$.subscribe(msg => {
    console.log('got logon: ', msg);

    // Send OrderCancelRequest while there is no order,
    // expect OrderCancelReject<9>
    client.send({
        "35": 'F',
        "41": "15",
        "37": "15",
        "11": "15", // ClOrdId
        "48": 'SecurityId_test_1',
        "22": '1',
        "1137": "9",
        "453": 0,
        "54": 1,
        "60": fixutil.getUTCTimeStamp(),
    })
})

client.logon()

// var testData = '8=FIX.4.49=14835=D34=108049=TESTBUY152=20180920-18:14:19.50856=TESTSELL111=63673064027889863415=USD21=238=700040=154=155=MSFT60=20180920-18:14:19.49210=092'
// var data = fixutil.convertToMap(testData)
// setTimeout(() =>{
// data['38'] = 100000000001
//     client.send(data)
// }, 1000)
