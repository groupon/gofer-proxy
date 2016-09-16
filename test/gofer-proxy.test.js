'use strict';
var http = require('http');
var URL = require('url');

var assert = require('assertive');
var express = require('express');
var Gofer = require('gofer');
var goferVersion = require('gofer/package.json').version;

var goferProxy = require('../');

var IS_GOFER2 = /^2\./.test(goferVersion);

function makeGofer(ctor, name) {
  ctor.prototype = Object.create(Gofer.prototype);
  if (IS_GOFER2) {
    ctor.prototype.serviceName = name;
  }
}

function EchoClient(config) {
  Gofer.call(this, config, IS_GOFER2 ? null : 'echo');
}
makeGofer(EchoClient, 'echo');

EchoClient.prototype.addOptionMapper(function (options) {
  if (options.headers['x-fail-mapper']) {
    throw new Error('OptionMapperError');
  }

  return options;
});

function ProxyClient(config) {
  Gofer.call(this, config, IS_GOFER2 ? null : 'proxy');
}
makeGofer(ProxyClient, 'proxy');

function getResponseWithData(req) {
  if (IS_GOFER2) {
    return req.asPromise().then(function (results) {
      return { response: results[1], data: results[0] };
    });
  }

  return req.then(function (res) {
    return res.rawBody().then(function (body) {
      var str = body.toString();
      return {
        response: res,
        data: str.length ? JSON.parse(str) : str
      };
    });
  });
}

function getJSON(req) {
  if (typeof req.json === 'function') return req.json();
  return req.then();
}

describe('goferProxy', function () {
  var echoClient;
  var proxyClient;

  before('setup echo app', function (done) {
    var echoServer = http.createServer(function (req, res) {
      if (req.url.indexOf('network-error') !== -1) {
        req.socket.destroy();
        return; // ECONNRESET;
      }

      if (req.headers['if-none-match']) {
        res.statusCode = 304;
        res.end();
        return;
      }

      if (req.url.indexOf('server-error') !== -1) {
        res.statusCode = 401;
      }
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('X-Random-Header', 'from-echo');

      var chunks = [];
      req.on('data', function (chunk) { chunks.push(chunk); });
      req.on('end', function () {
        res.end(JSON.stringify({
          method: req.method,
          url: req.url,
          headers: req.headers,
          body: Buffer.concat(chunks).toString('utf8')
        }));
      });
    });

    echoServer.listen(0, function () {
      echoClient = new EchoClient({
        echo: {
          baseUrl: 'http://127.0.0.1:' + echoServer.address().port + '/other/base',
          qs: { client_id: 'some-client-id' }
        }
      });
      done();
    });
  });

  before('setup proxy app', function (done) {
    var proxyApp = express();
    proxyApp.use('/api/v2', function (req, res, next) {
      goferProxy(echoClient, req, res, next);
    });

    proxyApp.use(function (err, req, res, next) { // eslint-disable-line no-unused-vars
      res.statusCode = 500;
      res.json({
        fromErrorMiddleware: true,
        message: err.message,
        code: err.code,
        syscall: err.syscall
      });
    });

    var proxyServer = http.createServer(proxyApp);
    proxyServer.listen(0, function () {
      proxyClient = new ProxyClient({
        proxy: {
          minStatusCode: 200,
          maxStatusCode: 599,
          baseUrl: 'http://127.0.0.1:' + proxyServer.address().port
        }
      });
      done();
    });
  });

  describe('successful request', function () {
    var reqEcho;

    before(function (done) {
      proxyClient.fetch('/api/v2/some/path?x=42', {
        method: 'POST',
        json: { some: { body: 'data' } },
        qs: { more: 'query stuff' }
      }, function (err, data) {
        reqEcho = Buffer.isBuffer(data) ? JSON.parse(data.toString()) : data;
        done(err);
      });
    });

    it('forwards the method', function () {
      assert.equal('POST', reqEcho.method);
    });

    it('removes the middleware mount point from the url', function () {
      var url = URL.parse(reqEcho.url, true);
      assert.equal('/other/base/some/path', url.pathname);
      assert.deepEqual({ client_id: 'some-client-id', x: '42', more: 'query stuff' }, url.query);
    });

    it('forwards the request body', function () {
      assert.equal('{"some":{"body":"data"}}', reqEcho.body);
    });
  });

  it('forwards 304s', function () {
    return getResponseWithData(proxyClient.fetch('/api/v2/not-modified', {
      headers: { 'if-none-match': 'last-etag' }
    })).then(function (results) {
      assert.equal(304, results.response.statusCode);
      assert.equal('', results.data);
    });
  });

  it('forwards headers', function () {
    return getResponseWithData(proxyClient.fetch('/api/v2/not-modified', {
      headers: { 'if-none-match': 'last-etag' }
    })).then(function (results) {
      assert.equal(304, results.response.statusCode);
      assert.equal('', results.data);
    });
  });

  it('fails cleanly with a throwing option mapper', function () {
    return getJSON(proxyClient.fetch('/api/v2/some/path', {
      headers: { 'x-fail-mapper': '1' }
    })).then(function (error) {
      assert.expect(error.fromErrorMiddleware);
      assert.equal('OptionMapperError', error.message);
    });
  });

  it('forwards 4xx', function () {
    return getResponseWithData(proxyClient.fetch('/api/v2/server-error', {
      method: 'POST',
      json: { some: { body: 'data' } },
      qs: { more: 'query stuff' },
      headers: { 'x-my-header': 'header-value' }
    })).then(function (results) {
      assert.equal(401, results.response.statusCode);
      assert.equal('header-value', results.data.headers['x-my-header']);
    });
  });

  it('wraps network errors', function () {
    return getJSON(proxyClient.fetch('/api/v2/network-error', {
      method: 'POST',
      json: { some: { body: 'data' } },
      qs: { more: 'query stuff' }
    })).then(function (error) {
      assert.expect(error.fromErrorMiddleware);
      assert.equal('ECONNRESET', error.code);
    });
  });
});
