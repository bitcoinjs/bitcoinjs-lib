var Buffer = require('safe-buffer').Buffer
var bech32 = require('bech32')
var bs58check = require('bs58check')
var bscript = require('./script')
var networks = require('./networks')
var typeforce = require('typeforce')
var types = require('./types')

function fromBase58Check (address) {
  var payload = bs58check.decode(address)
  if (payload.length < 21) throw new TypeError(address + ' is too short')
  if (payload.length > 21) throw new TypeError(address + ' is too long')

  var version = payload.readUInt8(0)
  var hash = payload.slice(1)

  return { hash: hash, version: version }
}

function fromBech32 (address, expectedPrefix) {
  var result = bech32.decode(address)
  var prefix = result.prefix
  var words = result.words
  if (expectedPrefix !== undefined) {
    if (prefix !== expectedPrefix) throw new Error('Expected ' + expectedPrefix + ', got ' + prefix)
  }

  var version = words[0]
  if (version > 16) throw new Error('Invalid version (' + version + ')')
  var program = bech32.fromWords(words.slice(1))

  if (version === 0) {
    if (program.length !== 20 && program.length !== 32) throw new Error('Unknown program')
  } else {
    if (program.length < 2) throw new Error('Program too short')
    if (program.length > 40) throw new Error('Program too long')
  }

  return { version, prefix, program: Buffer.from(program) }
}

function toBase58Check (hash, version) {
  typeforce(types.tuple(types.Hash160bit, types.UInt8), arguments)

  var payload = Buffer.allocUnsafe(21)
  payload.writeUInt8(version, 0)
  hash.copy(payload, 1)

  return bs58check.encode(payload)
}

function toBech32 (prefix, version, program) {
  if (version > 16) throw new Error('Invalid version (' + version + ')')
  if (version === 0) {
    if (program.length !== 20 && program.length !== 32) throw new Error('Unknown program')
  } else {
    if (program.length < 2) throw new Error('Program too short')
    if (program.length > 40) throw new Error('Program too long')
  }

  var words = bech32.toWords(program)
  words.unshift(version)

  return bech32.encode(prefix, words)
}

function fromOutputScript (outputScript, network) {
  network = network || networks.bitcoin

  if (bscript.pubKeyHash.output.check(outputScript)) return toBase58Check(bscript.compile(outputScript).slice(3, 23), network.pubKeyHash)
  if (bscript.scriptHash.output.check(outputScript)) return toBase58Check(bscript.compile(outputScript).slice(2, 22), network.scriptHash)

  throw new Error(bscript.toASM(outputScript) + ' has no matching Address')
}

function toOutputScript (address, network) {
  network = network || networks.bitcoin

  var decode = fromBase58Check(address)
  if (decode.version === network.pubKeyHash) return bscript.pubKeyHash.output.encode(decode.hash)
  if (decode.version === network.scriptHash) return bscript.scriptHash.output.encode(decode.hash)

  throw new Error(address + ' has no matching Script')
}

module.exports = {
  fromBase58Check: fromBase58Check,
  fromBech32: fromBech32,
  fromOutputScript: fromOutputScript,
  toBase58Check: toBase58Check,
  toBech32: toBech32,
  toOutputScript: toOutputScript
}
