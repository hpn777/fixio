import { toArray } from 'rxjs/operators'
import { FrameDecoder } from './FrameDecoder'

describe(FrameDecoder, () => {
    it(`should be able to create instance`, () => {
        const frameDecoder = new FrameDecoder()

        expect(frameDecoder).toBeInstanceOf(FrameDecoder)
    })

    it.each<[string, string[]]>([
        [
            '8=FIX.4.49=28935=834=109049=TESTSELL152=20180920-18:23:53.67156=TESTBUY16=113.3511=63673064027889863414=3500.000000000015=USD17=2063673064633531000021=231=113.3532=350037=2063673064633531000038=700039=140=154=155=MSFT60=20180920-18:23:53.531150=F151=3500453=1448=BRK2447=D452=110=151',
            ['8=FIX.4.49=28935=834=109049=TESTSELL152=20180920-18:23:53.67156=TESTBUY16=113.3511=63673064027889863414=3500.000000000015=USD17=2063673064633531000021=231=113.3532=350037=2063673064633531000038=700039=140=154=155=MSFT60=20180920-18:23:53.531150=F151=3500453=1448=BRK2447=D452=110=151'],
        ],
    ])(`should decode %p`, async (data, expectedResult) => {
        const frameDecoder = new FrameDecoder()

        const result = await frameDecoder.decode(data).pipe(toArray()).toPromise()

        expect(result).toEqual(expectedResult)
    })
})
