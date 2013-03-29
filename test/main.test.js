var assert = require('assert')
var http   = require('http')
var Router = require('../')

var s = http.createServer()
var r = new Router(s);

r.next.bend = function () {
  this.send('Bending')
}

r.get('/json').bind(function (req, res, next) {
  next(new Error)
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
