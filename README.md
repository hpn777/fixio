An implementation of the [FIX protocol (Financial Information Exchange)](http://en.wikipedia.org/wiki/Financial_Information_eXchange).

Install
====
```bash
npm install fixio
```

Test
============

You can run tests by:

```bash
npm test
```

API
===

## Server:

```javascript
const { FIXServer } = require("fixio")

const serverOptions = {
  port: 1234,
  host: 'localhost'
}

const server = new FIXServer(serverOptions)
server.jsonIn$.subscribe(json => {
    console.log('jsonIn', json)
})
server.jsonOut$.subscribe(json => {
    console.log('jsonOut', json)
})
server.error$.subscribe(e => console.error(e))
server.listen()
```

## Client:

```javascript
const { FIXClient, fixutil } = require("fixio")

const client = new FIXClient("FIX.4.4", "initiator", "acceptor", {})

client.connect(1234, 'localhost')
client.jsonIn$.subscribe(json => {
    console.log('initiator jsonIn', json)
})
client.jsonOut$.subscribe(json => {
    console.log('initiator jsonOut', json)
})
client.error$.subscribe(e => console.log(e))
```

License
=======
Copyright (C) 2018 by Rafal Okninski

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
