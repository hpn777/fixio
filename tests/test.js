var fixutils = require('../dist/fixutils')
var {
    FrameDecoder
} = require('../dist/handlers/FrameDecoder')
const frameDecoder = new FrameDecoder()
// var testData = '8=FIX.4.49=28935=834=109049=TESTSELL152=20180920-18:23:53.67156=TESTBUY16=113.3511=63673064027889863414=3500.000000000015=USD17=2063673064633531000021=231=113.3532=350037=2063673064633531000038=700039=140=154=155=MSFT60=20180920-18:23:53.531150=F151=3500453=1448=BRK2447=D452=110=151'
var testData = '8=FIXT.1.135=AE49=n8_ccp_tp56=6487=0828=01300=140722=432=20031=105.0000000015=PLN381=21000.00552=254=Z453=2448=1339447=D452=12376=0448=1340447=N452=42376=31=ACCOUNT003581=137=211=14636703083921410528=A2593=12594=22595=N54=1453=2448=1337447=B452=12376=0448=1338447=D452=42376=31=ACCOUNT003581=137=111=1407379178520578528=A2593=12594=22595=N'
var i = 1

console.time('perf')

for (k = 0; k < 1000000; k++) {
    let dupa = fixutils.convertToMap(testData)
    i += 1//dupa.length
}
console.timeEnd('perf')
console.log(i)