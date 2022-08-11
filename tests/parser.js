var fixutils = require('../dist/fixutils')

var message = { "35": "D", "49": "1", "56": "n8fix", "34": "2", "50": "1", "52": "20210305-12:00:01.123", "11": "123aBC", "453": [{ "448": "123456", "447": "P", "452": "3", "2376": "23" }, { "448": "3", "447": "P", "452": "12", "2376": "0" }], "48": "222", "22": "8", "54": "2", "60": "20210326-11:30:01.789", "38": "1000", "40": "2", "44": "98", "59": "0", "528": "A", "2593": "1", "2594": "2", "2595": "N", "1724": "5", "1": "ACCTRRU001", "581": "1" }
var fix = fixutils.convertToFIX(message,'fixVersion', 'timeStamp','senderCompID', 'targetCompID', 'outgoingSeqNum', {})
var fixMsg = '8=FIXT.1.19=011835=349=n8_fix_tp56=834=450=057=852=20220811-00:40:47.44445=4371=11372=D373=158=RequiredTagMissing (tag=11)10=111'
// console.log(fix, fixutils.convertToMap(fix))

console.log(fixMsg, fixutils.convertToMap(fixMsg))