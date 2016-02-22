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

var ret = {'status': -1, 'ret': '', 'msg': ''};

app.get('/api/unlock', function(req, res) {
  var lock = app.get('lock');
  if (!lock) {
    res.sendStatus(503);
    return;
  }

  lock.connect().then(function(){

        lock.status().then(function(status){

		ret['ret'] = status;

                if(status == 'locked')
                {
                   lock.unlock().then(function() {

			lock.disconnect().then(function() {
                           ret['msg'] = 'Command completed. Disconnected.';
			   ret['status'] = 0;
			   ret['ret'] = 'unlocked';
			   res.json(ret);
               		 });

		   });
                }
		else
		{
			ret['status'] = 1;
			ret['msg'] = 'Lock is already unlocked';
			res.json(ret);
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

        lock.status().then(function(status){

                ret['ret'] = status;

                if(status == 'unlocked')
                {
                   lock.lock().then(function() {

                        lock.disconnect().then(function() {
                           ret['msg'] = 'Command completed. Disconnected.';
                           ret['status'] = 0;
                           ret['ret'] = 'locked';
                           res.json(ret);
                         });

                   });
                }
                else
                {
                        ret['status'] = 1;
                        ret['msg'] = 'Lock is already locked';
                        res.json(ret);
                }


        });

   });

});


app.get('/api/status', function(req, res){

   var lock = app.get('lock');
   if(!lock) {
      res.sendStatus(503);
      return;
   }

   lock.connect().then(function(){

	lock.status().then(function(status){
		ret['ret'] = status;
		ret['status'] = 0; 
		lock.disconnect().then(function() {
      			ret['msg'] = 'Command completed. Disconnected.';
      			res.json(ret);
   		});
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
