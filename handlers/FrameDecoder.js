var fixutil = require('../fixutils.js');
var util = require('util');
var { Observable } = require('rxjs/Rx')
const _ = require('lodash')

//static vars
const SOHCHAR = String.fromCharCode(1)
var re = new RegExp(SOHCHAR, "g")
const ENDOFTAG8 = 10
const STARTOFTAG9VAL = ENDOFTAG8 + 2;
const SIZEOFTAG10 = 8
const ENDOFMSGSTR = SOHCHAR + '10='
//const indexOfTag10SOHCHAR = 7
exports.FrameDecoder = function($){
    var buffer = '';
    var self = this;

    this.decode = (data) => {
        buffer = buffer + data.toString();
        var messages = []
        
        while (buffer.length > 0) {
            //====================================Step 1: Extract complete FIX message====================================

            //If we don't have enough data to start extracting body length, wait for more data
            if (buffer.length <= ENDOFTAG8) {
                return Observable.from(messages)
            }

            var idxOfEndOfTag9 = Number(buffer.substring(ENDOFTAG8).indexOf(SOHCHAR)) + ENDOFTAG8;
            var bodyLength = Number(buffer.substring(STARTOFTAG9VAL, idxOfEndOfTag9));

            var idxOfEndOfTag10 = buffer.indexOf(ENDOFMSGSTR)
            var msgLength = bodyLength + idxOfEndOfTag9 + SIZEOFTAG10

            if(!isNaN(msgLength) && buffer.length >= msgLength){
                //var msgLength = idxOfEndOfTag10 + SIZEOFTAG10;
                var msg = buffer.substring(0, msgLength);
		
                if (msgLength === buffer.length) {
                    buffer = '';
                }
                else {
                    buffer = buffer.substring(msgLength)
                }
            }
            else{//Message received!
                return Observable.from(messages)
            }
            //====================================Step 2: Validate message====================================

            var calculatedChecksum = fixutil.checksum(msg.substr(0, msg.length - 7));
            var extractedChecksum = msg.substr(msg.length - 4, 3);

            if (calculatedChecksum !== extractedChecksum) {
                var error = '[WARNING] Discarding message because body length or checksum are wrong (expected checksum: '
                    + calculatedChecksum + ', received checksum: ' + extractedChecksum + '): [' + msg.replace(re, '|') + ']'
                throw new Error(error)
            }
            
            messages.push(msg)
        }

        return Observable.from(messages)
    }
}
