# FIXio

A modern TypeScript implementation of the [FIX protocol (Financial Information Exchange)](http://en.wikipedia.org/wiki/Financial_Information_eXchange) with reactive streams using RxJS.

[![Tests](https://img.shields.io/badge/tests-81%20passing-brightgreen)](https://github.com/hpn777/fixio)
[![TypeScript](https://img.shields.io/badge/TypeScript-4.7-blue)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## Installation

```bash
npm install fixio
```

## Quick Start

### Server (Acceptor)

```typescript
import { FIXServer, fixutil } from 'fixio'

const server = new FIXServer({
  port: 9878,
  host: 'localhost'
})

// Subscribe to incoming messages
server.fixIn$.subscribe(fix => {
  console.log('Received:', fixutil.convertToJSON(fix))
})

// Subscribe to outgoing messages
server.fixOut$.subscribe(fix => {
  console.log('Sent:', fixutil.convertToJSON(fix))
})

// Handle errors
server.error$.subscribe(error => {
  console.error('Server error:', error)
})

// Start listening
server.listen()
console.log('FIX Server listening on port 9878')
```

### Client (Initiator)

```typescript
import { FIXClient, fixutil } from 'fixio'

const client = new FIXClient(
  'FIX.4.4',
  'CLIENT_ID',
  'SERVER_ID',
  {}
)

// Connect to server
client.connect(9878, 'localhost')

// Subscribe to connection events
client.logon$.subscribe(() => {
  console.log('Logged on successfully')
  
  // Send a test request
  client.send({
    MsgType: 'D', // New Order Single
    ClOrdID: '12345',
    Symbol: 'EURUSD',
    Side: '1', // Buy
    OrderQty: '1000000',
    OrdType: '2', // Limit
    Price: '1.1850'
  })
})

// Subscribe to incoming messages
client.fixIn$.subscribe(fix => {
  console.log('Received:', fixutil.convertToJSON(fix))
})

// Subscribe to disconnect events
client.close$.subscribe(() => {
  console.log('Connection closed')
})

// Handle errors
client.error$.subscribe(error => {
  console.error('Client error:', error)
})
```

## API Reference

### FIXServer

#### Constructor Options
```typescript
{
  port: number          // TCP port to listen on
  host?: string         // Host address (default: '0.0.0.0')
  protocol?: string     // FIX protocol version (default: 'FIX.4.4')
}
```

#### Observable Streams
- `fixIn$` - Incoming FIX messages
- `fixOut$` - Outgoing FIX messages  
- `logon$` - Client logon events
- `error$` - Error events
- `done$` - Completion events

#### Methods
- `listen()` - Start listening for connections
- `close()` - Close the server
- `getClients()` - Get list of connected clients

### FIXClient

#### Constructor
```typescript
new FIXClient(
  protocol: string,        // e.g., 'FIX.4.4'
  senderCompId: string,    // Your company ID
  targetCompId: string,    // Target company ID
  options: object          // Additional options
)
```

#### Observable Streams
- `fixIn$` - Incoming FIX messages
- `fixOut$` - Outgoing FIX messages
- `logon$` - Successful logon events
- `logout$` - Logout events
- `close$` - Connection close events
- `end$` - Connection end events
- `error$` - Error events

#### Methods
- `connect(port: number, host: string)` - Connect to FIX server
- `logon(options?: object)` - Send logon message
- `send(message: object)` - Send FIX message
- `logout(reason?: string)` - Send logout and disconnect
- `close()` - Close connection

### fixutil

Utility functions for FIX message manipulation:

```typescript
// Convert FIX string to JSON
fixutil.convertToJSON(fixString: string): object

// Convert FIX string to Map
fixutil.convertToMap(fixString: string): Map<string, string>

// Convert object to FIX string
fixutil.convertToFIX(message: object): string

// Generate UTC timestamp
fixutil.getUTCTimeStamp(date?: Date): string

// Calculate checksum
fixutil.getChecksum(message: string): string

// Convert field names to FIX tags
fixutil.convertFieldsToTags(message: object): object
```

## Advanced Usage

### Session Persistence

FIXio automatically persists session state to log files in the `./logs/` directory:

```typescript
// Sessions are automatically restored on reconnection
// Log files: ./logs/{SenderCompID}_{TargetCompID}.log
```

### Custom Message Types

```typescript
// Send custom FIX messages
client.send({
  MsgType: '8',  // Execution Report
  OrderID: '98765',
  ExecID: 'exec123',
  ExecType: '0',  // New
  OrdStatus: '0', // New
  Symbol: 'GBPUSD',
  Side: '2',      // Sell
  OrderQty: '500000',
  LastQty: '0',
  LastPx: '0',
  LeavesQty: '500000',
  CumQty: '0'
})
```

### Reconnection Handling

```typescript
client.close$.subscribe(() => {
  console.log('Disconnected, reconnecting in 5 seconds...')
  setTimeout(() => {
    client.connect(9878, 'localhost')
    client.logon()
  }, 5000)
})
```

### Multi-Client Server

```typescript
const server = new FIXServer({ port: 9878 })

server.logon$.subscribe(({ senderCompId, targetCompId }) => {
  console.log(`Client connected: ${senderCompId} -> ${targetCompId}`)
})

// Broadcast message to all clients
server.getClients().forEach(client => {
  client.send({
    MsgType: '0', // Heartbeat
    // ... other fields
  })
})
```

## Testing

Run the comprehensive test suite:

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test file
npx jest tests/integration.advanced.test.ts
```

### Test Coverage

- **81 tests** covering all core functionality
- Unit tests for utilities, frame decoding, and session handling
- Integration tests for real-world scenarios
- Fast execution (~2-3 seconds for full suite)

## Project Structure

```
fixio/
├── src/
│   ├── FIXServer.ts         # FIX acceptor implementation
│   ├── FIXClient.ts         # FIX initiator implementation
│   ├── fixutils.ts          # Utility functions
│   ├── handlers/
│   │   ├── FIXSession.ts    # Session management
│   │   └── FrameDecoder.ts  # Message frame decoding
│   └── resources/
│       └── fixSchema.ts     # FIX field definitions
├── tests/                   # Comprehensive test suite
└── logs/                    # Session persistence logs
```

## Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run tests in watch mode
npm run test:watch

# Lint code
npm run lint
```

## Docker Support

Use the containerized npm:

```bash
./npm install
./npm test
./npm run build
```

License
=======
Copyright (C) 2025 by Rafal Okninski

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
