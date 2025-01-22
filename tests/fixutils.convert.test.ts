import { fixutil } from '../src/fix'

describe('Data mapping tests', () => {
    let sut = fixutil // SUT stands for "System Under Test"

    beforeAll(async () => {
        sut.setSOHCHAR("|")
    });

    test('when request is anonymous object - convert to FIX tags', async () => {
        // Setup
        let expectedMsgType = "J"
        let expectedSymbol = "WFH/WFH"
        let expectedOnBehalfOfSubID = "me@example.com"
        let reqRecord = {
            MsgType: expectedMsgType,
            Symbol: expectedSymbol,
            OnBehalfOfSubID: expectedOnBehalfOfSubID
        }

        // SUT call
        let fixRequestStr = sut.convertMapToFIX(sut.convertFieldsToFixTags(reqRecord))
        let fixRequestParsed = sut.convertToJSON(fixRequestStr)

        // Assertions
        expect(fixRequestStr).toContain(`|55=${expectedSymbol}|`)
        expect(fixRequestStr).toContain(`|116=${expectedOnBehalfOfSubID}|`)
        expect(fixRequestParsed).not.toBe(null)
        expect(fixRequestParsed.Symbol).toBe(expectedSymbol)
        expect(fixRequestParsed.OnBehalfOfSubID).toBe(expectedOnBehalfOfSubID)
        expect(fixRequestStr).toContain(`|35=${expectedMsgType}|`)

        const expected = `|35=${expectedMsgType}|`
        expect(fixRequestStr.replace(expected, '|')).not.toContain(expected)
    });

    test('when request is POJO - convert to FIX tags', async () => {
        // Setup
        let expectedSymbol = "WFH/WFH"
        let request: DummyInterface = {
            Symbol: expectedSymbol
        }

        // SUT call
        let fixRequestStr = sut.convertMapToFIX(sut.convertFieldsToFixTags(request))
        let fixRequestParsed = sut.convertToJSON(fixRequestStr)

        // Assertions
        expect(fixRequestStr).toContain(`|55=${expectedSymbol}|`)
        expect(fixRequestParsed).not.toBe(null)
        expect(fixRequestParsed.Symbol).toBe(expectedSymbol)
    });

    test('when field is unknown by FIX - convert as is', async () => {
        // Setup
        let unknownFieldValue = "value"
        let expectedSymbol = "WFH/WFH"
        let reqRecord = {
            Symbol: expectedSymbol,
            AlienField: unknownFieldValue
        }

        // SUT call
        let fixRequestStr = sut.convertMapToFIX(sut.convertFieldsToFixTags(reqRecord))

        // Assertions
        expect(fixRequestStr).toContain(`|55=${expectedSymbol}|`)
        expect(fixRequestStr).toContain(`|AlienField=${unknownFieldValue}|`)
    });
})

interface DummyInterface {
     Symbol: string,
}