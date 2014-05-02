var fs = require('fs'),
    path = require('path'),
    url = require('url'),
    mime = require('mime');

exports.index = function(req, res) {
    var pathname = "index.html";
    fileStream(pathname, res);
}

exports.loadFile = function(req, res) {
    var aURL = url.parse(req.url, true);
    var pathname = aURL.pathname;

    fileStream(pathname, res);
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