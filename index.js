var fs = require('fs'),
    verify = require('browserid-verify')(),
    path = require('path'),
    url = require('url'),
    mime = require('mime'),
    makeapi = require('makeapi-client')({
        apiURL: "http://localhost:5000",
        hawk: {
            key: "00000000-0000-0000-000000000000",
            id: "00000000-0000-0000-000000000000"
        }
    });

exports.index = function(req, res) {
    var pathname = "index.html";
    fileStream(pathname, res);
}

exports.loadFile = function(req, res) {
    var aURL = url.parse(req.url, true);
    var pathname = aURL.pathname;

    fileStream(pathname, res);
}

exports.personaAuth = function(audience) {

    return function(req, res) {
        var aURL = url.parse(req.url, true);
        var pathname = aURL.pathname;
        var assertion = req.query.assertion;

        verify(assertion, audience, function(err, email, data) {
            if (err) {
                return res.send(500, {
                    status: 'failure',
                    reason: '' + err
                });
            }

            console.log(assertion);
            if (email) {
                console.log("logged in");
                req.session.email = email;
                return res.send(200);
            }

            return res.send(403, data);
        });
    }
}

exports.logout = function(req, res) {
    var aURL = url.parse(req.url, true);
    var pathname = aURL.pathname;

    req.session.destroy();
    return res.send(200);
}

exports.isAuthenticated = function(req, res) {
    if (req.session.email) {
        return res.send(200);
    } else {
        return res.send(400);
    }
}

exports.createMake = function(req, res) {

    makeapi.create({
        maker: req.body.email,
        make: req.body
    }, function(err, newMake) {
        if (err) {
            console.log(err);
            res.send(400);
        } else {
            console.log(newMake);
            res.send(200);
        }
    });
}

function fileStream(pathname, res) {
    var filename = path.join(process.cwd(), 'waterbear', pathname);

    fs.exists(filename, function(exists) {
        if (!exists) {
            console.log("sup");
            res.status(404).set({
                "Content-Type": "text/plain"
            });
            res.send("404 Not Found");
            return;
        }

        res.status(200).set({
            'Content-Type': mime.lookup(filename)
        });

        fs.createReadStream(filename, {
            'flags': 'r',
            'encoding': 'binary',
            'mode': 666,
            'bufferSize': 4 * 1024
        }).addListener("data", function(chunk) {
            res.write(chunk, 'binary');
        }).addListener("close", function() {
            res.end();
        });
    });
}