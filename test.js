var fixutils = require('./fixutils')
var {FrameDecoder} = require('./handlers/FrameDecoder')
const frameDecoder = new FrameDecoder()
var testData = '8=FIX.4.49=14835=D34=108049=TESTBUY152=20180920-18:14:19.50856=TESTSELL111=63673064027889863415=USD21=238=700040=154=155=MSFT60=20180920-18:14:19.49210=092'
var i = 1

console.time('perf')

for(k = 0; k < 100000; k++){
frameDecoder
    .decode(testData)
    .map(x=>fixutils.convertToJSON(x))
    .subscribe(x=>{
        // fixutils.convertMapToFIX(x)
        i++
    })
}
console.timeEnd('perf')
console.log(i)