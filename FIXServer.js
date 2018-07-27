const { Observable, Subject } = require('rxjs/Rx')
var net = require('net');
var fixutil = require('./fixutils.js');
var {FrameDecoder} = require('./handlers/FrameDecoder')
var {FIXSession} = require('./handlers/FIXSession')

exports.fixutil = fixutil;

exports.FIXServer = function(opt) {
    var self = this
    var HOST
    var PORT
    
    this.fixSessions = {}
    this.connect$ = new Subject
    this.logon$ = new Subject
    this.logoff$ = new Subject
    this.fixIn$ = new Subject
    this.dataIn$ = new Subject
    this.jsonIn$ = new Subject
    this.fixOut$ = new Subject
    this.dataOut$ = new Subject
    this.jsonOut$ = new Subject
    this.end$ = new Subject
    this.close$ = new Subject
    this.error$ = new Subject

    var server = net.createServer(function(connection) {
        var sessionHolder = {}
        const frameDecoder = new FrameDecoder()
        const fixSession = new FIXSession(sessionHolder, true, opt)
        var senderId;

        sessionHolder.connection = connection

        var logon$ = Observable.fromEvent(fixSession, 'logon')
        logon$.subscribe(self.logon$)

        var logoff$ = Observable.fromEvent(fixSession, 'logoff')
        logoff$.subscribe(self.logoff$)
        logoff$.subscribe((x)=>{ delete self.fixSessions[senderId] })

        var dataOut$ = Observable.fromEvent(fixSession, 'dataOut')
        dataOut$.subscribe(self.dataOut$)

        var fixOut$ = Observable.fromEvent(fixSession, 'fixOut')
        fixOut$.subscribe(self.fixOut$)

        var jsonOut$ = fixOut$
            .map((msg) => {
                return {msg: fixutil.convertToJSON(msg), senderId: senderId}
            })
        jsonOut$.subscribe(self.jsonOut$)

        var end$ = Observable.fromEvent(connection, 'end')
            .map((x)=>{ return senderId })
        end$.subscribe(self.end$)
        end$.subscribe((x)=>{ delete self.fixSessions[x] })

        var close$ = Observable.fromEvent(connection, 'close')
            .map((x)=>{ return senderId })
        close$.subscribe(self.close$)
        close$.subscribe((x)=>{ delete self.fixSessions[x] })

        var error$ = Observable.fromEvent(connection, 'error')
            .map((x)=>{ return { error: x, senderId: senderId }})
        error$.subscribe(self.error$)
        
        var rawIn$ = Observable.fromEvent(connection, 'data')
        var fixIn$ = rawIn$
            .flatMap((raw) => { return frameDecoder.decode(raw)})
        fixIn$.subscribe(self.fixIn$)

        var jsonIn$ = fixIn$
            .map((msg) => {
                return {msg: fixutil.convertToJSON(msg), senderId: senderId}
            })
            .catch((ex)=>{
                self.connection.emit('error', ex)
                return Observable.never()}
            )
            .share()
        jsonIn$.subscribe(self.jsonIn$)

        var dataIn$ = fixIn$
            .map((msg) => {
                return {msg: fixSession.decode(msg), senderId: senderId}
            })
            .catch((ex)=>{
                connection.emit('error', ex)
                return Observable.never()}
            )
            .share()
        dataIn$.subscribe(self.dataIn$)

        logon$.subscribe((x) => {
            senderId = x
            self.fixSessions[x] = sessionHolder
        })

        sessionHolder.send = function(fix) { 
            fixSession.send(fix)
        }

        sessionHolder.resetFIXSession = function(){
            fixSession.resetFIXSession()
        }
    })

    this.listen = function(port, host, callback) {
        PORT = port
        HOST = host
        server.listen(port, host, callback);
    }

    this.send = function(targrtId, fix) { 
        const sessionHolder = server.fixSessions[targrtId]
        if(sessionHolder)
            sessionHolder.send(fix)
    }

    this.resetFIXSession = function(targrtId){
        const sessionHolder = server.fixSessions[targrtId]
        if(sessionHolder)
            sessionHolder.resetFIXSession()
    }

    return this
}