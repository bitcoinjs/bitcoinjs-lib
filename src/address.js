var Buffer = require('safe-buffer').Buffer
var bech32 = require('bech32')
var bs58check = require('bs58check')
var bcrypto = require('./crypto')
var bscript = require('./script')
var networks = require('./networks')
var typeforce = require('typeforce')
var types = require('./types')

// TODO: refactor
function p2pkhFromHash (hash, network) {
  network = network || networks.bitcoin
  return toBase58Check(hash, network.pubKeyHash)
}

function p2pkhFromKeyPair (keyPair) {
  return p2pkhFromHash(bcrypto.hash160(keyPair.getPublicKeyBuffer()), keyPair.network)
}

function p2shFromHash (hash, network) {
  network = network || networks.bitcoin
  return toBase58Check(hash, network.scriptHash)
}

function p2shFromRedeemScript (script, network) {
  return p2shFromHash(bcrypto.hash160(script), network)
}

function p2wpkhFromHash (hash, network) {
  network = network || networks.bitcoin
  return toBech32(hash, 0x00, network.bech32)
}

function p2wpkhFromKeyPair (keyPair) {
  return p2wpkhFromHash(bcrypto.hash160(keyPair.getPublicKeyBuffer()), keyPair.network)
}

function p2wshFromHash (hash, network) {
  network = network || networks.bitcoin
  return toBech32(hash, 0x00, network.bech32)
}

function p2wshFromWitnessScript (script, network) {
  return p2wshFromHash(bcrypto.sha256(script), network)
}

function fromBase58Check (address) {
  var payload = bs58check.decode(address)

  // TODO: 4.0.0, move to "toOutputScript"
  if (payload.length < 21) throw new TypeError(address + ' is too short')
  if (payload.length > 21) throw new TypeError(address + ' is too long')

  var version = payload.readUInt8(0)
  var hash = payload.slice(1)

  return { version: version, hash: hash }
}

function fromBech32 (address) {
  var result = bech32.decode(address)
  var data = bech32.fromWords(result.words.slice(1))

  return {
    version: result.words[0],
    prefix: result.prefix,
    data: Buffer.from(data)
  }
}

function toBase58Check (hash, version) {
  typeforce(types.tuple(types.Hash160bit, types.UInt8), arguments)

  var payload = Buffer.allocUnsafe(21)
  payload.writeUInt8(version, 0)
  hash.copy(payload, 1)

  return bs58check.encode(payload)
}

function toBech32 (data, version, prefix) {
  var words = bech32.toWords(data)
  words.unshift(version)

  return bech32.encode(prefix, words)
}

function fromOutputScript (outputScript, network) {
  network = network || networks.bitcoin

  if (bscript.pubKeyHash.output.check(outputScript)) return p2pkhFromHash(bscript.compile(outputScript).slice(3, 23), network)
  if (bscript.scriptHash.output.check(outputScript)) return p2shFromHash(bscript.compile(outputScript).slice(2, 22), network)
  if (bscript.witnessPubKeyHash.output.check(outputScript)) return p2wpkhFromHash(bscript.compile(outputScript).slice(2, 22), network)
  if (bscript.witnessScriptHash.output.check(outputScript)) return p2wshFromHash(bscript.compile(outputScript).slice(2, 34), network)

  throw new Error(bscript.toASM(outputScript) + ' has no matching Address')
}

function toOutputScript (address, network) {
  network = network || networks.bitcoin

  var decode
  try {
    decode = fromBase58Check(address)
  } catch (e) {}

  if (decode) {
    if (decode.version === network.pubKeyHash) return bscript.pubKeyHash.output.encode(decode.hash)
    if (decode.version === network.scriptHash) return bscript.scriptHash.output.encode(decode.hash)
  } else {
    try {
      decode = fromBech32(address)
    } catch (e) {}

    if (decode) {
      if (decode.prefix !== network.bech32) throw new Error(address + ' has an invalid prefix')
      if (decode.version === 0) {
        if (decode.data.length === 20) return bscript.witnessPubKeyHash.output.encode(decode.data)
        if (decode.data.length === 32) return bscript.witnessScriptHash.output.encode(decode.data)
      }
    }
  }

  throw new Error(address + ' has no matching Script')
}

module.exports = {
  fromBase58Check: fromBase58Check,
  fromBech32: fromBech32,
  fromOutputScript: fromOutputScript,
  toBase58Check: toBase58Check,
  toBech32: toBech32,
  toOutputScript: toOutputScript,

  pubKeyHash: {
    fromHash: p2pkhFromHash,
    fromKeyPair: p2pkhFromKeyPair
  },
  scriptHash: {
    fromHash: p2shFromHash,
    fromRedeemScript: p2shFromRedeemScript
  },
  witnessPubKeyHash: {
    fromHash: p2wpkhFromHash,
    fromKeyPair: p2wpkhFromKeyPair
  },
  witnessScriptHash: {
    fromHash: p2wshFromHash,
    fromWitnessScript: p2wshFromWitnessScript
  }
}
