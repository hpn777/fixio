/**
 * Performance Tests for FIXio
 * 
 * Measures throughput for critical operations:
 * - Message parsing (convertToMap, convertToJSON)
 * - Message construction (convertToFIX)
 * - Field conversion (convertFieldsToFixTags)
 * - Checksum calculation
 * 
 * Run with: npx jest tests/performance.test.ts --no-coverage
 */

import { 
    convertToFIX, 
    convertToMap, 
    convertToJSON,
    convertFieldsToFixTags,
    checksum,
    getUTCTimeStamp,
    SOHCHAR
} from '../src/fixutils'
import { keyvals } from '../src/resources/fixSchema'

// Helper to format numbers with commas
const formatNumber = (num: number): string => {
    return num.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

// Helper to create a sample FIX message string
const createSampleFIXMessage = (): string => {
    const msg = {
        [keyvals.MsgType]: 'D', // New Order Single
        [keyvals.ClOrdID]: 'ORDER123456',
        [keyvals.Symbol]: 'EURUSD',
        [keyvals.Side]: '1',
        [keyvals.OrderQty]: '1000000',
        [keyvals.OrdType]: '2',
        [keyvals.Price]: '1.1850',
        [keyvals.TimeInForce]: '0',
        [keyvals.TransactTime]: getUTCTimeStamp(),
        [keyvals.Account]: 'ACCT001',
        [keyvals.Currency]: 'USD'
    }

    return convertToFIX(
        msg,
        'FIX.4.4',
        getUTCTimeStamp(),
        'SENDER',
        'TARGET',
        1,
        {}
    )
}

// Helper to create a complex FIX message with repeating groups
const createComplexFIXMessage = (): string => {
    const msg = {
        [keyvals.MsgType]: 'D',
        [keyvals.ClOrdID]: 'ORDER123456',
        [keyvals.Symbol]: 'EURUSD',
        [keyvals.Side]: '1',
        [keyvals.OrderQty]: '1000000',
        [keyvals.OrdType]: '2',
        [keyvals.Price]: '1.1850',
        [keyvals.TimeInForce]: '0',
        [keyvals.TransactTime]: getUTCTimeStamp(),
        [keyvals.Account]: 'ACCT001',
        [keyvals.Currency]: 'USD',
        // Add repeating group
        [keyvals.NoPartyIDs]: [
            {
                [keyvals.PartyID]: 'PARTY1',
                [keyvals.PartyIDSource]: 'D',
                [keyvals.PartyRole]: '1'
            },
            {
                [keyvals.PartyID]: 'PARTY2',
                [keyvals.PartyIDSource]: 'D',
                [keyvals.PartyRole]: '2'
            }
        ]
    }

    return convertToFIX(
        msg,
        'FIX.4.4',
        getUTCTimeStamp(),
        'SENDER',
        'TARGET',
        1,
        {}
    )
}

describe('Performance Tests', () => {
    // Configuration
    const WARMUP_ITERATIONS = 1000
    const TEST_DURATION_MS = 2000 // 2 seconds per test
    
    let sampleMessage: string
    let complexMessage: string

    beforeAll(() => {
        sampleMessage = createSampleFIXMessage()
        complexMessage = createComplexFIXMessage()
        
        console.log('\n📊 FIXio Performance Benchmark')
        console.log('━'.repeat(60))
        console.log(`Sample message length: ${sampleMessage.length} bytes`)
        console.log(`Complex message length: ${complexMessage.length} bytes`)
        console.log(`Test duration: ${TEST_DURATION_MS}ms per test`)
        console.log('━'.repeat(60))
    })

    describe('Message Parsing Performance', () => {
        test('convertToMap - Simple Message', () => {
            // Warmup
            for (let i = 0; i < WARMUP_ITERATIONS; i++) {
                convertToMap(sampleMessage)
            }

            // Actual test
            const startTime = Date.now()
            let iterations = 0
            
            while (Date.now() - startTime < TEST_DURATION_MS) {
                convertToMap(sampleMessage)
                iterations++
            }

            const elapsedSeconds = (Date.now() - startTime) / 1000
            const messagesPerSecond = iterations / elapsedSeconds
            
            console.log(`\n✓ convertToMap (Simple):`)
            console.log(`  ${formatNumber(messagesPerSecond)} messages/sec`)
            console.log(`  ${formatNumber(iterations)} iterations in ${elapsedSeconds.toFixed(2)}s`)
            
            expect(messagesPerSecond).toBeGreaterThan(0)
        })

        test('convertToMap - Complex Message with Groups', () => {
            // Warmup
            for (let i = 0; i < WARMUP_ITERATIONS; i++) {
                convertToMap(complexMessage)
            }

            // Actual test
            const startTime = Date.now()
            let iterations = 0
            
            while (Date.now() - startTime < TEST_DURATION_MS) {
                convertToMap(complexMessage)
                iterations++
            }

            const elapsedSeconds = (Date.now() - startTime) / 1000
            const messagesPerSecond = iterations / elapsedSeconds
            
            console.log(`\n✓ convertToMap (Complex):`)
            console.log(`  ${formatNumber(messagesPerSecond)} messages/sec`)
            console.log(`  ${formatNumber(iterations)} iterations in ${elapsedSeconds.toFixed(2)}s`)
            
            expect(messagesPerSecond).toBeGreaterThan(0)
        })

        test('convertToJSON - Simple Message', () => {
            // Warmup
            for (let i = 0; i < WARMUP_ITERATIONS; i++) {
                convertToJSON(sampleMessage)
            }

            // Actual test
            const startTime = Date.now()
            let iterations = 0
            
            while (Date.now() - startTime < TEST_DURATION_MS) {
                convertToJSON(sampleMessage)
                iterations++
            }

            const elapsedSeconds = (Date.now() - startTime) / 1000
            const messagesPerSecond = iterations / elapsedSeconds
            
            console.log(`\n✓ convertToJSON (Simple):`)
            console.log(`  ${formatNumber(messagesPerSecond)} messages/sec`)
            console.log(`  ${formatNumber(iterations)} iterations in ${elapsedSeconds.toFixed(2)}s`)
            
            expect(messagesPerSecond).toBeGreaterThan(0)
        })

        test('convertToJSON - Complex Message with Groups', () => {
            // Warmup
            for (let i = 0; i < WARMUP_ITERATIONS; i++) {
                convertToJSON(complexMessage)
            }

            // Actual test
            const startTime = Date.now()
            let iterations = 0
            
            while (Date.now() - startTime < TEST_DURATION_MS) {
                convertToJSON(complexMessage)
                iterations++
            }

            const elapsedSeconds = (Date.now() - startTime) / 1000
            const messagesPerSecond = iterations / elapsedSeconds
            
            console.log(`\n✓ convertToJSON (Complex):`)
            console.log(`  ${formatNumber(messagesPerSecond)} messages/sec`)
            console.log(`  ${formatNumber(iterations)} iterations in ${elapsedSeconds.toFixed(2)}s`)
            
            expect(messagesPerSecond).toBeGreaterThan(0)
        })
    })

    describe('Message Construction Performance', () => {
        const simpleOrder = {
            [keyvals.MsgType]: 'D',
            [keyvals.ClOrdID]: 'ORDER123456',
            [keyvals.Symbol]: 'EURUSD',
            [keyvals.Side]: '1',
            [keyvals.OrderQty]: '1000000',
            [keyvals.OrdType]: '2',
            [keyvals.Price]: '1.1850',
            [keyvals.TimeInForce]: '0',
            [keyvals.TransactTime]: getUTCTimeStamp()
        }

        const complexOrder = {
            ...simpleOrder,
            [keyvals.NoPartyIDs]: [
                {
                    [keyvals.PartyID]: 'PARTY1',
                    [keyvals.PartyIDSource]: 'D',
                    [keyvals.PartyRole]: '1'
                },
                {
                    [keyvals.PartyID]: 'PARTY2',
                    [keyvals.PartyIDSource]: 'D',
                    [keyvals.PartyRole]: '2'
                },
                {
                    [keyvals.PartyID]: 'PARTY3',
                    [keyvals.PartyIDSource]: 'D',
                    [keyvals.PartyRole]: '3'
                }
            ]
        }

        test('convertToFIX - Simple Message', () => {
            const timestamp = getUTCTimeStamp()
            
            // Warmup
            for (let i = 0; i < WARMUP_ITERATIONS; i++) {
                convertToFIX({ ...simpleOrder }, 'FIX.4.4', timestamp, 'SENDER', 'TARGET', i, {})
            }

            // Actual test
            const startTime = Date.now()
            let iterations = 0
            
            while (Date.now() - startTime < TEST_DURATION_MS) {
                convertToFIX({ ...simpleOrder }, 'FIX.4.4', timestamp, 'SENDER', 'TARGET', iterations, {})
                iterations++
            }

            const elapsedSeconds = (Date.now() - startTime) / 1000
            const messagesPerSecond = iterations / elapsedSeconds
            
            console.log(`\n✓ convertToFIX (Simple):`)
            console.log(`  ${formatNumber(messagesPerSecond)} messages/sec`)
            console.log(`  ${formatNumber(iterations)} iterations in ${elapsedSeconds.toFixed(2)}s`)
            
            expect(messagesPerSecond).toBeGreaterThan(0)
        })

        test('convertToFIX - Complex Message with Groups', () => {
            const timestamp = getUTCTimeStamp()
            
            // Warmup
            for (let i = 0; i < WARMUP_ITERATIONS; i++) {
                convertToFIX({ ...complexOrder }, 'FIX.4.4', timestamp, 'SENDER', 'TARGET', i, {})
            }

            // Actual test
            const startTime = Date.now()
            let iterations = 0
            
            while (Date.now() - startTime < TEST_DURATION_MS) {
                convertToFIX({ ...complexOrder }, 'FIX.4.4', timestamp, 'SENDER', 'TARGET', iterations, {})
                iterations++
            }

            const elapsedSeconds = (Date.now() - startTime) / 1000
            const messagesPerSecond = iterations / elapsedSeconds
            
            console.log(`\n✓ convertToFIX (Complex):`)
            console.log(`  ${formatNumber(messagesPerSecond)} messages/sec`)
            console.log(`  ${formatNumber(iterations)} iterations in ${elapsedSeconds.toFixed(2)}s`)
            
            expect(messagesPerSecond).toBeGreaterThan(0)
        })
    })

    describe('Field Conversion Performance', () => {
        const fieldOrder = {
            MsgType: 'D',
            ClOrdID: 'ORDER123456',
            Symbol: 'EURUSD',
            Side: '1',
            OrderQty: '1000000',
            OrdType: '2',
            Price: '1.1850',
            TimeInForce: '0',
            TransactTime: getUTCTimeStamp(),
            Account: 'ACCT001',
            Currency: 'USD'
        }

        test('convertFieldsToFixTags', () => {
            // Warmup
            for (let i = 0; i < WARMUP_ITERATIONS; i++) {
                convertFieldsToFixTags(fieldOrder)
            }

            // Actual test
            const startTime = Date.now()
            let iterations = 0
            
            while (Date.now() - startTime < TEST_DURATION_MS) {
                convertFieldsToFixTags(fieldOrder)
                iterations++
            }

            const elapsedSeconds = (Date.now() - startTime) / 1000
            const conversionsPerSecond = iterations / elapsedSeconds
            
            console.log(`\n✓ convertFieldsToFixTags:`)
            console.log(`  ${formatNumber(conversionsPerSecond)} conversions/sec`)
            console.log(`  ${formatNumber(iterations)} iterations in ${elapsedSeconds.toFixed(2)}s`)
            
            expect(conversionsPerSecond).toBeGreaterThan(0)
        })
    })

    describe('Utility Performance', () => {
        test('checksum calculation', () => {
            const testString = sampleMessage.substring(0, sampleMessage.length - 7) // Remove existing checksum
            
            // Warmup
            for (let i = 0; i < WARMUP_ITERATIONS; i++) {
                checksum(testString)
            }

            // Actual test
            const startTime = Date.now()
            let iterations = 0
            
            while (Date.now() - startTime < TEST_DURATION_MS) {
                checksum(testString)
                iterations++
            }

            const elapsedSeconds = (Date.now() - startTime) / 1000
            const checksumsPerSecond = iterations / elapsedSeconds
            
            console.log(`\n✓ checksum:`)
            console.log(`  ${formatNumber(checksumsPerSecond)} checksums/sec`)
            console.log(`  ${formatNumber(iterations)} iterations in ${elapsedSeconds.toFixed(2)}s`)
            
            expect(checksumsPerSecond).toBeGreaterThan(0)
        })

        test('getUTCTimeStamp', () => {
            const testDate = new Date()
            
            // Warmup
            for (let i = 0; i < WARMUP_ITERATIONS; i++) {
                getUTCTimeStamp(testDate)
            }

            // Actual test
            const startTime = Date.now()
            let iterations = 0
            
            while (Date.now() - startTime < TEST_DURATION_MS) {
                getUTCTimeStamp(testDate)
                iterations++
            }

            const elapsedSeconds = (Date.now() - startTime) / 1000
            const timestampsPerSecond = iterations / elapsedSeconds
            
            console.log(`\n✓ getUTCTimeStamp:`)
            console.log(`  ${formatNumber(timestampsPerSecond)} timestamps/sec`)
            console.log(`  ${formatNumber(iterations)} iterations in ${elapsedSeconds.toFixed(2)}s`)
            
            expect(timestampsPerSecond).toBeGreaterThan(0)
        })
    })

    describe('Round-trip Performance', () => {
        test('Full round-trip: construct → parse → construct', () => {
            const order = {
                [keyvals.MsgType]: 'D',
                [keyvals.ClOrdID]: 'ORDER123456',
                [keyvals.Symbol]: 'EURUSD',
                [keyvals.Side]: '1',
                [keyvals.OrderQty]: '1000000',
                [keyvals.OrdType]: '2',
                [keyvals.Price]: '1.1850'
            }
            
            const timestamp = getUTCTimeStamp()
            
            // Warmup
            for (let i = 0; i < WARMUP_ITERATIONS / 2; i++) {
                const fixMsg = convertToFIX({ ...order }, 'FIX.4.4', timestamp, 'SENDER', 'TARGET', i, {})
                const parsed = convertToMap(fixMsg)
                convertToFIX(parsed as any, 'FIX.4.4', timestamp, 'SENDER', 'TARGET', i + 1, {})
            }

            // Actual test
            const startTime = Date.now()
            let iterations = 0
            
            while (Date.now() - startTime < TEST_DURATION_MS) {
                const fixMsg = convertToFIX({ ...order }, 'FIX.4.4', timestamp, 'SENDER', 'TARGET', iterations, {})
                const parsed = convertToMap(fixMsg)
                convertToFIX(parsed as any, 'FIX.4.4', timestamp, 'SENDER', 'TARGET', iterations + 1, {})
                iterations++
            }

            const elapsedSeconds = (Date.now() - startTime) / 1000
            const roundTripsPerSecond = iterations / elapsedSeconds
            
            console.log(`\n✓ Full round-trip:`)
            console.log(`  ${formatNumber(roundTripsPerSecond)} round-trips/sec`)
            console.log(`  ${formatNumber(iterations)} iterations in ${elapsedSeconds.toFixed(2)}s`)
            
            expect(roundTripsPerSecond).toBeGreaterThan(0)
        })
    })

    afterAll(() => {
        console.log('\n' + '━'.repeat(60))
        console.log('✅ Performance tests complete')
        console.log('━'.repeat(60) + '\n')
    })
})
