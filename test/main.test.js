var assert = require('assert')
var http   = require('http')
var Router = require('../')

var s = http.createServer()
var r = new Router(s);

r.next.bend = function () {
  this.send('Bending')
}

r.get('/json').bind(function (req, res, next) {
  next.text(new Buffer('testing'))
})

r.bind(function (request, response, next) {
  next.bend();
})

s.listen(8080);
