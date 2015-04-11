# Effective error handling in Express

> tldr; Callbacks have a [lousy error-handling story][1].  Promises [do not][2].  Marry the built-in router error handling in Express with promises, you significantly lower the chances of an uncaught exception.  Promises are native ES6, can be to used with generators, and ES7 proposals like [`async/await`][3] through transpilers like [Babel][4].

This article focuses on effective ways to propagate errors to [error- handling middleware][3] in Express.  I am assuming you *are* propagating errors there. If you are not, it will save you a lot of code duplication to do so.

First, we will look at what you get from Express out of the box and then we will look at using promises, promise generators and ES7 `async/await` to simplify things further.

## Express has built-in synchronous handling
By default, Express will catch any exception thrown within the initial *synchronous* execution of a route and pass it along to the next error-handling middleware:

```js
app.get(function (req, res) {
  throw new Error('oh no!')
})
app.use(function (err, req, res, next) {
  console.log(err.message) // oh no!
})
```

Yet in asynchronous code, Express cannot catch exceptions as you've lost your stack once you have entered a callback:

```js
app.get(function (req, res) {
  queryDb(function (er, data) {
    if (er) throw er
  })
})
app.use(function (err, req, res, next) {
  // error never gets here
})
```

For these cases you use the `next` function to propagate errors:

```js
app.get(function (req, res, next) {
  queryDb(function (err, data) {
    if (err) return next(err)
    // handle data

    makeCsv(function (err, html) {
      if (err) return next(err)
      // handle csv

    })
  })
})
app.use(function (err, req, res, next) {
  // handle error
})
```

Still, this isn't bulletproof. There are two problems with this approach:

1. You must explicitly handle *every* `error` argument.
2. Implicit exceptions aren't handled like trying to access a property that isn't available on the `data` object.

## Asynchronous error propagation with promises

With [promises][2], we can handle any exception (explicit and implicit) within our asynchronous code blocks like Express does for us in synchronous code blocks.  All we need is to add `.catch(next)` to the end of our promise chains.

```js
app.get(function (req, res, next) {
  // do some sync stuff
  queryDb()
    .then(function (data) {
      // handle data
      return makeCsv()
    })
    .then(function (csv) {
      // handle csv
    })
    .catch(next)
})
app.use(function (err, req, res, next) {
  // handle error
})
```

Now all errors asynchronous and synchronous get propagated to the error middleware. Hurrah!

Well almost.  Promises are a decent asynchronous primitive but are still verbose. Despite the welcomed error propagation, we still have to check to make sure we are ending our promise chains with `.catch(next)`.  Let's enhance using promise generators.

## Cleaner code with generators

If you are using [io.js][6] or Node `>=0.12`, we can improve on this workflow using native promise generators[^A].  For this I'm going to pull a utility that makes promise generators called `Bluebird.coroutine`.

> This example uses [bluebird][7] but promise generators exist in all the major promise libraries.

First we need to teach Express about promise generators by creating a little `wrap` function:

```js
var Promise = require('bluebird')
function wrap (genFn) { // 1
    var cr = Promise.coroutine(genFn) // 2
    return function (req, res, next) { // 3
        cr(req, res, next).catch(next) // 4
    }
}
```

The `wrap` function:

1. Takes a generator
2. Teaches it how to yield promises (through `Promise.coroutine`)
3. Returns a normal Express route function
4. When this function executes, it will call the coroutine, catch any errors, and pass them to `next`.

This boilerplate should go away with Express 5 [custom routers][8] but write it once and keep it as a utility.  With it, we can write route functions like this:

```js
app.get(wrap(function *(req, res) {
  var data = yield queryDb()
  // handle data
  var csv = yield makeCsv()
  // handle csv
}))
app.use(function (err, req, res, next) {
  // handle error
})
```

That is pretty clean but if you are feeling daring we can clean up a little more using the ES7 `async/await` proposal.

## Using ES7 async/await

The [`async/await` proposal][3] allows "yielding" of promises like promise generators but as a native construct that works nicely with ES6 classes, arrow functions and object literal extensions.

Until there is Express 5, we still need `wrap` function but it simpler as we don't need `Bluebird.coroutine` or generators.  Below is semantically the same as the previous `wrap` function but with some ES6 goodness:

```js
let wrap = fn => (...args) => fn(...args).catch(next)
```

Then we can make routes like this:

```js
app.get(wrap(async function (req, res) {
  var data = await queryDb()
  // handle data
  var csv = await makeCsv()
  // handle csv
}))
```

Or with arrow functions:

```js
app.get(wrap(async (req, res) => {
  var data = await queryDb()
  // handle data
  var csv = await makeCsv()
  // handle csv
}))
```

Now, to run this code, you will need the [Babel][4] JavaScript compiler.  There are a variety of ways you can use Babel with Node but to keep things simple and straightforward for the purposes of this tutorial, install the `babel-node` command by running:

```sh
npm i babel -g
```

Then run your app using:

```sh
babel-node --stage 0 myapp.js
```

> Bonus: Since this code compiles to ES5, you can use this solution with older versions of Node.

## Throw me a party!

With error handling covered both synchronously and asynchronously you can develop Express code differently.  Mainly, **DO** use `throw`.  The intent of `throw` is clear.  If you use throw it will bypass execution until it hits a `catch`.  In other words, it will behave just like `throw` in synchronous code.  You can use `throw` and `try/catch` meaningfully again with promises, promise generators, and `async/await`.

```js
app.get(wrap(async (req, res) => {
  if (!req.params.id) {
    throw new BadRequestError('Missing Id')
  }
  let companyLogo
  try {
    companyLogo = await getBase64Logo(req.params.id)
  } catch (err) {
    console.error(err)
    companyLogo = genericBase64Logo
  }
}))
```

Also **DO** use [custom error classes][9] as it makes sorting errors out easier within the error middleware.

## Caveats

There are two caveats with this approach that must be mentioned:

1. You must have all your asynchronous code return promises (except emitters).  Raw callbacks simply don't have the facilities for this to work.  This is getting easier as promises are legit now in ES6.  If a particular library does not return promises, it's trivial to convert using a helper function like `Bluebird.promisifyAll`.
2. Event emitters (like streams) can still cause uncaught exceptions.  So make sure you are handling the `error` event properly.

```js
app.get(wrap(async (req, res, next) => {
  let company = await getCompanyById(req.query.id)
  let stream = getLogoStreamById(company.id)
  stream.on('error', next).pipe(res)
}))
```

[1]: http://strongloop.com/strongblog/robust-node-applications-error-handling/
[2]: http://strongloop.com/strongblog/promises-in-node-js-with-q-an-alternative-to-callbacks/
[3]: https://github.com/tc39/ecmascript-asyncawait
[4]: http://babeljs.io
[5]: http://expressjs.com/guide/error-handling.html
[6]: http://iojs.org
[7]: https://github.com/petkaantonov/bluebird
[8]: https://github.com/strongloop/express/pull/2431
[9]: http://dailyjs.com/2014/01/30/exception-error/
[^A]: Generators can also be supported using a JavaScript compiler like Babel. I find the `async/await` more compelling if I am already using a compiler.