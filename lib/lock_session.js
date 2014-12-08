'use strict';

var debug = require('debug')('august:lock_session');

var Promise = require('bluebird');
var crypto = require('crypto');
var events = require('events');
var util = require('util');

// promisify noble
Promise.promisifyAll(require('noble/lib/service').prototype);
Promise.promisifyAll(require('noble/lib/peripheral').prototype);
Promise.promisifyAll(require('noble/lib/characteristic').prototype);

function LockSession(peripheral, writeCharacteristic, readCharacteristic) {
  this._peripheral = peripheral;
  this._writeCharacteristic = writeCharacteristic;
  this._readCharacteristic = readCharacteristic;
  return this;
}

util.inherits(LockSession, events.EventEmitter);

LockSession.prototype._cipherSuite = 'aes-128-cbc';
LockSession.prototype._iv = (function() {
  var buf = new Buffer(0x10);
  buf.fill(0);
  return buf;
})();

LockSession.prototype.setKey = function(key) {
  this._encryptCipher = crypto.createCipheriv(this._cipherSuite, key, this._iv);
  this._encryptCipher.setAutoPadding(false);
  this._decryptCipher = crypto.createDecipheriv(this._cipherSuite, key, this._iv);
  this._decryptCipher.setAutoPadding(false);
};

LockSession.prototype.start = function() {
  // decrypt all reads, modifying the buffer in place
  this._readCharacteristic.on('read', function(data) {
    debug('read data: ' + data.toString('hex'));

    if (this._decryptCipher) {
      var cipherText = data.slice(0x00, 0x10);
      var plainText = this._decryptCipher.update(cipherText);
      plainText.copy(cipherText);

      debug('decrypted data: ' + data.toString('hex'));
    }

    this.emit('notification', data);
  }.bind(this));

  // enable indications
  debug('enabling indications on ' + this._readCharacteristic);
  return this._readCharacteristic.notifyAsync(true);
};

LockSession.prototype.buildCommand = function(opcode) {
  var cmd = new Buffer(0x12);
  cmd.fill(0);
  cmd.writeUInt8(0xee, 0x00);   // magic
  cmd.writeUInt8(opcode, 0x01);
  cmd.writeUInt8(0x02, 0x10);   // unknown?
  return cmd;
};

// Calculates the simple checksum of a command buffer.
function simpleChecksum(buf) {
  var cs = 0;
  for (var i = 0; i < 0x12; i++) {
    cs = (cs + buf[i]) & 0xff;
  }
  return (-cs) & 0xff;
}

LockSession.prototype._writeChecksum = function(command) {
  var checksum = simpleChecksum(command);
  command.writeUInt8(checksum, 0x03);
};

LockSession.prototype._validateResponse = function(response) {
  if (simpleChecksum(response) !== 0) {
    throw new Error("simple checksum mismatch");
  }
  if (response[0] !== 0xbb && response[0] !== 0xaa) {
    throw new Error("unexpected magic in response");
  }
};

LockSession.prototype._write = function(command) {
  // NOTE: the last two bytes are not encrypted
  // general idea seems to be that if the last byte of the command indicates an offline key offset (is non-zero), the command is "secure" and encrypted with the offline key
  if (this._encryptCipher) {
    var plainText = command.slice(0x00, 0x10);
    var cipherText = this._encryptCipher.update(plainText);
    cipherText.copy(plainText);
    debug('write (encrypted): ' + command.toString('hex'));
  }

  // write the command to the write characteristic
  return this._writeCharacteristic.writeAsync(command, false);
};

LockSession.prototype.execute = function(command) {
  this._writeChecksum(command);

  debug('execute command: ' + command.toString('hex'));

  // register the notification event listener here, before issuing the write, as the
  // response notification arrives before the write response.
  var waitForNotification = new Promise(function(resolve) {
    this.once('notification', resolve);
  }.bind(this));

  return this._write(command).then(function() {
    debug('write successful, waiting for notification...');
    return waitForNotification;
  }).then(function(data) {
    // perform some basic validation before passing it on
    this._validateResponse(data);

    return data;
  }.bind(this));
};

module.exports = LockSession;
