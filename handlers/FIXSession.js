var util = require('util');
var fs = require('fs');
var readline = require('readline')
const { Observable } = require('rxjs/Rx');
var storage = require('node-persist');
var fixutil = require('../fixutils.js');
var _  = require('lodash');
var events = require('events');
var sessions = {}

storage.initSync()

exports.FIXSession = function(fixClient, isAcceptor, options) {
    var self = this;
    var isAcceptor = isAcceptor;
    var fixVersion = options.fixVersion;
    var clearStorage = options.clearStorage
    var senderCompID = options.senderCompID;
    var senderSubID = options.senderSubID;
    var targetCompID = options.targetCompID;
    var targetSubID =  options.targetSubID;
    var senderLocationID = options.senderLocationID;
    var key = options.senderCompID + '-' + options.targetCompID

    var isDuplicateFunc = _.isUndefined(options.isDuplicateFunc)? function (senderId, targetId) {
        var key = senderId + '-' + targetId
        return sessions[key] ? sessions[key].isLoggedIn : false
    } : options.isDuplicateFunc;

    var isAuthenticFunc = _.isUndefined(options.isAuthenticFunc)? function () {return true;} : options.isAuthenticFunc;

    var retriveSession = _.isUndefined(options.retriveSession)? function (senderId, targetId) {
        key = senderId + '-' + targetId
        var savedSession = storage.getItemSync(key)

        sessions[key] = savedSession || {'incomingSeqNum': 1, 'outgoingSeqNum': 1}
        sessions[key].isLoggedIn = false //default is always logged out
        return sessions[key]
    } : options.retriveSession;
    
    var saveSession = _.throttle(()=>{
        storage.setItemSync(key, session)
    }, 100)

    var defaultHeartbeatSeconds = _.isUndefined(options.defaultHeartbeatSeconds)? "10" : options.defaultHeartbeatSeconds;

    var sendHeartbeats = _.isUndefined(options.sendHeartbeats)? true : options.sendHeartbeats;
    var expectHeartbeats = _.isUndefined(options.expectHeartbeats)? true : options.expectHeartbeats ;
    var respondToLogon = _.isUndefined(options.respondToLogon)? true : options.respondToLogon;
    var resetSeqNumOnReconect = _.isUndefined(options.resetSeqNumOnReconect) ? true : options.resetSeqNumOnReconect;

    var heartbeatIntervalID;
    var timeOfLastIncoming = new Date().getTime();
    var timeOfLastOutgoing = new Date().getTime();
    var timeOfLastOutgoingHeartbeat = new Date().getTime();
    var testRequestID = 1;
    
    var session = {'incomingSeqNum': 1, 'outgoingSeqNum': 1}
    var isResendRequested = false;
    var isLogoutRequested = false;

    var file = null;
    var fileLogging = _.isUndefined(options.fileLogging) ? true : options.fileLogging

	this.decode = function (raw) {
        timeOfLastIncoming = new Date().getTime();
        
        var fix = fixutil.convertToMap(raw);

        var msgType = fix['35'];

        //==Confirm first msg is logon==
        if (!session.isLoggedIn && (msgType !== 'A' && msgType !== '5')) {
            var error = '[ERROR] First message must be logon:' + raw;
            throw new Error(error)
        }

        //==Process logon 
        else if (!session.isLoggedIn && msgType === 'A') {            
            //==Process acceptor specific logic (Server)
            if (isAcceptor) {
                fixVersion = fix['8'];
                //incoming sender and target are swapped because we want sender/comp
                //from our perspective, not the counter party's
                senderCompID = fix['56']
                senderSubID = fix['50']
                targetCompID = fix['49']
                targetSubID = fix['57']
                //==Check duplicate connections
                if (isDuplicateFunc(senderCompID, targetCompID)) {
                    var error = '[ERROR] Session already logged in:' + raw;
                    throw new Error(error)
                }

                //==Authenticate connection
                if (!isAuthenticFunc(fix, fixClient.connection.remoteAddress)) {
                    var error = '[ERROR] Session not authentic:' + raw;
                    throw new Error(error)
                }
                
                //==Sync sequence numbers from data store
                if(resetSeqNumOnReconect)
                    session =  {'incomingSeqNum': 1, 'outgoingSeqNum': 1}
                else 
                    session = retriveSession(senderCompID, targetCompID)
            } //End Process acceptor specific logic==


            var heartbeatInMilliSecondsStr = _.isUndefined(fix[108] )? defaultHeartbeatSeconds : fix[108];
            var heartbeatInMilliSeconds = parseInt(heartbeatInMilliSecondsStr, 10) * 1000;
            
        	//==Set heartbeat mechanism
            heartbeatIntervalID = setInterval(function () {
            	var currentTime = new Date().getTime();
		
            	//==send heartbeats
            	if (currentTime - timeOfLastOutgoingHeartbeat > heartbeatInMilliSeconds && sendHeartbeats) {
            		self.send({
            			'35': '0'
                    }); //heartbeat
                    timeOfLastOutgoingHeartbeat = new Date().getTime()
            	}

            	//==ask counter party to wake up
            	if (currentTime - timeOfLastIncoming > (heartbeatInMilliSeconds * 1.5) && expectHeartbeats) {
            		self.send({
            			'35': '1',
            			'112': testRequestID++
            		}); //test req id
            	}

            	//==counter party might be dead, kill connection
            	if (currentTime - timeOfLastIncoming > heartbeatInMilliSeconds * 2 && expectHeartbeats) {
            		var error = targetCompID + '[ERROR] No heartbeat from counter party in milliseconds ' + heartbeatInMilliSeconds * 1.5;
                    fixClient.connection.emit('error', error)
                    //throw new Error(error)
            	}

            }, heartbeatInMilliSeconds / 2);

            fixClient.connection.on('close', function () {
                clearInterval(heartbeatIntervalID);
            });

            //==Logon successful
            session.isLoggedIn = true;
            self.emit('logon', targetCompID);
            //==Logon ack (acceptor)
            if (isAcceptor && respondToLogon) {
                self.send(_.extend({}, fix));
            }

        } // End Process logon==
	
        const msgSeqNum = Number(fix['34'])        

        if(msgType !== '4' && msgType !== '5' && fix['43'] !== 'Y'){
            if (msgSeqNum >= requestResendTargetSeqNum) {
                isResendRequested = false;
            }	    
            
            if (msgSeqNum < session.incomingSeqNum && !isResendRequested) {
                var error = '[ERROR] Incoming sequence number ['+msgSeqNum+'] lower than expected [' + session.incomingSeqNum+ ']'
                self.logoff(error)
                throw new Error(error + ' : ' + raw)
            }
            //greater than expected
            else if( msgSeqNum > session.incomingSeqNum && (requestResendTargetSeqNum == 0 || requestResendRequestedSeqNum !== requestResendTargetSeqNum)) {
                self.requestResend(session.incomingSeqNum, msgSeqNum)
            }
        }
	
	    if (msgType !== '4' && (msgSeqNum === session.incomingSeqNum || isResendRequested)) {
            session.incomingSeqNum = msgSeqNum + 1;
        }

        switch(msgType){
            case '1'://==Process test request
                self.send({
                    '35': '0',
                    '112': fix['112']
                });
                break;
            case '2'://==Process resend-request
                self.resendMessages(fix['7'], fix['16']);
                break;
            case '4':
                //==Process sequence-reset
                var resetSeqNo = Number(fix['36'])
                if(resetSeqNo !== NaN){
                    if (resetSeqNo >= session.incomingSeqNum) {
                        if(resetSeqNo > requestResendTargetSeqNum && requestResendRequestedSeqNum !== requestResendTargetSeqNum){
                            session.incomingSeqNum = requestResendRequestedSeqNum + 1
                            isResendRequested = false
                            self.requestResend(session.incomingSeqNum, requestResendTargetSeqNum)
                        }
                        else{
                            session.incomingSeqNum = resetSeqNo
                        }
                    } else {
                        var error = '[ERROR] Seq-reset may not decrement sequence numbers' 
                        // self.logoff(error)
                        //throw new Error(error + ' : ' + raw)
                    }
                } else {
                    var error = '[ERROR] Seq-reset has invalid sequence numbers'
                    self.logoff(error)
                    throw new Error(error + ' : ' + raw)
                }
                break;
            case '5'://==Process logout
                if (!isLogoutRequested){
                    self.send(_.extend({}, fix));

                    if(fix['789'])
                        session.outgoingSeqNum = Number(fix['789'])
		        }

                setImmediate(()=>{fixClient.connection.destroy()})
                session.isLoggedIn = false
		        //self.resetFIXSession(false)
                self.emit('logoff', {senderCompID:senderCompID, targetCompID: targetCompID, logoffReason: fix['58']});
                break;
        }

        saveSession()
		return fix
    }

    this.logon = function (logonmsg) {
        logonmsg = !logonmsg ? { '35': 'A', '90': '0', '108': '10'} : logonmsg;
        
        //==Sync sequence numbers from data store
        if (resetSeqNumOnReconect) 
            session = {'incomingSeqNum': 1, 'outgoingSeqNum': 1}
        else
            session = retriveSession(senderCompID, targetCompID)

        this.send(logonmsg)
    }

    this.logoff = function (logoffReason) {
    	logoffmsg = { 
            '35': 5, 
            '58': logoffReason || 'Graceful close',
            '789': session.incomingSeqNum
        };
        this.send(logoffmsg)
        session.isLoggedIn = false
        isLogoutRequested = true
    }
        
    this.logToFile = function(raw){
        if (file === null) {
            this.logfilename = './traffic/' + senderCompID + '_' + targetCompID + '.log';
            
            try{
        	    fs.mkdirSync('./traffic', { 'flags': 'a+' })
            }
            catch(ex){}
            
            try{
                if(resetSeqNumOnReconect)
                    fs.unlinkSync(this.logfilename);
            }
            catch(ex){}

            file = fs.createWriteStream(this.logfilename, { 'flags': 'a', 'mode': 0666 });
            file.on('error', function (error) { 
                fixClient.connection.emit('error', error) 
            });

            if(fixClient.connection){
                fixClient.connection.on('close', function () {
                    file.close()
		            file = null
                })
            }
        }

		file.write(raw + '\n');
    }

    this.resetFIXSession = function(newSession){
        session = retriveSession(senderCompID, targetCompID)
        if(newSession.incomingSeqNum){
	        session.incomingSeqNum = newSession.incomingSeqNum
            session.isLoggedIn = false
        }

        session.isLoggedIn = false
            
        try{ 
            if(newSession.outgoingSeqNum){
                session.outgoingSeqNum = newSession.outgoingSeqNum
                fs.unlinkSync(this.logfilename)
            }
        }
        catch(ex){}

        saveSession()
    }

    this.resendMessages = function (BeginSeqNo, EndSeqNo) {
    	if (this.logfilename) {
            BeginSeqNo = BeginSeqNo ? Number(BeginSeqNo) : 0
    		EndSeqNo = Number(EndSeqNo) ? Number(EndSeqNo) : (session.outgoingSeqNum -1)
    		var reader = fs.createReadStream(this.logfilename, {
    			'flags': 'r',
    			'encoding': 'binary',
    			'mode': 0666
            })
            var lineReader = readline.createInterface({
                input: reader
            })


            var fillGapBuffer = []
            const sendFillGap = ()=>{
                if(fillGapBuffer.length > 0){
                    self.send({
                        '35': '4',
                        '122': fillGapBuffer[0][52],
                        '123': 'Y',
                        '34': Number(fillGapBuffer[0][34]),
                        '36': Number(fillGapBuffer[fillGapBuffer.length-1][34]) + 1
                    }, true);
                    fillGapBuffer = []
                }
            }

            lineReader.on('line', (line) => {
                var _fix = fixutil.convertToMap(line);
    			var _msgType = _fix[35];
                var _seqNo = Number(_fix[34]);
                if((BeginSeqNo <= _seqNo) && ( EndSeqNo >= _seqNo)){
                    if (_.includes(['A', '5', '2', '0', '1', '4'], _msgType)) {
                        //send seq-reset with gap-fill Y
                        fillGapBuffer.push(_fix)
                        
                        if(EndSeqNo === _seqNo)
                            sendFillGap()
                    } else {
                        //send seq-reset with gap-fill Y
                        sendFillGap()
                        //send msg w/ posdup Y
                        self.send(_.extend(_fix, {
                            '122': _fix[52],
                            '43': 'Y',
                            '34': _seqNo,
			                '36': _seqNo + 1
                        }), true);
                    }
                }
                else if(EndSeqNo < _seqNo){
                    sendFillGap()
                    lineReader.removeAllListeners('line')
                    reader.close()
                }
            })
    	}
    }

    var requestResendRequestedSeqNum = 0 
    var requestResendTargetSeqNum = 0
    this.requestResend = function(start, target){
        requestResendTargetSeqNum = target
        var batchSize = 2000
        if (isResendRequested === false && start < requestResendTargetSeqNum) {
            isResendRequested = true;

            send = (from, to)=>{
                self.send({
                    '35': 2,
                    '7': from,
                    '16': to || 0
                });
            }

            if(target - start <= batchSize){
                requestResendRequestedSeqNum = requestResendTargetSeqNum = 0
                send(start)
            }
            else {
                requestResendRequestedSeqNum = start + batchSize
                send(start, requestResendRequestedSeqNum)
            }
        }
    }

    this.send = function(msg, replay){
        if(!replay){
            msg['369'] = session.incomingSeqNum - 1
        }

        var outgoingSeqNum = replay ? msg['34'] : session.outgoingSeqNum
        var outmsg = fixutil.convertToFIX(msg, fixVersion,  fixutil.getUTCTimeStamp(),
            senderCompID,  targetCompID,  outgoingSeqNum, {senderSubID: senderSubID, targetSubID: targetSubID, senderLocationID: senderLocationID});
        
        self.emit('dataOut', msg)
        self.emit('fixOut', outmsg)

        if(fixClient.connection)
            fixClient.connection.write(outmsg)
            
        if(!replay){
            timeOfLastOutgoing = new Date().getTime()
            session.outgoingSeqNum++
            self.logToFile(outmsg)
            saveSession()
        }
    }
}

util.inherits(exports.FIXSession, events.EventEmitter);
