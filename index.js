//
// biggie-router
// 
// The MIT License
// 
// Copyright (c) 2010 Tim Smart
// 
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
// 
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
// 
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.
//

var url      = require('url')
var next_ext = require('./lib/next')
var events   = require('events')
var noop     = function () {}

// The Router prototype
var Router = function Router (server, config) {
  var self = this

  config || (config = {})

  this.env      = config.env || process.env.NODE_ENV || 'development'
  this.routes   = []
  this.headers  = config.headers || { Server : 'node.js' }
  this.next     = next_ext

  this.settings = {}

  next_ext.setDefaultHeaders(this.headers)

  this._onRequest = function _onRequest (request, response) {
    if (self.routes.length === 0) {
      // We got nothing to work with :(
      response.writeHead(404)
      return response.end()
    }

    // Prevent crashes on HEAD requests
    if (request.method === 'HEAD') {
      var old_end = response.end

      response.write = function write(data) {
        return true
      }
      response.end = function end() {
        return old_end.call(response)
      }
    }

    var i = 0

    // One route at a time, unless marked as parallel
    function next(err) {
      ;++i

      if (self.routes[i]) {
        if (err) {
          while (self.routes[i]) {
            if (self.routes[i].errorhandler) {
              return self.routes[i].handle(request, response, next, err)
            }

            ;++i
          }

          return next(err)
        }

        self.routes[i].handle(request, response, next)
      } else {
        if (err) {
          self.emit('error', err)
        } else {
          var err  = new Error('Resource "' + request.url + '" not found.')
          err.code = 404
          err.name = 'Not found'

          self.emit('error', err)
        }
      }
    }
    next.__proto__ = next_ext
    next.response = response
    next.request  = request

    // Get the party started
    self.routes[i].handle(request, response, next)
  }

  this._onError = function _onError (err) {
    self.emit('error', err)
  }
}

Router.next = next_ext

// Extend http.Server
Router.prototype.__proto__ = events.EventEmitter.prototype

// Listen to a server
Router.prototype.listen = function listen (server) {
  server.on('request', this._onRequest)
  server.on('error', this._onError)

  return this
}

// Set a setting
Router.prototype.set = function set (key, value) {
  if (null == value) {
    return this.settings[key]
  }

  this.settings[key] = value

  return this
}

// Configure
Router.prototype.configure = function configure (env, config) {
  if ('function' === typeof env) {
    config = env
    env    = null
  }

  if (!env || this.env === env) {
    config(this)
  }

  return this
}

// Low level api to manually create Route
Router.prototype.createRoute = function createRoute(config) {
  return new Route(this, config)
}

// Set a route as a parallel one
Router.prototype.parallel = function parallel() {
  var route = new Route(this, {
    parallel: true
  })
  this.routes.push(route)
  return route
}

// Proxy method to create a new route with 'bind'
Router.prototype.bind = function bind() {
  var route = new Route(this, {
    catch_all: true
  })
  this.routes.push(route)
  return route.bind.apply(route, arguments)
}

// Creates and proxies a method to the Route prototype
Router.prototype._proxyMethod = function _proxyMethod(verb, args) {
  var route = new Route(this)
  this.routes.push(route)
  return route[verb].apply(route, args)
}

// Proxy method to create a new route with 'all'
Router.prototype.all = function all () {
  return this._proxyMethod('all', arguments)
}

// Proxy method to create a new route with 'get'
Router.prototype.get = function get () {
  return this._proxyMethod('get', arguments)
}

// Proxy method to create a new route with 'post'
Router.prototype.post = function post () {
  return this._proxyMethod('post', arguments)
}

// Proxy method to create a new route with 'put'
Router.prototype.put = function put () {
  return this._proxyMethod('put', arguments)
}

// Proxy method to create a new route with 'patch'
Router.prototype.patch = function patch () {
  return this._proxyMethod('patch', arguments)
}

// Proxy method to create a new route with 'del'
Router.prototype.delete = function _delete () {
  return this._proxyMethod('del', arguments)
}

// Proxy method to create a new route with 'options'
Router.prototype.options = function options() {
  return this._proxyMethod('options', arguments)
}

// The Route prototype
var Route = function Route(router, config) {
  this.router = router

  // The default config
  this.parallel     = false
  this.catchall     = false
  this.errorhandler = false
  this.parse        = this.router.parse

  // The route table
  this.table = {
    GET: [],
    POST: [],
    PUT: [],
    PATCH: [],
    DELETE: [],
    OPTIONS: []
  }

  this.errorhandlers = []

  // The processing layers
  this.layers = []
  this.length = 0

  // Proxy the config over
  if (config) {
    var self = this
    var keys = Object.keys(config)

    for (var i = 0, il = keys.length; i < il; i++) {
      self[keys[i]] = config[keys[i]]
    }
  }
}

// The proxy for routes. Check for a match, then pass through
// the other stuff in order.
Route.prototype.handle = function handle(request, response, callback, error) {
  if (this.parallel && callback) {
    callback()
    callback = noop
  }

  var method = request.method,
      self   = this,
      match  = false,
      i      = 0

  if (method === 'HEAD') {
    // HEAD requests aren't allowed a body, but are
    // treated like a GET request
    method = 'GET'
  }

  if (this.catch_all === true) {
    match = true
  } else if (this.parse) {
    match = this.parse(request)
  } else {
    var lower_path = request.url.toLowerCase(),
        j          = 0,
        length     = this.table[method].length,
        route

    for (; j < length; j++) {
      route = this.table[method][j]
      if (route instanceof RegExp) {
        var temp_match
        if (temp_match = lower_path.match(route)) {
          // TODO: Remove shift. Use queue?
          temp_match.shift()
          // Keep a reference to the last regexp match
          match = temp_match
        }
      } else if (route === lower_path) {
        match = true
      }
    }
  }

  if (match && 1 === self.length) {
    function next (err) {
      return callback(err)
    }

    var layer = self.layers[0]

    // Add __proto__ methods.
    next.__proto__ = next_ext
    next.response  = response
    next.request   = request

    // Matches
    if ('object' === typeof match) {
      next.match = match
    } else {
      next.match = null
    }

    if (self.errorhandler) {
      layer(error, request, response, next)
    } else {
      layer(request, response, next)
    }
  } else if (match) {
    // We have a match! Time to go through the processing layers
    function next (err) {
      if (err && !self.errorhandler) {
        return callback(err)
      }

      var layer   = self.layers[i++]
      var handled = true

      if (layer) {
        // Catch layer errors
        try {
          if (4 === layer.length) layer(err, request, response, next)
          else if (!err)          layer(request, response, next)
          else                    handled = false
        } catch (error) {
          return next(error)
        }

        if (!handled) next(err)
      } else {
        return callback(err)
      }
    }

    // Add __proto__ methods.
    next.__proto__ = next_ext
    next.response  = response
    next.request   = request

    // Matches
    if ('object' === typeof match) {
      next.match = match
    } else {
      next.match = null
    }

    // Start the processing madness
    next(error)
  } else if (callback) {
    callback()
  }

  return this
}

// Private: Checks to see whether we can use the route
Route.prototype._checkRoute = function _checkRoute(route) {
  if (route instanceof RegExp) {
    return true
  } else if (typeof route === 'string') {
    return true
  }
  log('Warning: The route "' + route + '" was of unrecognised type.')
  return false
}

// bind: A simple processing layer
Route.prototype.bind = function bind(fn) {
  if (typeof fn === 'function') {
    this.layers.push(fn)
    ;++this.length

    if (4 === fn.length) {
      this.errorhandler = true
      this.errorhandlers.push(fn)
    }
  } else {
    log('Warning: bind only accepts functions.')
  }
  return this
}

// all: Serves all types of request
Route.prototype.all = function all(route) {
  if (this._checkRoute(route)) {
    this.table.GET.push(route)
    this.table.POST.push(route)
    this.table.PUT.push(route)
    this.table.PATCH.push(route)
    this.table.DELETE.push(route)
    this.table.OPTIONS.push(route)
  }
  return this
}

// Shortcut to add route
Route.prototype._addRoute = function _addRoute(verb, route) {
  if (this._checkRoute(route)) {
    this.table[verb].push(route)
  }
  return this
}

// get: Matches against get requests
Route.prototype.get = function get (route) {
  return this._addRoute('GET', route)
}

// post: Matches against post requests
Route.prototype.post = function post (route) {
  return this._addRoute('POST', route)
}

// put: Matches against put requests
Route.prototype.put = function put (route) {
  return this._addRoute('PUT', route)
}

// patch: Matches against patch requests
Route.prototype.patch = function patch (route) {
  return this._addRoute('PATCH', route)
}

// del: Matches against delete requests
Route.prototype.delete = function _delete (route) {
  return this._addRoute('DELETE', route)
}

// options: Matches against options requests
Route.prototype.options = function options (route) {
  return this._addRoute('OPTIONS', route)
}

module.exports = Router
