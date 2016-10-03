'use strict';
var execFile = require('child_process').execFile;

var MOCHA = require.resolve('.bin/mocha');

describe('A test suite using the library', function () {
  ['2', '3'].forEach(function (goferVersion) {
    describe('with gofer@' + goferVersion, function () {
      var exampleDir = 'examples/gofer-' + goferVersion;

      before('install dependencies', function (done) {
        this.timeout(20000);
        var npm = execFile('npm', ['install'], { cwd: exampleDir }, done);
        npm.stdout.pipe(process.stdout);
        npm.stderr.pipe(process.stderr);
      });

      it('passes', function (done) {
        this.timeout(30000);
        var mocha = execFile(MOCHA, { cwd: exampleDir }, done);
        mocha.stdout.pipe(process.stdout);
        mocha.stderr.pipe(process.stderr);
      });
    });
  });
});
