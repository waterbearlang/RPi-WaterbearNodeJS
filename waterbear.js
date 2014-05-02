var fs = require('fs'),
    ws = require('ws'),
    util = require('util'),
    http = require('http'),
    path = require('path'),
    mime = require('mime'),
    vm = require('vm'),
    express = require('express'),
    index = require('./routes/index'),
    makeapi = require('./routes/makeapi'),
    auth = require('./routes/auth'),
    passport = require('passport'),
    GitHubStrategy = require('passport-github').Strategy;

var childprocesses = [];
var audience = "http://localhost:8000";

var GITHUB_CLIENT_ID = "001ab661dc3e20b3abd9";
var GITHUB_CLIENT_SECRET = "c9facbedad5815a4766ec27e33e140f018f26e34";

exports.passport = passport;

passport.serializeUser(function(user, done) {
    done(null, user);
});

passport.deserializeUser(function(obj, done) {
    done(null, obj);
});

passport.use(new GitHubStrategy({
        clientID: GITHUB_CLIENT_ID,
        clientSecret: GITHUB_CLIENT_SECRET,
        callbackURL: "http://localhost:8000/auth/github/callback"
    },
    function(accessToken, refreshToken, profile, done) {
        return done(null, profile);
    }));

var app = express();
app.use(express.json());
app.use(express.cookieParser());
app.use(express.session({
    key: 'waterbear',
    secret: 'waterbear'
}));
app.use(passport.initialize());
app.use(passport.session());
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

app.post('/auth/persona', auth.personaAuth(audience));
app.post('/logout', auth.logout);
app.get('/auth/isAuthenticated', auth.isAuthenticated);

app.post('/make/create', makeapi.createMake);
app.post('/make/delete', makeapi.deleteMake);
app.post('/make/update', makeapi.updateMake);

app.get('/auth/github',
    passport.authenticate('github'),
    function(req, res) {

    });
app.get('/auth/github/callback',
    passport.authenticate('github', {
        failureRedirect: '/'
    }),
    function(req, res) {
        res.redirect('/');
    });

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