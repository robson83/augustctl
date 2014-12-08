'use strict';

var util = require('util');

var LockSession = require('./lock_session');

function SecureLockSession(peripheral, writeCharacteristic, readCharacteristic, offlineKeyOffset) {
  SecureLockSession.super_.call(this, peripheral, writeCharacteristic, readCharacteristic);
  if (!offlineKeyOffset) {
    throw new Error("offline key offset not specified");
  }
  this._offlineKeyOffset = offlineKeyOffset;
  return this;
}

util.inherits(SecureLockSession, LockSession);

SecureLockSession.prototype._cipherSuite = 'aes-128-ecb';
SecureLockSession.prototype._iv = '';

SecureLockSession.prototype.buildCommand = function(opcode) {
  var cmd = new Buffer(0x12);
  cmd.fill(0);
  cmd.writeUInt8(opcode, 0x00);
  cmd.writeUInt8(0x0f, 0x10);   // unknown
  cmd.writeUInt8(this._offlineKeyOffset, 0x11);
  return cmd;
};

// Calculates the security checksum of a command buffer.
function securityChecksum(buffer) {
  return (0 - (buffer.readUInt32LE(0x00) + buffer.readUInt32LE(0x04) + buffer.readUInt32LE(0x08))) >>> 0;
}

SecureLockSession.prototype._writeChecksum = function(command) {
  var checksum = securityChecksum(command);
  command.writeUInt32LE(checksum, 0x0c);
};

SecureLockSession.prototype._validateResponse = function(data) {
  if (securityChecksum(data) !== data.readUInt32LE(0x0c)) {
    throw new Error("security checksum mismatch");
  }
};

module.exports = SecureLockSession;
