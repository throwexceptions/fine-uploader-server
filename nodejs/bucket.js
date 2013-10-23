/*
* Bucket for uploaded files
* ***************************************************************************/
var fs = require('fs'),
    glob = require('glob'),
    path = require('path'),
    mkdirp = require('mkdirp');

function Bucket(settings){
    this.settings = settings;
};

Bucket.prototype.erase = function (uuid, cb) {
    var filePath = path.join(this.settings.savePath, uuid);

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

Bucket.prototype.save = function (file, returnFunction) {

    var self = this;

    function combine(file, cb) {
        var finalPath = path.join(path.dirname(file.savePath), file.uuid);
            chunksPath = path.dirname(file.savePath) + '/' + file.uuid + '_*.part';
        var success = false;
        glob(chunksPath, function (error, paths) {
            var paths = paths.sort(function (a, b) {
                 var re = /_(\d*)\.part$/,
                     aPart, bPart;
                aPart = re.exec(a)[1];
                bPart = re.exec(b)[1];
                return parseInt(aPart) - parseInt(bPart);
            });
            console.log('Combining parts');

            paths.forEach(function(path) {
                var writer = fs.createWriteStream(finalPath, { flags: 'a+' });
                var reader = fs.createReadStream(path);
                reader.on('end', function () {
                    fs.stat(finalPath, function (err, stats) {
                        var currentSize = parseInt(stats.size),
                            expectedSize = parseInt(file.chunkData.totalFileSize)
                        console.log('%d/%d : %%%d', currentSize, expectedSize,
                                   currentSize / expectedSize);
                        if (currentSize >= expectedSize) {
                            success = true;
                            console.log('success')
                        }
                        /*
                        if (parseInt(stats.size) <= parseInt(file.chunkData.totalFileSize)) {
                            console.log('uneqal sizes');
                            fs.unlink(finalPath, function (err) {
                                cb(file, err);
                            });
                        } else {
                            file.finalPath = finalPath;
                            console.log('whole thing is there!');
                            cb(file);
                        }
                        */
                    });
                });
                reader.pipe(writer);
            });
        });
        cb(file);
    }

    function unlinkTemp(file, cb) {
        fs.unlink(file.path, function (err) {
            if (err) {
                console.error(err);
                cb(file, err);
            } else {
                console.log('    temporary file unlinked')
                cb(file);
            }
        })
    }

    function saveFile(file, cb) {
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
                        if (file.chunkData.totalParts > 1) {
                            if (parseInt(file.chunkData.partIndex) + 1 >= parseInt(file.chunkData.totalParts)) {
                                console.log('combobreaker: Part: %d/%d: ',
                                file.chunkData.partIndex,
                                file.chunkData.totalParts);
                                combine(file, function (file) {
                                    unlinkTemp(file, cb)
                                });
                            } else {
                                console.log('    Part: %d/%d: ',
                                file.chunkData.partIndex,
                                file.chunkData.totalParts);
                                unlinkTemp(file, cb);
                            }
                        } else {
                            console.log('  uploaded : %s %skb : %s', file.originalFilename, file.size / 1024 | 0, file.savePath);
                            unlinkTemp(file, cb);
                        }
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
                else saveFile(file, returnFunction);
            });
        } else {
            saveFile(file, returnFunction);
        }
    });
}

module.exports = Bucket;
