# `gofer-proxy`

Allows you to expose service endpoints in an express app.

```js
const goferProxy = require('gofer-proxy');
const myClient = new MyClient(config);
app.use('/some/prefix', (req, res, next) => {
  goferProxy(myClient, req, res, next);
});
```
