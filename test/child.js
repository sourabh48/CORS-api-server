
process.on('uncaughtException', function(e) {
  console.error('Uncaught exception in child process: ' + e);
  console.error(e.stack);
  process.exit(-1);
});

process.memoryUsage();

var heapUsedStart = 0;
function getMemoryUsage(callback) {
  for (var i = 0; i < 6; ++i) {
    global.gc();
  }
  callback(process.memoryUsage().heapUsed);
}

var server;
if (process.argv.indexOf('use-http-instead-of-mycors') >= 0) {
  server = require('http').createServer(function(req, res) { res.end(); });
} else {
  server = require('../').createServer();
}

server.listen(0, function() {
  require('http').get({
    hostname: '127.0.0.1',
    port: server.address().port,
    path: '/http://invalid:99999',
    agent: false,
  }, function() {
    notifyParent();
  });

  function notifyParent() {
    getMemoryUsage(function(usage) {
      heapUsedStart = usage;
      process.send('http://127.0.0.1:' + server.address().port + '/');
    });
  }
});

process.once('message', function() {
  getMemoryUsage(function(heapUsedEnd) {
    var delta = heapUsedEnd - heapUsedStart;
    process.send(delta);
  });
});
