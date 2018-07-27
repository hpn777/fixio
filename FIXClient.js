const { Observable, Subject } = require('rxjs/Rx')
const _ = require('lodash')
var net = require('net');
var tls = require('tls');
var fixutil = require('./fixutils.js');
var {FrameDecoder} = require('./handlers/FrameDecoder')
var {FIXSession} = require('./handlers/FIXSession')

exports.fixutil = fixutil;

exports.FIXClient = function(fixVersion, senderCompID, targetCompID, opt) {//{resetSeqNumOnReconect: true}
    var self = this
    var HOST
    var PORT
    opt  = opt || {}
    opt.senderCompID = senderCompID
    opt.targetCompID = targetCompID
    opt.fixVersion = fixVersion
    
    var fixSession = new FIXSession(this, false, opt)
    var frameDecoder = new FrameDecoder()
    var autologon = _.isUndefined(opt.autologon)? true : opt.autologon
    
    self.connect$ = new Subject
    self.logon$ = new Subject
    self.logoff$ = new Subject
    self.fixIn$ = new Subject
    self.dataIn$ = new Subject
    self.jsonIn$ = new Subject
    self.fixOut$ = new Subject
    self.dataOut$ = new Subject
    self.jsonOut$ = new Subject
    self.end$ = new Subject
    self.close$ = new Subject
    self.error$ = new Subject

    self.close$.subscribe(()=>{
        setTimeout(()=>{
            try{
                reconnect()
            }
            catch(ex){}
        }, 5000)
    })

    if(autologon){
        self.connect$.subscribe(()=>{
            self.logon()
        })
    }
    
    this.send = function(fix) { 
        if(self.connection){
            fixSession.send(fix)
        } 
    }
    
    this.connect = function(port, host, isReconnect){
        HOST = host
        PORT = port
        
        var socket
        if(opt.ssl)
            socket = new tls.TLSSocket()
        else{
            socket = new net.Socket()
        }
        self.connection = socket.connect({port: port, host:host})

        if(!isReconnect){
            var logon$ = Observable.fromEvent(fixSession, 'logon')
            logon$.subscribe(self.logon$)

            var logoff$ = Observable.fromEvent(fixSession, 'logoff')
            logoff$.subscribe(self.logoff$)

            var dataOut$ = Observable.fromEvent(fixSession, 'dataOut')
            dataOut$.subscribe(self.dataOut$)

            var fixOut$ = Observable.fromEvent(fixSession, 'fixOut')
            fixOut$.subscribe(self.fixOut$)

            var jsonOut$ = fixOut$.map(fixutil.convertToJSON)
            jsonOut$.subscribe(self.jsonOut$)
        }
                
        var connect$ = Observable.fromEvent(self.connection, 'connect')
        connect$.subscribe(self.connect$)

        var error$ = Observable.fromEvent(self.connection, 'error')
        error$.subscribe(self.error$)

        var end$ = Observable.fromEvent(self.connection, 'end')
        end$.subscribe(self.end$)

        var close$ = Observable.fromEvent(self.connection, 'close')
        close$.subscribe(self.close$)

        var rawIn$ = Observable.fromEvent(self.connection, 'data')
        var fixIn$ = rawIn$
            .flatMap((raw) => { return frameDecoder.decode(raw)})
            .catch((ex)=>{
                self.connection.emit('error', ex)
                return Observable.never()
            })
            .share()
        fixIn$.subscribe(self.fixIn$)
        
        var dataIn$ = fixIn$
            .map((msg) => { return fixSession.decode(msg)})
            .catch((ex)=>{
                self.connection.emit('error', ex)
                return Observable.never()
            })
            .share()
        dataIn$.subscribe(self.dataIn$)
        dataIn$.subscribe()

        var jsonIn$ = fixIn$.map(fixutil.convertToJSON)
        jsonIn$.subscribe(self.jsonIn$)
    }
    
    var reconnect = function () {
    	self.connect(PORT, HOST, true)
    }
    
    this.logon = function (logonmsg) {
        fixSession.logon(logonmsg)
    }

    this.logoff = function (logoffReason) {
        fixSession.logoff(logoffReason)
    }

    this.resetFIXSession = function(clearHistory){
        fixSession.resetFIXSession(clearHistory)
    }
    
    return this
}
