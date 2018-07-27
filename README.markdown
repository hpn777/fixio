An implementation of the [FIX protocol (Financial Information Exchange)](http://en.wikipedia.org/wiki/Financial_Information_eXchange).

Install
====

    npm install nodeio

Test {Server,Client}
============

You can run a test server:

<pre>
node testFIXServer.js
</pre>

then a test client, too:

<pre>
node testFIXClient.js
</pre>

Both programs should start communicating with each other.  Wait a few seconds to see
heart-beat messages fly by.

API
===

###Server:
```javascript
const {FIXServer} = require("fixio");

const server = new FIXServer({resetSeqNumOnReconect: false})
server.jsonIn$.subscribe((x)=>{if(x.msg.GapFillFlag != 'Y') console.log('jsonIn', x)})
server.jsonOut$.subscribe((x)=>{if(x.msg.GapFillFlag != 'Y') console.log('jsonOut', x)})
server.error$.subscribe((x)=>{console.log(x)})
server.listen(1234, "localhost")
```

###Client:
```javascript
const {FIXClient, fixutil} = require("fixio");

const client = new FIXClient("FIX.4.4", "initiator", "acceptor", { resetSeqNumOnReconect: false })

client.connect(1234,'localhost');
client.jsonIn$.subscribe((response)=>{if(response.GapFillFlag != 'Y') console.log('initiator jsonIn',response)})
client.jsonOut$.subscribe((response)=>{if(response.GapFillFlag != 'Y') console.log('initiator jsonOut',response)})
client.error$.subscribe((x)=>{console.log(x)})
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
