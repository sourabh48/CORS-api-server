var http = require('http');
var path = require('path');
var url = require('url');
var fork = require('child_process').fork;

describe('memory usage', function() {
  var cors_api_url;

  var server;
  var mycors_child;
  before(function(done) {
    server = http.createServer(function(req, res) {
      res.writeHead(200);
      res.end();
    }).listen(0, function() {
      done();
    });
  });

  after(function(done) {
    server.close(function() {
      done();
    });
  });

  beforeEach(function(done) {
    var cors_module_path = path.join(__dirname, 'child');
    var args = [];
    var nodeOptionsArgs = ['--expose-gc'];
    var nodeMajorV = parseInt(process.versions.node, 10);
     if (nodeMajorV >= 11 ||
        nodeMajorV === 10 ||
        nodeMajorV === 8 ||
        nodeMajorV === 6) {
      nodeOptionsArgs.push('--max-http-header-size=60000');
    }
    mycors_child = fork(cors_module_path, args, {
      execArgv: nodeOptionsArgs,
    });
    mycors_child.once('message', function(cors_url) {
      cors_api_url = cors_url;
      done();
    });
  });

  afterEach(function() {
    mycors_child.kill();
  });

  function performNRequests(n, requestSize, memMax, done) {
    var remaining = n;
    var request = url.parse(
        cors_api_url + 'http://127.0.0.1:' + server.address().port);
    request.agent = false; // Force Connection: Close
    request.headers = {
      'Long-header': new Array(requestSize * 1e3).join('x'),
    };
    (function requestAgain() {
      if (remaining-- === 0) {
        mycors_child.once('message', function(memory_usage_delta) {
          console.log('Memory usage delta: ' + memory_usage_delta +
              ' (' + n + ' requests of ' + requestSize + ' kb each)');
          if (memory_usage_delta > memMax * 1e3) {
             throw new Error('Possible memory leak: ' + memory_usage_delta +
                ' bytes was not released, which exceeds the ' + memMax +
                ' kb limit by ' +
                Math.round(memory_usage_delta / memMax / 10 - 100) + '%.');
          }
          done();
        });
        mycors_child.send(null);
        return;
      }
      http.request(request, function() {
        requestAgain();
      }).on('error', function(error) {
        done(error);
      }).end();
    })();
  }

  it('100 GET requests 50k', function(done) {
    performNRequests(100, 50, 1200, done);
  });

  it('1000 GET requests 1k', function(done) {
    this.timeout(1000 * 10);
    performNRequests(1000, 1, 2000, done);
  });
  it('1000 GET requests 50k', function(done) {
    this.timeout(1000 * 10);
    performNRequests(1000, 50, 2000, done);
  });
});
