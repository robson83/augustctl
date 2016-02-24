'use strict';

var augustctl = require('./index');
var express = require('express');
var morgan = require('morgan');
var await = require('asyncawait/await');
var async = require('asyncawait/async');
var config = require(process.env.AUGUSTCTL_CONFIG || './config.json');

var DEBUG = process.env.NODE_ENV !== 'production';
var address = config.address || 'localhost';
var port = config.port || 3000;

var app = express();
app.use(morgan(DEBUG ? 'dev' : 'combined'));

var ret = {'status': -1, 'ret': '', 'msg': ''};

app.get('/api/unlock', function(req, res) {
  var lock = app.get('lock');
  if (!lock) {
    res.sendStatus(503);
    return;
  }


var execStatus = async(function() {

     var status = await(lock.status());

     if(status == 'locked')
     {

          var cmd = await(lock.forceUnlock());
          ret['msg'] = 'Command completed. Disconnected.';
          ret['status'] = 0;
          ret['ret'] = 'unlocked';
          console.log('Released unlock request');

     }
     else
     {   
         ret['status'] = 1;
         ret['msg'] = 'Lock is already unlocked';
         res.json(ret);

     }

    lock.disconnect();
    res.json(ret);
});

  lock.connect().then(function(){

        var exec = execStatus();

   }).catch(function(e) {
      console.error(e.toString());
   });  

});


app.get('/api/lock', function(req, res) {
  var lock = app.get('lock');
  if (!lock) {
    res.sendStatus(503);
    return;
  }


 var execLock = async(function() {
     var status = await(lock.status());

     if(status == 'unlocked')
     {

          var cmd = await(lock.forceLock());
          ret['msg'] = 'Command completed. Disconnected.';
          ret['status'] = 0;
          ret['ret'] = 'locked';
          console.log('Released lock request');

     }
     else
     {   
         ret['status'] = 1;
         ret['msg'] = 'Lock is already locked';

     }

    res.json(ret);
    lock.disconnect();
});

  lock.connect().then(function(){

        var status = execLock();

   }).finally(function(){
      console.log('Finally');
   });  

});


app.get('/api/status', function(req, res){

   var lock = app.get('lock');
   if(!lock) {
      res.sendStatus(503);
      return;
   }

   var execStatus = async(function() {
     var status = await(lock.status());
      ret['ret'] = status;
      ret['status'] = 0;
      ret['msg'] = 'Command completed.';

     console.log('Disconnecting');
     lock.disconnect();

     console.log('Returning');
     res.json(ret);
   });


   lock.connect().then(function() {
      var status = execStatus();
  
   }).finally(function() {
      console.log('Finally');
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
