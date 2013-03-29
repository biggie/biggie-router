// The MIT License
// 
// Copyright (c) 2011 Tim Smart
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

var defaultHeaders = {};

exports.setDefaultHeaders = function setDefaultHeaders (headers) {
  defaultHeaders = headers;
};

// Easy response methods
exports.mergeDefaultHeaders = function mergeDefaultHeaders (headers) {
  headers = headers || {};
  var keys = Object.keys(defaultHeaders),
      key;
  for (var i = 0, il = keys.length; i < il; i++) {
    key = keys[i];
    headers[key] || (headers[key] = defaultHeaders[key]);
  }

  if (this.response.headers) {
    keys = Object.keys(this.request.headers)

    for (var i = 0, il = keys.length; i < il; i++) {
      key = keys[i]
      headers[key] || (headers[key] = this.request.headers[key])
    }
  }

  if (this.headers) {
    keys = Object.keys(this.headers)

    for (var i = 0, il = keys.length; i < il; i++) {
      key = keys[i]
      headers[key] || (headers[key] = this.headers[key])
    }
  }

  return headers;
};

exports.set = function set (key, value) {
  this.headers || (this.headers = {})
  this.headers[key] = value
  return this
}

exports.sendHead = function sendHead (code, headers, content) {
  if (typeof code !== 'number') {
    content = headers;
    headers = code;
    code = 200;
  }

  headers || (headers = {})
  headers['Date'] || (headers['Date'] = new Date().toUTCString())

  if (content) {
    if (Buffer.isBuffer(content)) {
      headers['Content-Length'] || (headers['Content-Length'] = content.length)
    } else {
      headers['Content-Length'] || (
        headers['Content-Length'] = Buffer.byteLength(content)
      )
    }
  }

  this.mergeDefaultHeaders(headers)

  return this.response.writeHead(code, headers);
};

exports.send = function send (code, content, headers) {
  if (typeof code !== 'number') {
    headers = content;
    content = code;
    code = 200;
  }

  headers || (headers = {})

  if (typeof content === 'string' || content instanceof Buffer) {
    headers['Content-Type'] || (headers['Content-Type'] = 'text/html')
  } else {
    content = JSON.stringify(content);
    headers['Content-Type'] || (headers['Content-Type'] = 'application/json')
  }

  this.sendHead(code, headers, content);
  return this.response.end(content);
};

exports.redirect = function redirect (location, content, headers) {
  headers || (headers = {})
  headers['Location'] = location

  return this.send(302, content, headers);
};

exports.body = function body (code, content, headers) {
  if (typeof code !== 'number') {
    headers = content;
    content = code;
    code = 200;
  }

  this.sendHead(code, headers)
  return this.response.end(content)
};

exports.json = function json (code, data, headers) {
  if (typeof code !== 'number') {
    headers = data;
    data = code;
    code = 200;
  }

  headers || (headers = {})
  headers['Content-Type'] = 'application/json'

  return this.send(code, data, headers);
};

exports.text = function text (code, data, headers) {
  if (typeof code !== 'number') {
    headers = data;
    data = code;
    code = 200;
  }

  headers || (headers = {})
  headers['Content-Type'] = 'text/plain'

  return this.send(code, data, headers);
};
