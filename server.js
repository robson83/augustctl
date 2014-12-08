'use strict';

var augustctl = require('./index');
var express = require('express');
var morgan = require('morgan');

var config = require(process.env.AUGUSTCTL_CONFIG || './config.json');

var DEBUG = process.env.NODE_ENV !== 'production';
var address = config.address || 'localhost';
var port = config.port || 3000;

var app = express();
app.use(morgan(DEBUG ? 'dev' : 'combined'));

app.get('/api/unlock', function(req, res) {
  var lock = app.get('lock');
  if (!lock) {
    res.sendStatus(503);
    return;
  }

  lock.connect().then(function() {
    return lock.unlock();
  }).finally(function() {
    lock.disconnect();
    // TODO: report errors
    res.sendStatus(204);
  });
});

augustctl.scan(config.lockUuid).then(function(peripheral) {
  var lock = new augustctl.Lock(
    peripheral,
    config.offlineKey,
    config.offlineKeyOffset
  );
  app.set('lock', lock);
});

var server = app.listen(port, address, function() {
  console.log('Listening at %j', server.address());
});
