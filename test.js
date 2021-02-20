var fixutils = require('./fixutils')
var {
    FrameDecoder
} = require('./handlers/FrameDecoder')
const frameDecoder = new FrameDecoder()
var testData = '8=FIX.4.49=28935=834=109049=TESTSELL152=20180920-18:23:53.67156=TESTBUY16=113.3511=63673064027889863414=3500.000000000015=USD17=2063673064633531000021=231=113.3532=350037=2063673064633531000038=700039=140=154=155=MSFT60=20180920-18:23:53.531150=F151=3500453=1448=BRK2447=D452=110=151'
// var testData = '8=FIX.4.49=14835=D34=108049=TESTBUY152=20180920-18:14:19.50856=TESTSELL111=63673064027889863415=USD21=238=700040=154=155=MSFT60=20180920-18:14:19.49210=092'
var i = 1

console.time('perf')

for (k = 0; k < 10000; k++) {
    frameDecoder
        .decode(testData)
        .map(x => fixutils.convertToJSON(x))
        .subscribe(x => {
            // console.log(x)
            fixutils.convertToFIX(x)
            i++
        })
}
console.timeEnd('perf')
console.log(i)