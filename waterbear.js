var fs = require('fs'),
    ws = require('ws'),
    util = require('util'),
    url = require('url'),
    http = require('http'),
    path = require('path'),
    mime = require('mime'),
    vm = require('vm'),
    verify = require('browserid-verify')();

var childprocesses = [];
var audience = "http://localhost:8000";

process.on('SIGINT', function() {
    for (var kid in childprocesses) {
        if (childprocesses.hasOwnProperty(kid)) {
            childprocesses[kid].kill('SIGINT');
        }
    }
    process.exit();
});

var httpServer = http.createServer(function(request, response) {
    var aURL = url.parse(request.url, true);
    var pathname = aURL.pathname;
    var query = JSON.stringify(aURL.query);

    if (pathname === "/") {
        pathname = "index.html";

        var filename = path.join(process.cwd(), 'waterbear', pathname);

        fs.exists(filename, function(exists) {
            if (!exists) {
                response.writeHead(404, {
                    "Content-Type": "text/plain"
                });
                console.log("lolapooza");
                response.write("404 Not Found");
                response.end();
                return;
            }

            response.writeHead(200, {
                'Content-Type': mime.lookup(filename)
            });
            fs.createReadStream(filename, {
                'flags': 'r',
                'encoding': 'binary',
                'mode': 666,
                'bufferSize': 4 * 1024
            }).addListener("data", function(chunk) {
                response.write(chunk, 'binary');
            }).addListener("close", function() {
                response.end();
            });
        });
    } else if (pathname === "/auth/persona") {
        console.log('VERIFYING');
        //console.log('query is: ' + query);

        verify(query, audience, function(err, email, data) {
            console.log('hello! this is a callback');
            if (err) {
                console.log('request to verify failed: ' + err);
                response.writeHead(500, {
                    'Content-Type': 'text/plain'
                });
            }

            if (email) {
                console.log('browserid auth successful, setting req.session.email');
                response.writeHead(200, {
                    'Content-Type': 'text/plain',
                    'Access-Control-Allow-Origin': '*'
                });
            }

            response.end();
        });
    } else {
        var filename = path.join(process.cwd(), 'waterbear', pathname);

        fs.exists(filename, function(exists) {
            if (!exists) {
                response.writeHead(404, {
                    "Content-Type": "text/plain"
                });
                console.log("lolapooza");
                response.write("404 Not Found");
                response.end();
                return;
            }

            response.writeHead(200, {
                'Content-Type': mime.lookup(filename)
            });
            fs.createReadStream(filename, {
                'flags': 'r',
                'encoding': 'binary',
                'mode': 666,
                'bufferSize': 4 * 1024
            }).addListener("data", function(chunk) {
                response.write(chunk, 'binary');
            }).addListener("close", function() {
                response.end();
            });
        });
    }
});

httpServer.listen(8000);

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