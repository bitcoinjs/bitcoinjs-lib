'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const networks = require('./networks');
const payments = require('./payments');
const bscript = require('./script');
const types = require('./types');
const bech32 = require('bech32');
const bs58check = require('bs58check');
const typeforce = require('typeforce');
function fromBase58Check(address) {
  const payload = bs58check.decode(address);
  // TODO: 4.0.0, move to "toOutputScript"
  if (payload.length < 21) throw new TypeError(address + ' is too short');
  if (payload.length > 21) throw new TypeError(address + ' is too long');
  const version = payload.readUInt8(0);
  const hash = payload.slice(1);
  return { version, hash };
}
exports.fromBase58Check = fromBase58Check;
function fromBech32(address) {
  const result = bech32.decode(address);
  const data = bech32.fromWords(result.words.slice(1));
  return {
    version: result.words[0],
    prefix: result.prefix,
    data: Buffer.from(data),
  };
}
exports.fromBech32 = fromBech32;
function toBase58Check(hash, version) {
  typeforce(types.tuple(types.Hash160bit, types.UInt8), arguments);
  const payload = Buffer.allocUnsafe(21);
  payload.writeUInt8(version, 0);
  hash.copy(payload, 1);
  return bs58check.encode(payload);
}
exports.toBase58Check = toBase58Check;
function toBech32(data, version, prefix) {
  const words = bech32.toWords(data);
  words.unshift(version);
  return bech32.encode(prefix, words);
}
exports.toBech32 = toBech32;
function fromOutputScript(output, network) {
  // TODO: Network
  network = network || networks.bitcoin;
  try {
    return payments.p2pkh({ output, network }).address;
  } catch (e) {}
  try {
    return payments.p2sh({ output, network }).address;
  } catch (e) {}
  try {
    return payments.p2wpkh({ output, network }).address;
  } catch (e) {}
  try {
    return payments.p2wsh({ output, network }).address;
  } catch (e) {}
  throw new Error(bscript.toASM(output) + ' has no matching Address');
}
exports.fromOutputScript = fromOutputScript;
function toOutputScript(address, network) {
  network = network || networks.bitcoin;
  let decodeBase58;
  let decodeBech32;
  try {
    decodeBase58 = fromBase58Check(address);
  } catch (e) {}
  if (decodeBase58) {
    if (decodeBase58.version === network.pubKeyHash)
      return payments.p2pkh({ hash: decodeBase58.hash }).output;
    if (decodeBase58.version === network.scriptHash)
      return payments.p2sh({ hash: decodeBase58.hash }).output;
  } else {
    try {
      decodeBech32 = fromBech32(address);
    } catch (e) {}
    if (decodeBech32) {
      if (decodeBech32.prefix !== network.bech32)
        throw new Error(address + ' has an invalid prefix');
      if (decodeBech32.version === 0) {
        if (decodeBech32.data.length === 20)
          return payments.p2wpkh({ hash: decodeBech32.data }).output;
        if (decodeBech32.data.length === 32)
          return payments.p2wsh({ hash: decodeBech32.data }).output;
      }
    }
  }
  throw new Error(address + ' has no matching Script');
}
exports.toOutputScript = toOutputScript;
