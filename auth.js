var verify = require('browserid-verify')();

exports.personaAuth = function(audience) {

    return function(req, res) {
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

exports.isAuthenticated = function(req, res) {
    if (req.session.email) {
        return res.send(200);
    } else {
        return res.send(400);
    }
}

exports.logout = function(req, res) {
    var aURL = url.parse(req.url, true);
    var pathname = aURL.pathname;

    req.session.destroy();
    return res.send(200);
}