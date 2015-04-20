'use strict'
let express = require('express')
let testUtils = require('./testUtils')
let Promise = require('bluebird')

let app = express()

function wrap (genFn) {
  var cr = Promise.coroutine(genFn)
  return function (req, res, next) {
    cr(req, res, next).catch(next)
  }
}

app.get('/', wrap(function *(req, res) {
  let result = yield testUtils.asyncTaskGood()
  res.write(`${result}\n`)
  yield testUtils.asyncTaskBad()
  res.write('will not make it here')
}))

app.use(function (er, req, res, next) {
  res.end(er.message)
})

app.listen(3000)

// output from http://localhost:3000

// Hello World
// oh no!