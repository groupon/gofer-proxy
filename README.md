# `gofer-proxy`

A companion to [`gofer`](https://github.com/groupon/gofer)
that allows you to expose service endpoints in an express app.

```bash
npm install --save gofer-proxy
```

### Features

* Removes `callback` parameters from the query to disallow JSONP.
* Hides server and network errors by passing them down the middleware chain.
* Handles both gofer 2.x and gofer 3.x clients.
* Honors all the config & option mappers of the service client.

### Usage

```js
var goferProxy = require('gofer-proxy');

// `MyClient` is a class derived from Gofer
var myClient = new MyClient(config);

// `app` is an expressjs application
app.use('/some/prefix', function (req, res, next) {
  goferProxy(myClient, req, res, next);
});
```
