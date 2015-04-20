'use strict'
let express = require('express')
let testUtils = require('./testUtils')

let app = express()

app.get('/', function (req, res, next) {
  testUtils.asyncTaskGood()
    .then(function (result) {
      res.write(`${result}\n`)

      return testUtils.asyncTaskBad()
    })
    .then(function (result) {
      res.write('will not make it here')
    })
    .catch(next)
})

app.use(function (er, req, res, next) {
  res.end(er.message)
})

app.listen(3000)

// output from http://localhost:3000

// Hello World
// oh no!