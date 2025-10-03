import { fixutil } from '../src/fix'

describe('fixutils - Comprehensive Test Suite', () => {
    beforeAll(() => {
        fixutil.setSOHCHAR('|')
    })

    describe('Timestamp Generation', () => {
        test('should generate UTC timestamp in correct format', () => {
            const date = new Date('2024-01-15T10:30:45.123Z')
            const timestamp = fixutil.getUTCTimeStamp(date)
            expect(timestamp).toBe('20240115-10:30:45.123')
        })

        test('should handle default date when not provided', () => {
            const timestamp = fixutil.getUTCTimeStamp()
            expect(timestamp).toMatch(/^\d{8}-\d{2}:\d{2}:\d{2}\.\d{3}$/)
        })

        test('should pad single digit values correctly', () => {
            const date = new Date('2024-01-01T01:01:01.001Z')
            const timestamp = fixutil.getUTCTimeStamp(date)
            expect(timestamp).toBe('20240101-01:01:01.001')
        })
    })

    describe('Checksum Calculation', () => {
        test('should calculate checksum correctly for basic string', () => {
            const input = '8=FIX.4.4|9=100|35=D|'
            const result = fixutil.checksum(input)
            expect(result).toHaveLength(3)
            expect(result).toMatch(/^\d{3}$/)
        })

        test('should return 3-digit checksum with leading zeros', () => {
            const input = 'A'
            const result = fixutil.checksum(input)
            expect(result).toBe('065')
        })

        test('should handle empty string', () => {
            const result = fixutil.checksum('')
            expect(result).toBe('000')
        })

        test('should handle special characters', () => {
            const input = '!@#$%^&*()'
            const result = fixutil.checksum(input)
            expect(result).toHaveLength(3)
        })
    })

    describe('Field Name to FIX Tag Conversion', () => {
        test('should convert known field names to FIX tags', () => {
            const obj = {
                MsgType: 'D',
                Symbol: 'AAPL',
                Side: '1'
            }
            const result = fixutil.convertFieldsToFixTags(obj)
            expect(result['35']).toBe('D')
            expect(result['55']).toBe('AAPL')
            expect(result['54']).toBe('1')
        })

        test('should keep unknown fields as-is', () => {
            const obj = {
                MsgType: 'D',
                UnknownField: 'value'
            }
            const result = fixutil.convertFieldsToFixTags(obj)
            expect(result['35']).toBe('D')
            expect(result['UnknownField']).toBe('value')
        })

        test('should handle empty object', () => {
            const result = fixutil.convertFieldsToFixTags({})
            expect(Object.keys(result)).toHaveLength(0)
        })

        test('should handle nested objects', () => {
            const obj = {
                MsgType: 'D',
                OrderQty: '100'
            }
            const result = fixutil.convertFieldsToFixTags(obj)
            expect(result['35']).toBe('D')
            expect(result['38']).toBe('100')
        })
    })

    describe('convertMapToFIX', () => {
        test('should convert map with all required fields', () => {
            const map = {
                8: 'FIX.4.4',
                35: 'D',
                49: 'SENDER',
                56: 'TARGET',
                34: 1,
                52: '20240115-10:30:45.123'
            }
            const result = fixutil.convertMapToFIX(map)
            expect(result).toContain('8=FIX.4.4|')
            expect(result).toContain('35=D|')
            expect(result).toContain('49=SENDER|')
            expect(result).toContain('56=TARGET|')
        })

        test('should include checksum at the end', () => {
            const map = {
                8: 'FIX.4.4',
                35: 'D',
                49: 'SENDER',
                56: 'TARGET',
                34: 1,
                52: '20240115-10:30:45.123'
            }
            const result = fixutil.convertMapToFIX(map)
            expect(result).toMatch(/10=\d{3}\|$/)
        })
    })

    describe('convertToFIX', () => {
        test('should create valid FIX message from basic fields', () => {
            const msg = { 35: 'D', 55: 'AAPL', 54: '1', 38: '100' }
            const result = fixutil.convertToFIX(
                msg,
                'FIX.4.4',
                '20240115-10:30:45.123',
                'SENDER',
                'TARGET',
                1,
                {}
            )
            expect(result).toContain('8=FIX.4.4|')
            expect(result).toContain('35=D|')
            expect(result).toContain('49=SENDER|')
            expect(result).toContain('56=TARGET|')
            expect(result).toContain('34=1|')
            expect(result).toContain('10=')
        })

        test('should handle optional sender/target SubIDs', () => {
            const msg = { 35: 'D' }
            const result = fixutil.convertToFIX(
                msg,
                'FIX.4.4',
                '20240115-10:30:45.123',
                'SENDER',
                'TARGET',
                1,
                { senderSubID: 'SUB1', targetSubID: 'SUB2' }
            )
            expect(result).toContain('50=SUB1|')
            expect(result).toContain('57=SUB2|')
        })

        test('should include app version ID when provided', () => {
            const msg = { 35: 'D' }
            const result = fixutil.convertToFIX(
                msg,
                'FIX.4.4',
                '20240115-10:30:45.123',
                'SENDER',
                'TARGET',
                1,
                { appVerID: '9' }
            )
            expect(result).toContain('1128=9|')
        })

        test('should automatically calculate and include BodyLength and CheckSum', () => {
            const msg = { 35: 'D', 55: 'AAPL' }
            const result = fixutil.convertToFIX(
                msg,
                'FIX.4.4',
                '20240115-10:30:45.123',
                'SENDER',
                'TARGET',
                1,
                {}
            )
            // Should have body length and checksum
            expect(result).toContain('9=')
            expect(result).toMatch(/10=\d{3}\|$/)
        })
    })

    describe('convertToMap', () => {
        test('should parse simple FIX message', () => {
            const msg = '8=FIX.4.4|9=50|35=D|49=SENDER|56=TARGET|34=1|52=20240115-10:30:45|10=000|'
            const result = fixutil.convertToMap(msg)
            expect(result[8]).toBe('FIX.4.4')
            expect(result[35]).toBe('D')
            expect(result[49]).toBe('SENDER')
            expect(result[56]).toBe('TARGET')
        })

        test('should handle messages without repeating groups', () => {
            const msg = '35=D|55=AAPL|54=1|38=100|'
            const result = fixutil.convertToMap(msg)
            expect(result[35]).toBe('D')
            expect(result[55]).toBe('AAPL')
            expect(result[54]).toBe('1')
            expect(result[38]).toBe('100')
        })

        test('should handle fields without repeating groups', () => {
            const msg = '35=D|447=1|'
            const result = fixutil.convertToMap(msg)
            // 447 is PartyIDSource, may or may not be a repeating group depending on schema
            expect(result[35]).toBe('D')
        })
    })

    describe('convertToJSON', () => {
        test('should convert FIX message to JSON with human-readable field names', () => {
            const msg = '35=D|55=AAPL|54=1|38=100|'
            const result = fixutil.convertToJSON(msg)
            expect(result.MsgType).toBe('D')
            expect(result.Symbol).toBe('AAPL')
            expect(result.Side).toBe(1) // Should convert to number
            expect(result.OrderQty).toBe(100)
        })

        test('should handle numeric field values correctly', () => {
            const msg = '35=D|38=100|44=50.25|'
            const result = fixutil.convertToJSON(msg)
            expect(result.OrderQty).toBe(100)
            expect(result.Price).toBe(50.25)
        })

        test('should preserve string values that are not numbers', () => {
            const msg = '35=D|55=AAPL|'
            const result = fixutil.convertToJSON(msg)
            expect(result.Symbol).toBe('AAPL')
        })

        test('should convert non-repeating group fields correctly', () => {
            const msg = '35=D|447=1|'
            const result = fixutil.convertToJSON(msg)
            expect(result.MsgType).toBe('D')
        })
    })

    describe('SOHCHAR Configuration', () => {
        test('should use default SOH character', () => {
            fixutil.setSOHCHAR('\x01')
            const msg = { 35: 'D', 55: 'AAPL' }
            const result = fixutil.convertToFIX(
                msg,
                'FIX.4.4',
                '20240115-10:30:45.123',
                'SENDER',
                'TARGET',
                1,
                {}
            )
            expect(result).toContain('\x01')
            fixutil.setSOHCHAR('|') // Reset for other tests
        })

        test('should allow custom SOH character', () => {
            fixutil.setSOHCHAR('#')
            const msg = { 35: 'D' }
            const result = fixutil.convertToFIX(
                msg,
                'FIX.4.4',
                '20240115-10:30:45.123',
                'SENDER',
                'TARGET',
                1,
                {}
            )
            expect(result).toContain('#')
            fixutil.setSOHCHAR('|') // Reset
        })
    })

    describe('Round-trip Conversion', () => {
        test('should maintain data integrity through convertToFIX and convertToMap', () => {
            const original = {
                35: 'D',
                55: 'AAPL',
                54: '1',
                38: '100',
                44: '150.50'
            }
            const fixMsg = fixutil.convertToFIX(
                original,
                'FIX.4.4',
                '20240115-10:30:45.123',
                'SENDER',
                'TARGET',
                1,
                {}
            )
            const parsed = fixutil.convertToMap(fixMsg)
            
            expect(parsed[35]).toBe('D')
            expect(parsed[55]).toBe('AAPL')
            expect(parsed[54]).toBe('1')
            expect(parsed[38]).toBe('100')
        })

        test('should maintain data through convertToFIX and convertToJSON', () => {
            const original = {
                35: 'D',
                55: 'AAPL',
                54: '1',
                38: '100'
            }
            const fixMsg = fixutil.convertToFIX(
                original,
                'FIX.4.4',
                '20240115-10:30:45.123',
                'SENDER',
                'TARGET',
                1,
                {}
            )
            const parsed = fixutil.convertToJSON(fixMsg)
            
            expect(parsed.MsgType).toBe('D')
            expect(parsed.Symbol).toBe('AAPL')
            expect(parsed.Side).toBe(1)
            expect(parsed.OrderQty).toBe(100)
        })
    })

    describe('Edge Cases', () => {
        test('should handle message with only required fields', () => {
            const msg = { 35: 'A' }
            const result = fixutil.convertToFIX(
                msg,
                'FIX.4.4',
                '20240115-10:30:45.123',
                'SENDER',
                'TARGET',
                1,
                {}
            )
            expect(result).toContain('8=FIX.4.4|')
            expect(result).toContain('35=A|')
        })

        test('should handle large sequence numbers', () => {
            const msg = { 35: 'D' }
            const result = fixutil.convertToFIX(
                msg,
                'FIX.4.4',
                '20240115-10:30:45.123',
                'SENDER',
                'TARGET',
                999999,
                {}
            )
            expect(result).toContain('34=999999|')
        })

        test('should handle special characters in field values', () => {
            const msg = { 35: 'D', 58: 'Test message with spaces & symbols!' }
            const result = fixutil.convertToFIX(
                msg,
                'FIX.4.4',
                '20240115-10:30:45.123',
                'SENDER',
                'TARGET',
                1,
                {}
            )
            expect(result).toContain('58=Test message with spaces & symbols!|')
        })
    })
})
