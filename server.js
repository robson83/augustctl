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

  lock.connect().then(function(){

		lock.status().then(function(data){

			if(data == 'locked')
			{

				lock.forceUnlock().then(function(response){
				
					ret['msg'] = 'Command completed. Disconnected.';
					ret['status'] = 0;
					ret['ret'] = 'unlocked';					
					res.json(ret);
					
					lock.disconnect();
				
				});


			}
			else
			{
				ret['status'] = 1;
				ret['msg'] = 'Lock is already locked';
				res.json(ret);
				
				lock.disconnect();
			}


		});
	});

});


app.get('/api/lock', function(req, res) {

  var lock = app.get('lock');
  
  if (!lock) {
    res.sendStatus(503);
    return;
  }

  lock.connect().then(function(){

		lock.status().then(function(data){

			if(data == 'unlocked')
			{

				lock.forceLock().then(function(response){
				
					ret['msg'] = 'Command completed. Disconnected.';
					ret['status'] = 0;
					ret['ret'] = 'locked';
					
					res.json(ret);
					
					lock.disconnect();
				
				});


			}
			else
			{
				ret['status'] = 1;
				ret['msg'] = 'Lock is already locked';
				
				res.json(ret);
				
				lock.disconnect();
			}


		});
	})

});


app.get('/api/status', function(req, res){

   var lock = app.get('lock');
   if(!lock) {
      res.sendStatus(503);
      return;
   }

   lock.connect().then(function(){

		lock.status().then(function(data){

				
			ret['msg'] = 'Command completed. Disconnected.';
			ret['status'] = 0;
			ret['ret'] = data;
		
			res.json(ret);
		
			lock.disconnect();
				

		});
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
