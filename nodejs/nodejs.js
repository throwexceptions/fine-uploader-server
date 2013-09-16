/**
 * Node.JS server sample file.
 *
 *
 *
 * This code requires external modules, which can be downloaded with the following commands:
 * npm install express
 * npm install jade
 *
 * This code assumes that there is a uploads/ directory for storing the uploaded files, and that the fine-uploader code
 * is available at public/fine-uploader/jquery
 *
 *
 * Based in part on Felix Gertz <dev@felixgertz.de> original example.
 * Original comments follow:
 * Express handles most of the heavy lifting of handling the multipart form parsing - all we have to do is establish an endpoint
 * to handle the incoming file
 *
 * If you are using NginX as reverse proxy, please set this in your server block:
 * client_max_body_size    200M;
 *
 * I don't believe the following is true any longer, as all my testing has been on 8000 - so perhaps needs further validation:
 **
 ** You have to run the server endpoint on port 80,
 ** either by an reverse proxy upstream to this script
 **  or by run this script directly on port 80,
 ** because the ajax upload script can not handle port instruction in the action url correctly. :(
 **
 *
 * @Author: Jeremy Dickens <jeremy@offnominal.com> 2013
 *
 */

var express = require('express'),
    fs = require('fs'),
    path = require('path'),
    mkdirp = require('mkdirp'),
    url = require('url'),
    app = module.exports = express();

// Settings
var settings = {
    nodeHostname: 'localhost',
    nodePort: 8000,
    viewsPath: __dirname + '/views',
    staticPath: __dirname + '/public',
    uploadPath: __dirname + '/uploads/tmp',
    savePath: __dirname + '/uploads/final'
};

mkdirp(settings.uploadPath);
mkdirp(settings.savePath);

// Simple logger
app.use(function (request, response, next) {
    console.log('%s %s', request.method, request.url);
    next();
})

app.set('views', settings.viewsPath);
app.set('view engine', 'jade');

app.use(express.static(settings.staticPath));

app.use(express.bodyParser({ uploadDir: settings.uploadPath }));

app.get('/', function(request, response) {
    response.set('Content-Type', 'text/html');
    response.render('index');
})

function Bucket(){};

Bucket.prototype.erase = function (uuid, cb) {
    var filePath = path.join(settings.savePath, uuid);

    fs.exists(filePath, function (exists) {
        if (exists) {
            var exec = require('child_process').exec,
                child;
            child = exec('rm -rf ' + filePath, function (err, out) {
                if (err) {
                    console.error(err);
                    cb(err);
                }
                else {
                    console.log('  deleted: %s : %s', uuid, filePath);
                    cb();
                }
            });
        } else {
            cb(new Error("Unable to delete. File does not exist anymore!"));
        }
    });

}

Bucket.prototype.save = function (file, cb) {

    var saveFile = function (file) {
        fs.readFile(file.path, function (err, data) {
            if (err) {
                console.error(err);
                cb(file, err);
            } else {
                fs.writeFile(file.savePath, function (err, data) {
                    if (err) {
                        console.error(err);
                        cb(file, err);
                    } else {
                        console.log('  uploaded : %s %skb : %s', file.originalFilename, file.size / 1024 | 0, file.savePath);
                        fs.unlink(file.path, function (err) {
                            if (err) {
                                console.error(err);
                                cb(file, err);
                            }
                            else {
                                cb(file);
                            }
                        })
                    }
                });
            }
        });
    }

    var basePath = path.dirname(file.savePath);
    fs.exists(file.savePath, function (exists) {
        if (!exists) {
            mkdirp(basePath, function (err) {
                if (err) console.error(err);
                else saveFile(file);
            });
        } else {
            saveFile(file);
        }
    });
}

var uploadBucket = new Bucket();

app.post('/upload', function(request, response, next) {
    // the uploadDir is typically used as a temp save location, but we are
    // just going to use the same directory to store the final file.
    var file;

    if (request.params._method && request.params._method === 'DELETE') {
        // we have a DELETE request in disguise.
    }

    response.set('Content-Type', 'text/plain');

    // multipart/form-data request
    if (request.files) {
        file = request.files.qqfile;
        file.name = request.body.qqfilename || '';
        file.uuid = request.body.qquuid || '';
        // @TODO(feltnerm): Investigate why uuid makes fs.write error
        file.savePath = path.join(settings.savePath, file.uuid,  file.name);

        uploadBucket.save(file, function (file, err) {
            if (err) {
                response.send(JSON.stringify({
                    success: false,
                    error: err
                }), {'Content-Type': 'text/plain'}, 200);
            }
            else {
                response.send(JSON.stringify({
                    success: true,
                    file: file,
                }), {'Content-Type': 'text/plain'}, 200);
            }
        });

    }
    else {
        console.log('other kind of request');
        console.dir(request);
    }


});

app.delete('/upload/:uuid', function (request, response, next) {
    var uuid = request.params.uuid;
    response.set('Content-Type', 'text/plain');

    uploadBucket.erase(uuid, function (err) {
        if (err) {
            response.send(JSON.stringify({
                success: false,
                error: err
            }), {'Content-Type': 'text/plain'}, 200);
        }
        else {
            response.send(JSON.stringify({
                success: true,
            }), {'Content-Type': 'text/plain'}, 200);
        }
    });

});

// Starting the express server
app.listen(settings.nodePort, settings.nodeHostname, function () {
    console.log("Express upload server listening on %s:%d.",
        settings.nodeHostname, settings.nodePort);
});
