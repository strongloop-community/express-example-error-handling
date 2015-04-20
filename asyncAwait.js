import express from 'express'
import testUtils from './testUtils'

let app = express()

let wrap = fn => (...args) => fn(...args).catch(args[2])

app.get('/', wrap(async (req, res) => {
  let result = await testUtils.asyncTaskGood()
  res.write(`${result}\n`)
  await testUtils.asyncTaskBad()
  res.write('will not make it here')
}))

app.use(function (er, req, res, next) {
  res.end(er.message)
})

app.listen(3000)

// output from http://localhost:3000

// Hello World
// oh no!