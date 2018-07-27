var moment = require('moment')
var _ = require('lodash')
const { fixRepeatingGroups } = require('./resources/fixSchema')
const { resolveKey } = require('./resources/fixtagnums')

var SOHCHAR = exports.SOHCHAR = String.fromCharCode(1);


exports.setSOHCHAR = function(char){ SOHCHAR = char }

exports.getUTCTimeStamp = function(){ return moment.utc().format('YYYYMMDD-HH:mm:ss.SSS'); }

var checksum = exports.checksum = function(str){
    var chksm = 0;
    for (var i = 0; i < str.length; i++) {
        chksm += str.charCodeAt(i);
    }

    chksm = chksm % 256;

    var checksumstr = '';
    if (chksm < 10) {
        checksumstr = '00' + (chksm + '');
    }
    else if (chksm >= 10 && chksm < 100) {
        checksumstr = '0' + (chksm + '');
    }
    else {
        checksumstr = '' + (chksm + '');
    }

    return checksumstr;
}

//TODO change name to converMapToFIX
var convertRawToFIX = exports.convertRawToFIX = function(map){
    return convertToFIX(map, map[8], map[52], map[49], map[56], map[34], map[50]);
}

var convertToFIX = exports.convertToFIX = function(msgraw, fixVersion, timeStamp, senderCompID, targetCompID, outgoingSeqNum, options){
    //defensive copy
	var msg = msgraw;

    delete msg['9']; //bodylength
    delete msg['10']; //checksum

    var headermsgarr = [];
    var bodymsgarr = [];
    //var trailermsgarr = [];

    headermsgarr.push('35=' + msg['35'] , SOHCHAR);
    headermsgarr.push('52=' + timeStamp , SOHCHAR);
    headermsgarr.push('49=' + (msg['49'] || senderCompID) , SOHCHAR);
    if(options.senderSubID)
        headermsgarr.push('50=' + (msg['50'] || options.senderSubID) , SOHCHAR);
    headermsgarr.push('56=' + (msg['56'] || targetCompID) , SOHCHAR);
    if(options.targetSubID)
        headermsgarr.push('57=' + (msg['57'] || options.targetSubID) , SOHCHAR);
    if(options.senderLocationID)
        headermsgarr.push('142=' + (msg['142'] || options.senderLocationID) , SOHCHAR);
    headermsgarr.push('34=' + outgoingSeqNum , SOHCHAR);

    _.each(msg, (item, tag) => {
        if (['8', '9', '35', '10', '52', '49', '50', '56', '34'].indexOf(tag) === -1 ) {
            if(Array.isArray(item)){
                bodymsgarr.push(tag, '=' , item.length , SOHCHAR)
                item.forEach((group)=>{
                    _.each(group, (item, tag) => {
                        bodymsgarr.push(tag, '=' , item , SOHCHAR)
                    })
                })
            }
            else{
                bodymsgarr.push(tag, '=' , item , SOHCHAR)
            }
        }
    })

    var headermsg = headermsgarr.join('');
    //var trailermsg = trailermsgarr.join('');
    var bodymsg = bodymsgarr.join('');

    var outmsgarr = [];
    outmsgarr.push('8=', msg['8'] || fixVersion, SOHCHAR);
    outmsgarr.push('9=' , (headermsg.length + bodymsg.length) , SOHCHAR);
    outmsgarr.push(headermsg);
    outmsgarr.push(bodymsg);
    //outmsgarr.push(trailermsg);

    var outmsg = outmsgarr.join('');

    outmsg += '10=' + checksum(outmsg) + SOHCHAR;
        
    return outmsg;
}

var convertToKeyvals = function(msg){
    var keyvals = []
    var cursor = 0
    
    while(cursor < msg.length){
        var nextPipe
        var i = cursor
        
        while(true){
            if(msg[i]===SOHCHAR){ 
                nextPipe = i
                break;
            }
            i++
        }
        
        var pair = msg.slice(cursor, nextPipe).split('=')
        keyvals.push(pair)
        cursor = nextPipe + 1
        
        if(pair[0] === '212'){
            var xmlPair = ['213']
            var xmlLength = Number(pair[1]) + 5
            xmlPair[1] = msg.slice(cursor + 4, cursor + xmlLength - 1)
            keyvals.push(xmlPair)
            cursor += xmlLength
        }
    }

    return keyvals
}

var convertToMap = exports.convertToMap = function(msg) {
    var fix = {}
    var keyvals = convertToKeyvals(msg)
    
    var i = 0;
    while( i < keyvals.length ){
        var pair = keyvals[i]
        if(pair.length === 2){
            var repeatinGroup = fixRepeatingGroups[pair[0]]
            if(!repeatinGroup){
                fix[pair[0]] = pair[1]
                i++
            }
            else{
                var nr = Number(pair[1])
                if(nr){
                    var response = repeatingGroupToMap(repeatinGroup, nr, keyvals.slice(i+1))
                    fix[pair[0]] = response.repeatingGroup
                    i += (1 + response.length)
                }
                else{
                    throw new Error('Repeating Group: "' + pair.join('=') + '" is invalid')
                }
            }
        }
        else
            i++
    }

    return fix;
}

var convertToJSON = exports.convertToJSON = function(msg) {
    var fix = {}
    var keyvals = convertToKeyvals(msg)
    
    var i = 0;
    while( i < keyvals.length ){
        var pair = keyvals[i]
        if(pair.length === 2){
            var repeatinGroup = fixRepeatingGroups[pair[0]]
            if(!repeatinGroup){
                fix[resolveKey(pair[0])] = pair[1]
                i++
            }
            else{
                var nr = Number(pair[1])
                if(nr){
                    var response = repeatingGroupToJSON(repeatinGroup, nr, keyvals.slice(i+1))
                    fix[resolveKey(pair[0])] = response.repeatingGroup
                    i += (1 + response.length)
                }
                else{
                    throw new Error('Repeating Group: "' + pair.join('=') + '" is invalid')
                }
            }
        }
        else
            i++
    }

    return fix;
}

var repeatingGroupToMap = function(repeatinGroup, nr, keyvals){
    var response = {repeatingGroup: [], length: 0}
    for(var i = 0, k = 0; i < nr; i++){
        var group = {}
        var index = 0
        while(true){
            if(repeatinGroup.indexOf(keyvals[k][0]) === -1 || (repeatinGroup[0] === keyvals[k][0] && index !== 0)){
                break;
            }
            else{
                group[keyvals[k][0]] = keyvals[k][1]
                ++k
                ++index
            }
        }
        response.repeatingGroup.push(group)
        response.length = k
    }
    return response
}

var repeatingGroupToJSON = function(repeatinGroup, nr, keyvals){
    var response = {repeatingGroup: [], length: 0}
    for(var i = 0, k = 0; i < nr; i++){
        var group = {}
        var index = 0
        
        while(true){
            if(repeatinGroup.indexOf(keyvals[k][0]) === -1 || (repeatinGroup[0] === keyvals[k][0] && index !== 0)){
                break;
            }
            else{
                group[resolveKey(keyvals[k][0])] = keyvals[k][1]
                ++k
                ++index
            }
        }
        response.repeatingGroup.push(group)
        response.length = k
    }
    return response
}