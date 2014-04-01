var fs = require('fs'),
    ws = require('ws'),
    util = require('util'),
    http = require('http'),
    path = require('path'),
    mime = require('mime'),
    vm = require('vm'),
    express = require('express'),
    index = require('./index');

var childprocesses = [];
var audience = "http://localhost:8000";

var app = express();
app.use(express.json());
app.use(express.cookieParser());
app.use(express.session({
    key: 'waterbear',
    secret: 'waterbear'
}));
app.use(app.router);

process.on('SIGINT', function() {
    for (var kid in childprocesses) {
        if (childprocesses.hasOwnProperty(kid)) {
            childprocesses[kid].kill('SIGINT');
        }
    }
    process.exit();
});

app.get('/', index.index);
app.post('/auth/persona', index.personaAuth(audience));
app.post('/logout', index.logout);
app.get('/isAuthenicated', index.isAuthenticated);
app.post('/make/create', index.createMake);
app.get('*', index.loadFile);

var server = app.listen(8000, function() {
    console.log('Listening on port %d', server.address().port);
});

var WebSocketServer = require('ws').Server;
var wss = new WebSocketServer({
    port: 8080
});
wss.on('connection', function(ws) {

    ws.on('message', function(message) {

        var msg = JSON.parse(message);
        console.log("msg =", msg);

        if (msg.command === "run") {
            if (typeof msg.code !== 'null') {
                var code = msg.code;

                console.log("code =", code);

                fs.writeFile("current.js", code);

                var spawn = require('child_process').spawn,
                    ls = spawn('node', ['current.js']);

                console.log("ls.pid =", ls.pid);

                var reply = JSON.stringify({
                    "type": "running",
                    "pid": ls.pid
                });
                ws.send(reply);


                childprocesses[ls.pid] = ls;

                childprocesses[ls.pid].stdout.on('data', function(data) {
                    console.log('stdout: ' + data);
                    reply = JSON.stringify({
                        "type": "stdout",
                        "pid": ls.pid,
                        "data": data
                    });
                    ws.send(reply);
                });

                childprocesses[ls.pid].stderr.on('data', function(data) {
                    console.log('stderr: ' + data);

                    if (/^execvp\(\)/.test(data)) {
                        reply = JSON.stringify({
                            "type": "error",
                            "pid": ls.pid,
                            "data": data
                        });
                        ws.send(reply);
                    } else {
                        reply = JSON.stringify({
                            "type": "sterr",
                            "pid": ls.pid,
                            "data": data
                        });
                        ws.send(reply);
                    }
                });

                childprocesses[ls.pid].on('exit', function(code) {
                    console.log('childprocesses process exited with code ' + code);
                    if (code === 0) {
                        reply = JSON.stringify({
                            "type": "completed",
                            "pid": ls.pid
                        });
                    } else {
                        reply = JSON.stringify({
                            "type": "exit",
                            "pid": ls.pid,
                            "data": code
                        });
                    }
                    ws.send(reply);
                });

            }
        } else if (msg.command === "kill") {
            if (typeof msg.pid !== 'null') {
                if (typeof childprocesses[msg.pid] !== 'null') {
                    childprocesses[msg.pid].kill('SIGINT');
                }
            }
        }
    });
});