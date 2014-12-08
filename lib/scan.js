'use strict';

var Promise = require('bluebird');
var noble = require('noble');

var Lock = require('./lock');

var firstRun = true;

function scan(uuid) {
  if (firstRun) {
    firstRun = false;

    noble.on('stateChange', function(state) {
      if (state === 'poweredOn') {
        noble.startScanning([ Lock.BLE_COMMAND_SERVICE ]);
      } else {
        noble.stopScanning();
      }
    });
  }

  return new Promise(function(resolve) {
    noble.on('discover', function(peripheral) {
      if (uuid === undefined || peripheral.uuid === uuid) {
        noble.stopScanning();
        resolve(peripheral);
      }
    });
  });
}

module.exports = scan;
