'use strict';

var debug = require('debug')('august:lock');

var Promise = require('bluebird');
var crypto = require('crypto');
var util = require('util');

var LockSession = require('./lock_session');
var SecureLockSession = require('./secure_lock_session');

function Lock(peripheral, offlineKey, offlineKeyOffset) {
  if (!offlineKey) {
    throw new Error('offlineKey must be specified when creating lock');
  }
  if (!offlineKeyOffset) {
    throw new Error('offlineKeyOffset must be specified when creating lock');
  }

  this._peripheral = peripheral;
  this._offlineKey = new Buffer(offlineKey, 'hex');
  this._offlineKeyOffset = offlineKeyOffset;

  debug('peripheral: ' + util.inspect(peripheral));
}

// service uuid, exposed for scanning
Lock.BLE_COMMAND_SERVICE = "fe24";

Lock.prototype.connect = function() {
  var handshakeKeys = crypto.randomBytes(16);
  this._isSecure = false;
  return this._peripheral.connectAsync().then(function() {
    debug('connected.');

    // run discovery; would be quicker if we could skip this step, and on linux writing
    // directly to the appropriate handles seems to work, but unfortunately not on mac.
    // a better approach may very well be some sort of OS level caching (ala Android), or
    // maybe caching services in the noble library.
    return this._peripheral.discoverSomeServicesAndCharacteristicsAsync([ Lock.BLE_COMMAND_SERVICE ], []);
  }.bind(this)).spread(function(services, characteristics) {
    debug('services: ' + util.inspect(services));
    debug('characteristics: ' + util.inspect(characteristics));

    function characteristicByUuid(uuid) {
      for (var i = 0; i < characteristics.length; i++) {
        if (characteristics[i].uuid === uuid) {
          return characteristics[i];
        }
      }
      throw new Error("could not find required characteristic with uuid: " + uuid);
    }

    // initialize the secure session
    this._secureSession = new SecureLockSession(
      this._peripheral,
      characteristicByUuid("bd4ac6130b4511e38ffd0800200c9a66"),
      characteristicByUuid("bd4ac6140b4511e38ffd0800200c9a66"),
      this._offlineKeyOffset
    );
    this._secureSession.setKey(this._offlineKey);

    // intialize the session
    this._session = new LockSession(
      this._peripheral,
      characteristicByUuid("bd4ac6110b4511e38ffd0800200c9a66"),
      characteristicByUuid("bd4ac6120b4511e38ffd0800200c9a66")
    );

    // start the sessions
    return Promise.join(
      this._secureSession.start(),
      this._session.start()
    );
  }.bind(this)).then(function() {
    // send SEC_LOCK_TO_MOBILE_KEY_EXCHANGE
    var cmd = this._secureSession.buildCommand(0x01);
    handshakeKeys.copy(cmd, 0x04, 0x00, 0x08);
    return this._secureSession.execute(cmd);
  }.bind(this)).then(function(response) {
    if (response[0] !== 0x02) {
      throw new Error("unexpected response to SEC_LOCK_TO_MOBILE_KEY_EXCHANGE: " + response.toString('hex'));
    }

    // secure session established
    this._isSecure = true;

    // setup the session key
    var sessionKey = new Buffer(16);
    handshakeKeys.copy(sessionKey, 0x00, 0x00, 0x08);
    response.copy(sessionKey, 0x08, 0x04, 0x0c);
    this._session.setKey(sessionKey);

    // rekey the secure session as well
    this._secureSession.setKey(sessionKey);

    // send SEC_INITIALIZATION_COMMAND
    var cmd = this._secureSession.buildCommand(0x03);
    handshakeKeys.copy(cmd, 0x04, 0x08, 0x10);
    return this._secureSession.execute(cmd);
  }.bind(this)).then(function(response) {
    if (response[0] !== 0x04) {
      throw new Error("unexpected response to SEC_INITIALIZATION_COMMAND: " + response.toString('hex'));
    }
    return true;
  });
};

Lock.prototype.forceLock = function() {
  debug('locking...');
  var cmd = this._session.buildCommand(0x0b);
  return this._session.execute(cmd);
}

Lock.prototype.forceUnlock = function() {
  debug('unlocking...');
  var cmd = this._session.buildCommand(0x0a);
  return this._session.execute(cmd);
}

Lock.prototype.status = function() {

  debug('status...');
  var cmd = new Buffer(0x12);
  cmd.fill(0x00);
  cmd.writeUInt8(0xee, 0x00); // magic
  cmd.writeUInt8(0x02, 0x01);
  cmd.writeUInt8(0x02, 0x04);
  cmd.writeUInt8(0x02, 0x10);

  return this._session.execute(cmd).then(function(response) {
    
    var status = response.readUInt8(0x08);

    var strstatus = 'unknown';
    if (status == 0x03)
      strstatus = 'unlocked';
    else if (status == 0x05)
      strstatus = 'locked';


    return new Promise(function(resolve){
	resolve(strstatus);
    });

  });

};

Lock.prototype.disconnect = function() {
  debug('disconnecting...');

  var disconnect = function() {
    return this._peripheral.disconnectAsync();
  }.bind(this);

  if (this._isSecure) {
    var cmd = this._secureSession.buildCommand(0x05);
    cmd.writeUInt8(0x00, 0x11); // zero offline key for security terminate - not sure if necessary
    return this._secureSession.execute(cmd).then(function(response) {
      if (response[0] !== 0x8b) {
        throw new Error("unexpected response to DISCONNECT: " + response.toString('hex'));
      }
      return true;
    }).finally(disconnect);
  } else {
    return disconnect();
  }
};

module.exports = Lock;
