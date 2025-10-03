import { FrameDecoder } from '../src/handlers/FrameDecoder'
import { fixutil } from '../src/fix'

describe('FrameDecoder - Fixed Comprehensive Test Suite', () => {
    let decoder: FrameDecoder

    beforeEach(() => {
        decoder = new FrameDecoder()
        fixutil.setSOHCHAR('|')
    })

    // Helper to create valid FIX message
    function createValidMessage(body: string): string {
        const fixVersion = '8=FIX.4.4|'
        const bodyLength = `9=${body.length}|`
        const msgWithoutChecksum = fixVersion + bodyLength + body
        const checksum = fixutil.checksum(msgWithoutChecksum)
        return msgWithoutChecksum + '10=' + checksum + '|'
    }

    describe('Basic Frame Decoding', () => {
        test('should decode complete FIX message', () => {
            const body = '35=D|49=SENDER|56=TARGET|34=1|52=20240115-10:30:45|'
            const msg = createValidMessage(body)
            const buffer = Buffer.from(msg)
            const result = decoder.decode(buffer)
            
            expect(result).toHaveLength(1)
            expect(result[0]).toBe(msg)
        })

        test('should extract body length correctly', () => {
            const body = '35=D|49=SENDER|56=TARGET|34=1|52=20240115-10:30:45.123|'
            const msg = createValidMessage(body)
            const buffer = Buffer.from(msg)
            const result = decoder.decode(buffer)
            
            expect(result).toHaveLength(1)
        })

        test('should handle multiple complete messages in one buffer', () => {
            const body1 = '35=D|49=SENDER|56=TARGET|34=1|52=20240115-10:30:45|'
            const msg1 = createValidMessage(body1)
            
            const body2 = '35=D|49=SENDER|56=TARGET|34=2|52=20240115-10:30:46|'
            const msg2 = createValidMessage(body2)
            
            const buffer = Buffer.from(msg1 + msg2)
            const result = decoder.decode(buffer)
            
            expect(result).toHaveLength(2)
            expect(result[0]).toBe(msg1)
            expect(result[1]).toBe(msg2)
        })
    })

    describe('Partial Message Handling', () => {
        test('should buffer incomplete message', () => {
            const msg = '8=FIX.4.4|9=100|35=D|49=SENDER|56=TARGET|'
            const buffer = Buffer.from(msg)
            const result = decoder.decode(buffer)
            
            expect(result).toHaveLength(0)
        })

        test('should combine buffered data with new data', () => {
            const body = '35=D|49=SENDER|56=TARGET|34=1|52=20240115-10:30:45|'
            const full = createValidMessage(body)
            
            const part1 = full.slice(0, 30)
            const part2 = full.slice(30)
            
            const buffer1 = Buffer.from(part1)
            const result1 = decoder.decode(buffer1)
            expect(result1).toHaveLength(0)
            
            const buffer2 = Buffer.from(part2)
            const result2 = decoder.decode(buffer2)
            expect(result2).toHaveLength(1)
            expect(result2[0]).toBe(full)
        })

        test('should handle message split across multiple buffers', () => {
            const body = '35=D|49=SENDER|56=TARGET|34=1|52=20240115-10:30:45|'
            const full = createValidMessage(body)
            
            const parts = [
                full.slice(0, 20),
                full.slice(20, 40),
                full.slice(40, 60),
                full.slice(60)
            ]
            
            let results: string[] = []
            parts.forEach((part) => {
                const buffer = Buffer.from(part)
                const result = decoder.decode(buffer)
                results = results.concat(result)
            })
            
            expect(results).toHaveLength(1)
            expect(results[0]).toBe(full)
        })
    })

    describe('Checksum Validation', () => {
        test('should validate correct checksum', () => {
            const body = '35=D|49=SENDER|56=TARGET|34=1|52=20240115-10:30:45|'
            const msg = createValidMessage(body)
            const buffer = Buffer.from(msg)
            
            const result = decoder.decode(buffer)
            expect(result).toHaveLength(1)
        })

        test('should reject message with incorrect checksum', () => {
            const body = '35=D|49=SENDER|56=TARGET|34=1|52=20240115-10:30:45|'
            const msgBase = '8=FIX.4.4|9=' + body.length + '|' + body
            const badMsg = msgBase + '10=999|'
            const buffer = Buffer.from(badMsg)
            
            expect(() => decoder.decode(buffer)).toThrow(/checksum/)
        })

        test('should provide details in checksum error', () => {
            const body = '35=D|49=SENDER|56=TARGET|34=1|52=20240115-10:30:45|'
            const msgBase = '8=FIX.4.4|9=' + body.length + '|' + body
            const badMsg = msgBase + '10=000|'
            const buffer = Buffer.from(badMsg)
            
            expect(() => decoder.decode(buffer)).toThrow(/expected checksum/)
        })
    })

    describe('Body Length Handling', () => {
        test('should wait for complete message based on body length', () => {
            const msg = '8=FIX.4.4|9=1000|35=D|49=SENDER|'
            const buffer = Buffer.from(msg)
            const result = decoder.decode(buffer)
            
            expect(result).toHaveLength(0)
        })

        test('should handle minimal message', () => {
            const body = '35=A|'
            const msg = createValidMessage(body)
            const buffer = Buffer.from(msg)
            const result = decoder.decode(buffer)
            expect(result).toHaveLength(1)
        })

        test('should correctly parse body length field', () => {
            const msg = '8=FIX.4.4|9=123|35=D|49=SENDER|56=TARGET|'
            const buffer = Buffer.from(msg)
            
            // Should wait for more data since body length is 123 but we have less
            const result = decoder.decode(buffer)
            expect(result).toHaveLength(0)
        })
    })

    describe('Edge Cases', () => {
        test('should handle very small buffer', () => {
            const buffer = Buffer.from('8=')
            const result = decoder.decode(buffer)
            expect(result).toHaveLength(0)
        })

        test('should handle empty buffer', () => {
            const buffer = Buffer.from('')
            const result = decoder.decode(buffer)
            expect(result).toHaveLength(0)
        })

        test('should handle buffer with only SOH characters', () => {
            const buffer = Buffer.from('||||||||')
            const result = decoder.decode(buffer)
            expect(result).toHaveLength(0)
        })

        test('should handle large message', () => {
            const largeField = 'A'.repeat(1000)
            const body = `35=D|58=${largeField}|49=SENDER|56=TARGET|`
            const msg = createValidMessage(body)
            const buffer = Buffer.from(msg)
            
            const result = decoder.decode(buffer)
            expect(result).toHaveLength(1)
        })

        test('should handle binary data in buffer', () => {
            const body = '35=D|49=SENDER|56=TARGET|34=1|52=20240115-10:30:45|'
            const msg = createValidMessage(body)
            const buffer = Buffer.from(msg, 'utf8')
            
            const result = decoder.decode(buffer)
            expect(result).toHaveLength(1)
        })
    })

    describe('Sequential Decoding', () => {
        test('should maintain state across multiple decode calls', () => {
            const body1 = '35=D|49=SENDER|56=TARGET|34=1|52=20240115-10:30:45|'
            const msg1 = createValidMessage(body1)
            
            const body2 = '35=D|49=SENDER|56=TARGET|34=2|52=20240115-10:30:46|'
            const msg2Full = createValidMessage(body2)
            const msg2Part1 = msg2Full.slice(0, 30)
            const msg2Part2 = msg2Full.slice(30)
            
            const result1 = decoder.decode(Buffer.from(msg1))
            expect(result1).toHaveLength(1)
            
            const result2 = decoder.decode(Buffer.from(msg2Part1))
            expect(result2).toHaveLength(0)
            
            const result3 = decoder.decode(Buffer.from(msg2Part2))
            expect(result3).toHaveLength(1)
        })

        test('should process message boundary correctly', () => {
            const body1 = '35=D|49=SENDER|56=TARGET|34=1|52=20240115-10:30:45|'
            const msg1 = createValidMessage(body1)
            
            const body2 = '35=D|49=SENDER|56=TARGET|34=2|52=20240115-10:30:46|'
            const msg2 = createValidMessage(body2)
            
            const msg2Start = msg2.slice(0, 30)
            const combined = msg1 + msg2Start
            
            const result1 = decoder.decode(Buffer.from(combined))
            expect(result1).toHaveLength(1)
            expect(result1[0]).toBe(msg1)
            
            const msg2Rest = msg2.slice(30)
            const result2 = decoder.decode(Buffer.from(msg2Rest))
            expect(result2).toHaveLength(1)
        })
    })

    describe('Error Recovery', () => {
        test('should throw error for corrupted message and stop processing', () => {
            const body = '35=D|49=SENDER|56=TARGET|34=1|52=20240115-10:30:45|'
            const msgBase = '8=FIX.4.4|9=' + body.length + '|' + body
            const badMsg = msgBase + '10=CORRUPT|'
            const buffer = Buffer.from(badMsg)
            
            expect(() => decoder.decode(buffer)).toThrow()
        })

        test('should include checksum details in error message', () => {
            const body = '35=D|49=SENDER|56=TARGET|34=1|52=20240115-10:30:45|'
            const msgBase = '8=FIX.4.4|9=' + body.length + '|' + body
            const badMsg = msgBase + '10=999|'
            const buffer = Buffer.from(badMsg)
            
            expect(() => decoder.decode(buffer)).toThrow(/checksum/)
        })
    })
})
