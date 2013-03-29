var assert = require('assert')
var http   = require('http')
var Router = require('../')

var s = http.createServer()
var r = new Router
r.listen(s)

r.next.bend = function () {
  this.send('Bending')
}

r
  .get('/json')
  .bind(function (req, res, next) {
    next(new Error)
  })
  .bind(function (err, req, res, next) {
    next()
  })
  .bind(function (req, res, next) {
    console.log('error handled, passing through...')
    next(new Error)
  })
  .bind(function (req, res, next) {
    next.send('This should never happen')
  })
  .bind(function (err, req, res, next) {
    next.send('handled that error')
  })

r.configure('local', function (router) {
  console.log('Is local environment')
})

r.bind(function (request, response, next) {
  next.bend();
})

r.bind(function test (err, req, res, next) {
  next.send('Got error')
})

s.listen(8080);
