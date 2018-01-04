/*
 * Copyright (c) 2014, Groupon, Inc.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 *
 * Redistributions of source code must retain the above copyright notice,
 * this list of conditions and the following disclaimer.
 *
 * Redistributions in binary form must reproduce the above copyright
 * notice, this list of conditions and the following disclaimer in the
 * documentation and/or other materials provided with the distribution.
 *
 * Neither the name of GROUPON nor the names of its contributors may be
 * used to endorse or promote products derived from this software without
 * specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS
 * IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED
 * TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A
 * PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED
 * TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
 * PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
 * LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
 * NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

'use strict';

const url = require('url');

const Bluebird = require('bluebird');
const _ = require('lodash');

function goferProxy(client, req, res, next) {
  const parsed = url.parse(req.url, true);
  const options = {
    method: req.method,
    headers: _.omit(req.headers, 'host', 'accept-encoding'),
    body: req,
    qs: _.omit(parsed.query, 'callback'),
    minStatusCode: 200,
    maxStatusCode: 499,
  };
  const proxyReq = client.fetch(parsed.pathname, options);

  function handleGofer2Stream(requestStream) {
    return new Bluebird(function forward(resolve, reject) {
      requestStream.on('error', reject);
      requestStream.pipe(res);
      requestStream.on('end', resolve);
    });
  }

  function handleGofer3Response(proxyRes) {
    return proxyRes.rawBody().then(function writeBody(resBody) {
      const safeHeaders = _.omit(
        proxyRes.headers,
        'content-encoding',
        'content-length',
        'transfer-encoding'
      );
      safeHeaders['Content-Length'] = resBody.length;
      res.writeHead(proxyRes.statusCode, safeHeaders);
      res.end(resBody);
    });
  }

  const piped =
    typeof proxyReq.pipe === 'function'
      ? handleGofer2Stream(proxyReq)
      : proxyReq.then(handleGofer3Response);
  piped.then(null, next);
}
module.exports = goferProxy;
