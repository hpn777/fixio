const { Observable, Subject } = require('rxjs/Rx')
var net = require('net');
var fixutil = require('./fixutils.js');
var {FrameDecoder} = require('./handlers/FrameDecoder')
var {FIXSession} = require('./handlers/FIXSession')

exports.fixutil = fixutil;

exports.FIXServer = function(opt) {
   
    this.port = opt.port
    this.host = opt.host
    this.options = opt

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

    var server = net.createServer(connection => {
        var sessionHolder = {}
        const frameDecoder = new FrameDecoder()
        const fixSession = new FIXSession(sessionHolder, true, this.options)
        var senderId;

        sessionHolder.connection = connection

        var logon$ = Observable.fromEvent(fixSession, 'logon')
        logon$.subscribe(this.logon$)

        var logoff$ = Observable.fromEvent(fixSession, 'logoff')
        logoff$.subscribe(this.logoff$)
        logoff$.subscribe((x)=>{ delete this.fixSessions[senderId] })

        var dataOut$ = Observable.fromEvent(fixSession, 'dataOut')
        dataOut$.subscribe(this.dataOut$)

        var fixOut$ = Observable.fromEvent(fixSession, 'fixOut')
        fixOut$.subscribe(this.fixOut$)

        var jsonOut$ = fixOut$
            .map((msg) => {
                return {msg: fixutil.convertToJSON(msg), senderId: senderId}
            })
        jsonOut$.subscribe(this.jsonOut$)

        var end$ = Observable.fromEvent(connection, 'end')
            .map(x => senderId )
        end$.subscribe(this.end$)
        end$.subscribe((x)=>{ delete this.fixSessions[x] })

        var close$ = Observable.fromEvent(connection, 'close')
            .map( x => senderId )
        close$.subscribe(this.close$)
        close$.subscribe((x)=>{ delete this.fixSessions[x] })

        var error$ = Observable.fromEvent(connection, 'error')
            .map((x)=>{ return { error: x, senderId: senderId }})
        error$.subscribe(this.error$)
        
        var rawIn$ = Observable.fromEvent(connection, 'data')
        var fixIn$ = rawIn$
            .flatMap(x => frameDecoder.decode(x))
        fixIn$.subscribe(this.fixIn$)

        var jsonIn$ = fixIn$
            .map((msg) => {
                return {msg: fixutil.convertToJSON(msg), senderId: senderId}
            })
            .catch( ex => {
                this.connection.emit('error', ex)
                return Observable.never()}
            )
            .share()
        jsonIn$.subscribe(this.jsonIn$)

        var dataIn$ = fixIn$
            .map( msg => {
                return {msg: fixSession.decode(msg), senderId: senderId}
            })
            .catch(ex => {
                connection.emit('error', ex)
                return Observable.never()
            })
            .share()
        dataIn$.subscribe(this.dataIn$)

        logon$.subscribe((x) => {
            senderId = x
            this.fixSessions[x] = sessionHolder
        })

        sessionHolder.send = function(fix) { 
            fixSession.send(fix)
        }

        sessionHolder.resetFIXSession = function(){
            fixSession.resetFIXSession()
        }
    })

    this.listen = callback => {
        server.listen(this.port, this.host, callback)
    }

    this.send = function(targetId, fix) { 
        const sessionHolder = this.fixSessions[targetId]
        if (sessionHolder) {
            sessionHolder.send(fix)
        }
    }

    this.resetFIXSession = function(targetId){
        const sessionHolder = this.fixSessions[targetId]
        if (sessionHolder) {
            sessionHolder.resetFIXSession()
        }
    }

    return this
}
