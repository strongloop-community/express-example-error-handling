## Effective error handling in Express
Callbacks have a [lousy error-handling story][1].  Promises [do not][2].  Marry the built-in router error handling in Express with promises, you can kiss those nasty uncaught exceptions goodbye once and for all.

By default, Express will catch any exceptions thrown within the initial *synchronous* execution of the route and pass it along to the next error handling middleware:

```js
app.get(function (req, res) {
  if (req.body.username) {
    throw new Error('Invalid username') // 1
  }
  var username = req.bodu.username // 2
})
app.use(function (err, req, res, next) {
  // handle error
})
```

1. Explicitly thrown exceptions: Invalid username
2. Implicitly thrown exception: `ReferenceError: can't read property username of undefined`

Despite that, as soon as your routes enter asynchronous callbacks, you've lost your stack and errors are uncaught:

```js
app.get(function (req, res) {
  setTimeout(function () {
    throw new Error('Somebody catch me')
  }, 1000)
})
app.use(function (err, req, res, next) {
  // error never gets here
})
```

[1]: http://strongloop.com/strongblog/robust-node-applications-error-handling/
[2]: http://strongloop.com/strongblog/promises-in-node-js-with-q-an-alternative-to-callbacks/