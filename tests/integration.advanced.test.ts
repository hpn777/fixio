import { fixutil, FIXClient, FIXServer, keyvals } from '../src/fix'
import { readdirSync, unlinkSync, existsSync } from 'fs'

const sleep = (ms: number): Promise<void> => {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

describe('FIX Protocol - Advanced Integration Tests', () => {
    fixutil.setSOHCHAR('|')

    const commonOptions = {
        resetSeqNumOnReconect: true,
        sendHeartbeats: false,
        storagePath: '.',
        logFolder: 'logs'
    }

    // Track active servers and clients for cleanup
    let activeServers: FIXServer[] = []
    let activeClients: FIXClient[] = []

    // Clean up session files
    const cleanupSessions = () => {
        const logDir = './logs'
        if (existsSync(logDir)) {
            try {
                const files = readdirSync(logDir)
                for (const file of files) {
                    if (file.includes('TEST_') || file.includes('CLIENT')) {
                        unlinkSync(`${logDir}/${file}`)
                    }
                }
            } catch (e) {
                // Ignore
            }
        }
    }

    beforeEach(() => {
        cleanupSessions()
        activeServers = []
        activeClients = []
    })

    afterEach(async () => {
        // Close all active clients
        for (const client of activeClients) {
            try {
                client.close()
            } catch (e) {
                // Ignore
            }
        }

        // Close all active servers
        for (const server of activeServers) {
            try {
                await new Promise<void>((resolve) => {
                    server.server.close(() => resolve())
                })
            } catch (e) {
                // Ignore
            }
        }

        activeClients = []
        activeServers = []
        cleanupSessions()
        await sleep(20) // Minimal cleanup time
    })

    describe('Logon and Communication', () => {
        test('should complete successful logon handshake', async () => {
            const server = new FIXServer({
                ...commonOptions,
                port: 13100,
                host: 'localhost',
            })
            activeServers.push(server)

            server.listen()

            let serverLoggedIn = false
            server.logon$.subscribe(() => {
                serverLoggedIn = true
            })

            const client = new FIXClient('FIX.4.4', 'TEST_CLIENT', 'TEST_SERVER', {
                ...commonOptions,
                autologon: false,
            })
            activeClients.push(client)

            let clientLoggedIn = false
            client.logon$.subscribe(() => {
                clientLoggedIn = true
            })

            client.connect(13100, 'localhost')
            client.logon()
            await sleep(30)

            expect(serverLoggedIn).toBe(true)
            expect(clientLoggedIn).toBe(true)
        }, 10000)

        test('should send and receive application messages', async () => {
            const server = new FIXServer({
                ...commonOptions,
                port: 13101,
                host: 'localhost',
            })
            activeServers.push(server)

            server.listen()

            let receivedMessage: Record<any, unknown> | null = null
            server.dataIn$.subscribe((data) => {
                if (data.msg[keyvals.MsgType] === 'D') {
                    receivedMessage = data.msg
                }
            })

            const client = new FIXClient('FIX.4.4', 'TEST_CLIENT', 'TEST_SERVER', {
                ...commonOptions,
                autologon: false,
            })
            activeClients.push(client)

            client.connect(13101, 'localhost')
            client.logon()
            await sleep(30)

            client.send({
                [keyvals.MsgType]: 'D',
                [keyvals.Symbol]: 'AAPL',
                [keyvals.Side]: '1',
                [keyvals.OrderQty]: '100',
            })
            await sleep(30)

            expect(receivedMessage).toBeDefined()
            expect(String(receivedMessage![keyvals.Symbol])).toBe('AAPL')
        }, 10000)

        test('should handle bidirectional message exchange', async () => {
            const server = new FIXServer({
                ...commonOptions,
                port: 13102,
                host: 'localhost',
            })
            activeServers.push(server)

            server.listen()

            let clientExecReport: Record<any, unknown> | null = null
            server.dataIn$.subscribe((data) => {
                if (data.msg[keyvals.MsgType] === 'D') {
                    server.send('TEST_CLIENT', {
                        [keyvals.MsgType]: '8',
                        [keyvals.Symbol]: data.msg[keyvals.Symbol],
                    })
                }
            })

            const client = new FIXClient('FIX.4.4', 'TEST_CLIENT', 'TEST_SERVER', {
                ...commonOptions,
                autologon: false,
            })
            activeClients.push(client)

            client.dataIn$.subscribe((msg) => {
                if (msg[keyvals.MsgType] === '8') {
                    clientExecReport = msg
                }
            })

            client.connect(13102, 'localhost')
            client.logon()
            await sleep(30)

            client.send({
                [keyvals.MsgType]: 'D',
                [keyvals.Symbol]: 'MSFT',
            })
            await sleep(50)

            expect(clientExecReport).toBeDefined()
            expect(String(clientExecReport![keyvals.Symbol])).toBe('MSFT')
        }, 10000)
    })

    describe('Reconnection', () => {
        test('should handle client reconnection', async () => {
            const server = new FIXServer({
                ...commonOptions,
                port: 13103,
                host: 'localhost',
            })
            activeServers.push(server)

            server.listen()

            let loginCount = 0
            server.logon$.subscribe(() => {
                loginCount++
            })

            const client = new FIXClient('FIX.4.4', 'TEST_CLIENT', 'TEST_SERVER', {
                ...commonOptions,
                autologon: false,
            })
            activeClients.push(client)

            // First connection
            client.connect(13103, 'localhost')
            client.logon()
            await sleep(30)

            // Disconnect
            client.close()
            await sleep(30)

            // Reconnect
            client.connect(13103, 'localhost')
            client.logon()
            await sleep(30)

            expect(loginCount).toBe(2)
        }, 10000)

        test('should reset sequence numbers on reconnect', async () => {
            const server = new FIXServer({
                ...commonOptions,
                port: 13104,
                host: 'localhost',
            })
            activeServers.push(server)

            server.listen()

            const seqNums: number[] = []
            server.dataIn$.subscribe((data) => {
                if (data.msg[keyvals.MsgType] === 'A') {
                    seqNums.push(parseInt(String(data.msg[keyvals.MsgSeqNum])))
                }
            })

            const client = new FIXClient('FIX.4.4', 'TEST_CLIENT', 'TEST_SERVER', {
                ...commonOptions,
                autologon: false,
            })
            activeClients.push(client)

            // First connection
            client.connect(13104, 'localhost')
            client.logon()
            await sleep(30)

            // Disconnect
            client.close()
            await sleep(30)

            // Clean session files
            cleanupSessions()

            // Reconnect
            client.connect(13104, 'localhost')
            client.logon()
            await sleep(30)

            expect(seqNums.length).toBe(2)
            expect(seqNums[0]).toBe(1)
            expect(seqNums[1]).toBe(1)
        }, 10000)
    })

    describe('Logoff', () => {
        test('should complete graceful logoff', async () => {
            const server = new FIXServer({
                ...commonOptions,
                port: 13105,
                host: 'localhost',
            })
            activeServers.push(server)

            server.listen()

            let logoffReceived = false
            server.dataIn$.subscribe((data) => {
                if (data.msg[keyvals.MsgType] === '5') {
                    logoffReceived = true
                }
            })

            const client = new FIXClient('FIX.4.4', 'TEST_CLIENT', 'TEST_SERVER', {
                ...commonOptions,
                autologon: false,
            })
            activeClients.push(client)

            client.connect(13105, 'localhost')
            client.logon()
            await sleep(30)

            client.logoff('Normal disconnect')
            await sleep(30)

            expect(logoffReceived).toBe(true)
        }, 10000)

        test('should include logout reason in message', async () => {
            const server = new FIXServer({
                ...commonOptions,
                port: 13106,
                host: 'localhost',
            })
            activeServers.push(server)

            server.listen()

            let logoffMessage: Record<any, unknown> | null = null
            const logoffReason = 'Test completed'
            server.dataIn$.subscribe((data) => {
                if (data.msg[keyvals.MsgType] === '5') {
                    logoffMessage = data.msg
                }
            })

            const client = new FIXClient('FIX.4.4', 'TEST_CLIENT', 'TEST_SERVER', {
                ...commonOptions,
                autologon: false,
            })
            activeClients.push(client)

            client.connect(13106, 'localhost')
            client.logon()
            await sleep(30)

            client.logoff(logoffReason)
            await sleep(30)

            expect(logoffMessage).toBeDefined()
            expect(String(logoffMessage![keyvals.Text])).toBe(logoffReason)
        }, 10000)
    })

    describe('Multi-Client', () => {
        test('should handle multiple clients simultaneously', async () => {
            cleanupSessions() // Extra cleanup before multi-client test
            await sleep(50) // Wait for port to be released
            
            const server = new FIXServer({
                ...commonOptions,
                port: 13200, // Use different port range
                host: 'localhost',
            })
            activeServers.push(server)

            server.listen()

            const loggedInClients: string[] = []
            server.logon$.subscribe((senderId) => {
                loggedInClients.push(senderId)
            })

            const client1 = new FIXClient('FIX.4.4', 'CLIENT1', 'TEST_SERVER', {
                ...commonOptions,
                autologon: false,
            })
            activeClients.push(client1)

            const client2 = new FIXClient('FIX.4.4', 'CLIENT2', 'TEST_SERVER', {
                ...commonOptions,
                autologon: false,
            })
            activeClients.push(client2)

            client1.connect(13200, 'localhost')
            client1.logon()
            await sleep(50)

            client2.connect(13200, 'localhost')
            client2.logon()
            await sleep(50)

            expect(loggedInClients).toContain('CLIENT1')
            expect(loggedInClients).toContain('CLIENT2')
        }, 10000)

        test('should route messages to correct client', async () => {
            cleanupSessions() // Extra cleanup before multi-client test
            await sleep(50) // Wait for previous test cleanup
            
            const server = new FIXServer({
                ...commonOptions,
                port: 13201, // Use different port
                host: 'localhost',
            })
            activeServers.push(server)

            server.listen()

            server.logon$.subscribe(async (senderId) => {
                // Wait a bit for client to complete logon before sending message
                await sleep(20)
                server.send(senderId, {
                    [keyvals.MsgType]: '8',
                    [keyvals.Text]: `Message for ${senderId}`,
                })
            })

            const client1 = new FIXClient('FIX.4.4', 'CLIENT1', 'TEST_SERVER', {
                ...commonOptions,
                autologon: false,
            })
            activeClients.push(client1)

            const client2 = new FIXClient('FIX.4.4', 'CLIENT2', 'TEST_SERVER', {
                ...commonOptions,
                autologon: false,
            })
            activeClients.push(client2)

            let client1Message: Record<any, unknown> | null = null
            let client2Message: Record<any, unknown> | null = null

            client1.dataIn$.subscribe((msg) => {
                if (msg[keyvals.MsgType] === '8') {
                    client1Message = msg
                }
            })

            client2.dataIn$.subscribe((msg) => {
                if (msg[keyvals.MsgType] === '8') {
                    client2Message = msg
                }
            })

            client1.connect(13201, 'localhost')
            client1.logon()
            await sleep(50)

            client2.connect(13201, 'localhost')
            client2.logon()
            await sleep(80)

            expect(client1Message).toBeDefined()
            expect(String(client1Message![keyvals.Text])).toContain('CLIENT1')
            expect(client2Message).toBeDefined()
            expect(String(client2Message![keyvals.Text])).toContain('CLIENT2')
        }, 10000)
    })

    describe('Error Handling', () => {
        test('should handle connection error gracefully', async () => {
            const client = new FIXClient('FIX.4.4', 'TEST_CLIENT', 'TEST_SERVER', {
                ...commonOptions,
                autologon: false,
            })
            activeClients.push(client)

            let errorReceived = false
            client.error$.subscribe(() => {
                errorReceived = true
            })

            // Try to connect to non-existent server
            client.connect(19999, 'localhost')
            client.logon()
            await sleep(300)

            expect(errorReceived).toBe(true)
        }, 10000)

        test('should handle unexpected disconnect', async () => {
            const server = new FIXServer({
                ...commonOptions,
                port: 13109,
                host: 'localhost',
            })
            activeServers.push(server)

            server.listen()

            const client = new FIXClient('FIX.4.4', 'TEST_CLIENT', 'TEST_SERVER', {
                ...commonOptions,
                autologon: false,
            })
            activeClients.push(client)

            let eventReceived = false
            
            // Listen to multiple events that indicate disconnection
            client.close$.subscribe(() => {
                eventReceived = true
            })
            
            client.end$.subscribe(() => {
                eventReceived = true
            })
            
            client.error$.subscribe(() => {
                eventReceived = true
            })

            client.connect(13109, 'localhost')
            client.logon()
            await sleep(50)

            // Force disconnect by destroying the connection
            if (client.connection) {
                client.connection.destroy()
            }
            await sleep(50)

            // At least one disconnect event should have fired
            expect(eventReceived).toBe(true)
        }, 5000)
    })

    describe('Session Persistence', () => {
        test('should persist session state to log files', async () => {
            const server = new FIXServer({
                ...commonOptions,
                port: 13110,
                host: 'localhost',
            })
            activeServers.push(server)

            server.listen()

            const client = new FIXClient('FIX.4.4', 'TEST_CLIENT', 'TEST_SERVER', {
                ...commonOptions,
                autologon: false,
            })
            activeClients.push(client)

            client.connect(13110, 'localhost')
            client.logon()
            await sleep(30)

            client.send({
                [keyvals.MsgType]: 'D',
                [keyvals.Symbol]: 'TEST',
            })
            await sleep(30)

            const logDir = './logs'
            expect(existsSync(logDir)).toBe(true)

            const files = readdirSync(logDir)
            const sessionFiles = files.filter(f => f.includes('TEST_CLIENT') || f.includes('TEST_SERVER'))
            expect(sessionFiles.length).toBeGreaterThan(0)
        }, 10000)
    })
})
