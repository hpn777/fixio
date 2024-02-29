import { fixutil } from '../src/fix'

describe('Data mapping tests', () => {
    let sut = fixutil // SUT stands for "System Under Test"

    beforeAll(async () => {
        sut.setSOHCHAR("|")
    });

    test('when request is anonymous object - convert to FIX tags', async () => {
        // Setup
        let expectedSymbol = "WFH/WFH"
        let reqRecord = {
            Symbol: expectedSymbol
        }

        // SUT call
        let fixRequestStr = sut.convertMapToFIX(sut.convertFieldsToFixTags(reqRecord))
        let fixRequestParsed = sut.convertToJSON(fixRequestStr)

        // Assertions
        expect(fixRequestStr).toContain(`|55=${expectedSymbol}|`)
        expect(fixRequestParsed).not.toBe(null)
        expect(fixRequestParsed.Symbol).toBe(expectedSymbol)
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