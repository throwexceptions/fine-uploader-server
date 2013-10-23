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
    http = require('http'),
    path = require('path'),
    mkdirp = require('mkdirp'),
    Bucket = require('./bucket'),
    app = module.exports = express(),
    argv = require('optimist')
        .options('help', {
            default: false,
            describe: 'Get help'
        })
        .options('h', {
            alias: 'hostname',
            default: 'localhost',
            describe: 'Specifiy hostname'
        })
        .options('p', {
            alias: 'port',
            default: 8000,
            describe: 'Specify port'
        })
        .options('c', {
            alias: 'cors',
            default: false,
            describe: "Toggle CORS support"
        })
        .usage("Fine Uploader upload server.\nUsage: $0")
        .argv;

if (argv.help) {
    require('optimist').showHelp();
    process.exit(0);
}

/*
* Application settings and setup
* ***************************************************************************/

// Settings
var settings = {
    nodeHostname: argv.hostname || 'localhost',
    nodePort: argv.port || 8000,
    viewsPath: __dirname + '/views',
    staticPath: __dirname + '/public',
    uploadPath: __dirname + '/uploads/tmp',
    savePath: __dirname + '/uploads/final'
};

var uploadBucket = new Bucket(settings);

// Simple logging middleware
app.use(express.logger('dev'));

app.set('views', settings.viewsPath);
app.set('view engine', 'jade');

app.use(express.static(settings.staticPath));

app.use(express.bodyParser({ uploadDir: settings.uploadPath }));

// by default, Fine Uploader expects a Content-Type of 'text/plain'
// some case call for this to be overriden, but we'll assume that
// this is the response content-type at first.
app.use(function (res, res, next) {
    res.set('Content-Type', 'text/plain');
    next();
});

// To CORS, or not to CORS. That is the question:
if (argv.cors) {
    app.use(require('./cors')());
    app.use(require('./xdomain')(settings));
}

function respond(request, response, data) {

    var status = 200,
        body = data;

    if (body.error) {
       status = 500;
    }

    if (request.xdomain && request.xdomain === true) {
        response.set('Content-Type', 'text/html');
        body.uuid = data.file.uuid;
        body = JSON.stringify(body);
        // @TODO(feltnerm): This is probably hacky.
        var origin = request.get('referer');
        body += "<script src='" + origin + "/js/iframe.xss.response.js'></script>";
    } else {
        response.set('Content-Type', 'text/plain');
        body = JSON.stringify(body);
    }

    response.send(body);

};
/*
* Routes
* ***************************************************************************/
app.get('/', function(request, response) {
    response.set('Content-Type', 'text/html');
    response.render('index');
});

app.post('/upload', function(request, response, next) {
    // the uploadDir is typically used as a temp save location, but we are
    // just going to use the same directory to store the final file.
    var file;

    if (request.body._method && request.body._method === 'DELETE') {
        // we have a DELETE request in disguise!.
        uploadBucket.erase(request.body.qquuid, function (err) {
            if (err) {
                respond(request, response, { success: false, error: err });
            } else {
                respond(request, response, { success: true });
            }
        });
    } else if (request.files) {
        file = request.files.qqfile;
        file.uuid = request.body.qquuid;
        file.name = request.body.qqfilename || 'unknown';
        file.chunkData = {
            partIndex : request.body.qqpartindex || 0,
            partByteOffset : request.body.qqpartbyteoffset || 0,
            totalFileSize : request.body.qqtotalfilesize || 0,
            totalParts : request.body.qqtotalparts || 0,
            chunkSize : request.body.qqchunksize || 0
        };

        if (file.chunkData && file.chunkData.totalParts > 1 ) {
            file.name = file.uuid + '_' + file.chunkData.partIndex + '.part';
        }

        file.savePath = path.join(settings.savePath, file.uuid, file.name);


        uploadBucket.save(file, function (file, err) {
            if (err) {
                respond(request, response, { success: false, error: err });
            } else {
                respond(request, response, {
                    success: true,
                    file: {
                        originalFilename: file.originalFilename,
                        path: file.path,
                        size: file.size,
                        uuid: file.uuid,
                        savePath: file.savePath
                    }
                });
            }
        });

    } else {
        console.error('This request is WEIRD!');
        console.dir(request);
        res.end(401);
    }
});

app.delete('/upload/:uuid', function (request, response, next) {
    var uuid = request.params.uuid;
    response.set('Content-Type', 'text/plain');

    uploadBucket.erase(uuid, function (err) {
        if (err) {
            respond(request, response, { success: false, error: err });
        } else {
            respond({ success: true });
        }
    });

});

http.createServer(app).listen(settings.nodePort, settings.nodeHostname,
    function () {
        console.log("Express upload server listening on %s:%d.",
            settings.nodeHostname, settings.nodePort);
});
