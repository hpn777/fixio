"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const FIXClient_1 = require("../FIXClient");
const fixutil = tslib_1.__importStar(require("../fixutils"));
const client = new FIXClient_1.FIXClient("FIXT.1.1", "initiator", "acceptor", { "autologon": false });
client.jsonIn$.subscribe(json => {
    console.log('initiator jsonIn', json);
});
client.jsonOut$.subscribe(json => {
    console.log('initiator jsonOut', json);
});
client.error$.subscribe(e => console.log(e));
client.connect(1234, 'localhost');
client.logon$.subscribe(msg => {
    console.log('got logon: ', msg);
    client.send({
        "35": 'F',
        "41": "15",
        "37": "15",
        "11": "15",
        "48": 'SecurityId_test_1',
        "22": '1',
        "1137": "9",
        "453": 0,
        "54": 1,
        "60": fixutil.getUTCTimeStamp(),
    });
});
client.send({
    '35': 'A',
    '98': '0',
    '108': '10',
    "1137": "9",
    "95": 8,
    "96": '11111111'
});
//# sourceMappingURL=testFIXClient.js.map