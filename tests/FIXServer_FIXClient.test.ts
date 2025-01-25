import { fixutil, FIXClient, FIXServer, keyvals } from '../src/fix'

const initiator = "jest"

describe('Client(initiator) to Server(acceptor) tests', () => {
    let server: FIXServer
    let sut: FIXClient // 'sut' stands for 'system under test'

    beforeAll(async () => {
        console.log("This unit tests suite launches FIXServer(with http server) and FIXClient, connected to each other")

        fixutil.setSOHCHAR("|")
        let commonOptions = {
            resetSeqNumOnReconect: true,
            sendHeartbeats: false,
            storagePath: ".",
            logFolder: "logs"
        }
        server = new FIXServer({
            ...commonOptions,
            port: 12345,
            host: 'localhost',
        })

        // Always response to logon requests with dummy answer
        server.listen()
        server.logon$.subscribe(() => {
            const msgMap = new Map<string, string>(); // for dynamic fields name
            msgMap.set(keyvals.OrdStatus.toString(), "Success")

            let msgRecord = Object.fromEntries(msgMap); // from map to record
            server.send(initiator, msgRecord)
        })        

        // ------ SUT INIT ------ //
        sut = new FIXClient("FIX.4.4",
            initiator, // also is a session ID
            "server",
            {
                ...commonOptions,
                autologon: false,
            })
    });

    test('when login - connection is established', async () => {
        // Setup
        let serverResponse: Record<any, unknown> | null = null
        sut.fixIn$.subscribe(async fix => {
            // save only first response from server
            if (!serverResponse) serverResponse = fixutil.convertToJSON(fix)
        })

        // SUT call
        sut.connect(12345, 'localhost')
        sut.logon({
            "35": "A",
            "553": "JEST CLIENT LOGIN"
        })
        await sleep(100)

        // Assertions
        expect(serverResponse).not.toBeNull()
        expect(serverResponse!!.OrdStatus).toBe("Success")
    });

    afterAll(async () => {
        if (sut) {
            sut.close()
            sut.logoff("JEST CLIENT LOGOFF")
        }

        await new Promise((resolve) => server.server.close(resolve));
    });
});

const sleep = (ms: number): Promise<void> => {
    return new Promise((resolve) =>
        setTimeout(resolve, ms) // Convert seconds to milliseconds
    );
};