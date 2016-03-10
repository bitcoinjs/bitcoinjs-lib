var bs58check = require('bs58check')
var bscript = require('./script')
var networks = require('./networks')
var typeforce = require('typeforce')
var types = require('./types')

function fromBase58Check (address) {
  var payload = bs58check.decode(address)

  var version = payload[0]
  var hash = payload.slice(1)
  var segWitVersion
  var segWitPadding

  if (hash.length === 22 || hash.length === 34) {
    segWitVersion = hash.readUInt8(0)
    segWitPadding = hash.readUInt8(1)
    hash = hash.slice(2)

    if (segWitVersion > 16 || segWitPadding !== 0) {
      throw new Error(address + ' has the length of a segWit address, but is not a valid segWit address')
    }
  } else if (hash.length > 20) throw new Error(address + ' is too long')
  else if (hash.length < 20) throw new Error(address + ' is too short')

  return { hash: hash, version: version, segWitVersion: segWitVersion }
}

function fromOutputScript (scriptPubKey, network) {
  network = network || networks.bitcoin

  if (bscript.isPubKeyHashOutput(scriptPubKey)) return toBase58Check(bscript.compile(scriptPubKey).slice(3, 23), network.pubKeyHash)
  if (bscript.isScriptHashOutput(scriptPubKey)) return toBase58Check(bscript.compile(scriptPubKey).slice(2, 22), network.scriptHash)
  if (bscript.isSegWitPubKeyHashOutput(scriptPubKey)) return toBase58Check(bscript.compile(scriptPubKey).slice(2, 22), network.segWitPubKeyHash, 0)
  if (bscript.isSegWitScriptHashOutput(scriptPubKey)) return toBase58Check(bscript.compile(scriptPubKey).slice(2, 34), network.segWitScriptHash, 0)

  throw new Error(bscript.toASM(scriptPubKey) + ' has no matching Address')
}

function toBase58Check (hash, version, segWitVersion) {
  var payload
  var isSegWit = typeof segWitVersion !== 'undefined'

  typeforce(types.tuple((isSegWit ? types.oneOf(types.Hash160bit, types.Hash256bit) : types.Hash160bit), types.UInt8, types.maybe(types.UInt8)), arguments)

  if (isSegWit) {
    payload = new Buffer(3 + hash.length) // dynamic size based on hash because of difference between P2WPKH and P2WSH
    payload.writeUInt8(version, 0)
    payload.writeUInt8(segWitVersion, 1)
    payload.writeUInt8(0, 2) // padding byte to make pretty prefixes
    hash.copy(payload, 3)
  } else {
    payload = new Buffer(21)
    payload.writeUInt8(version, 0)
    hash.copy(payload, 1)
  }

  return bs58check.encode(payload)
}

function toOutputScript (address, network) {
  network = network || networks.bitcoin

  var decode = fromBase58Check(address)

  if (decode.version === network.pubKeyHash) return bscript.pubKeyHashOutput(decode.hash)
  if (decode.version === network.scriptHash) return bscript.scriptHashOutput(decode.hash)
  if (decode.version === network.segWitPubKeyHash) {
    if (decode.segWitVersion === 0) {
      if (decode.hash.length === 20) {
        return bscript.segWitPubKeyHashOutput(decode.hash)
      }
    }
  }
  if (decode.version === network.segWitScriptHash) {
    if (decode.segWitVersion === 0) {
      if (decode.hash.length === 32) {
        return bscript.segWitScriptHashOutput(decode.hash)
      }
    }
  }

  throw new Error(address + ' has no matching Script')
}

module.exports = {
  fromBase58Check: fromBase58Check,
  fromOutputScript: fromOutputScript,
  toBase58Check: toBase58Check,
  toOutputScript: toOutputScript
}
