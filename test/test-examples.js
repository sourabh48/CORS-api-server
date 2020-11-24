require('./setup');

var createServer = require('../').createServer;
var assert = require('assert');
var request = require('supertest');

var http = require('http');

describe('Examples', function() {
 
  it('Rewrite proxy URL', function(done) {
    var mycors = createServer();

    var http_server = http.createServer(function(req, res) {
       assert.strictEqual(req.url, '/dummy-for-testing');

     req.url = '/http://example.com';

      mycors.emit('request', req, res);
    });

    request(http_server)
      .get('/dummy-for-testing')
      .expect('Access-Control-Allow-Origin', '*')
      .expect('x-request-url', 'http://example.com/')
      .expect(200, 'Response from example.com', done);
  });

  it('Transform response to uppercase (streaming)', function(done) {
    var mycors = createServer();

    var http_server = http.createServer(function(req, res) {
      var originalWrite = res.write;

      res.write = function(data, encoding, callback) {
        if (Buffer.isBuffer(data)) {
          data = data.toString();
        }

        assert.strictEqual(typeof data, 'string');

        data = data.toUpperCase();

        originalWrite.call(this, data, encoding, callback);
      };

      mycors.emit('request', req, res);
    });

    request(http_server)
      .get('/example.com')
      .expect('Access-Control-Allow-Origin', '*')
      .expect('x-request-url', 'http://example.com/')
      .expect(200, 'RESPONSE FROM EXAMPLE.COM', done);
  });

  it('Transform response to uppercase (buffered)', function(done) {
    var mycors = createServer();

    var http_server = http.createServer(function(req, res) {
      var originalWrite = res.write;
      var originalEnd = res.end;

      var buffers = [];

      res.write = function(data, encoding, callback) {
        assert.ok(Buffer.isBuffer(data) || typeof data === 'string');

        buffers.push(data);
        if (callback) {
          process.nextTick(callback, null);
        }
      };
      res.end = function(data, encoding, callback) {
        if (data) {
          this.write(data, encoding);
        }

        this.write = originalWrite;

         data = buffers.join('');

        data = data.toUpperCase();

       this.end = originalEnd;
        this.end(data, 'utf8', callback);
      };

      mycors.emit('request', req, res);
    });

    request(http_server)
      .get('/example.com')
      .expect('Access-Control-Allow-Origin', '*')
      .expect('x-request-url', 'http://example.com/')
      .expect(200, 'RESPONSE FROM EXAMPLE.COM', done);
  });
});

