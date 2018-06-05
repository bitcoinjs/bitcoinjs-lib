let lazy = require('./lazy')
let typef = require('typeforce')
let OPS = require('bitcoin-ops')
let ecc = require('tiny-secp256k1')

let baddress = require('../address')
let bcrypto = require('../crypto')
let bscript = require('../script')
let BITCOIN_NETWORK = require('../networks').bitcoin

let EMPTY_BUFFER = Buffer.alloc(0)

// witness: {signature} {pubKey}
// input: <>
// output: OP_0 {pubKeyHash}
function p2wpkh (a, opts) {
  if (
    !a.address &&
    !a.hash &&
    !a.output &&
    !a.pubkey &&
    !a.witness
  ) throw new TypeError('Not enough data')
  opts = opts || { validate: true }

  typef({
    address: typef.maybe(typef.String),
    hash: typef.maybe(typef.BufferN(20)),
    input: typef.maybe(typef.BufferN(0)),
    network: typef.maybe(typef.Object),
    output: typef.maybe(typef.BufferN(22)),
    pubkey: typef.maybe(ecc.isPoint),
    signature: typef.maybe(bscript.isCanonicalScriptSignature),
    witness: typef.maybe(typef.arrayOf(typef.Buffer))
  }, a)

  let _address = lazy.value(function () { return baddress.fromBech32(a.address) })

  let network = a.network || BITCOIN_NETWORK
  let o = { network }

  lazy.prop(o, 'address', function () {
    if (!o.hash) return
    return baddress.toBech32(o.hash, 0x00, network.bech32)
  })
  lazy.prop(o, 'hash', function () {
    if (a.output) return a.output.slice(2, 22)
    if (a.address) return _address().data
    if (a.pubkey || o.pubkey) return bcrypto.hash160(a.pubkey || o.pubkey)
  })
  lazy.prop(o, 'output', function () {
    if (!o.hash) return
    return bscript.compile([
      OPS.OP_0,
      o.hash
    ])
  })
  lazy.prop(o, 'pubkey', function () {
    if (a.pubkey) return a.pubkey
    if (!a.witness) return
    return a.witness[1]
  })
  lazy.prop(o, 'signature', function () {
    if (!a.witness) return
    return a.witness[0]
  })
  lazy.prop(o, 'input', function () {
    if (!o.witness) return
    return EMPTY_BUFFER
  })
  lazy.prop(o, 'witness', function () {
    if (!a.pubkey) return
    if (!a.signature) return
    return [a.signature, a.pubkey]
  })

  // extended validation
  if (opts.validate) {
    let hash
    if (a.address) {
      if (network && network.bech32 !== _address().prefix) throw new TypeError('Network mismatch')
      if (_address().version !== 0x00) throw new TypeError('Invalid version')
      if (_address().data.length !== 20) throw new TypeError('Invalid data')
      if (hash && !hash.equals(_address().data)) throw new TypeError('Hash mismatch')
      else hash = _address().data
    }

    if (a.pubkey) {
      let pkh = bcrypto.hash160(a.pubkey)
      if (hash && !hash.equals(pkh)) throw new TypeError('Hash mismatch')
      else hash = pkh
    }

    if (a.hash) {
      if (hash && !hash.equals(a.hash)) throw new TypeError('Hash mismatch')
      else hash = a.hash
    }

    if (a.output) {
      if (
        a.output.length !== 22 ||
        a.output[0] !== OPS.OP_0 ||
        a.output[1] !== 0x14) throw new TypeError('Output is invalid')
      if (hash && !hash.equals(a.output.slice(2))) throw new TypeError('Hash mismatch')
      else hash = a.output.slice(2)
    }

    if (a.witness) {
      if (a.witness.length !== 2) throw new TypeError('Input is invalid')
      if (!bscript.isCanonicalScriptSignature(a.witness[0])) throw new TypeError('Input has invalid signature')
      if (!ecc.isPoint(a.witness[1])) throw new TypeError('Input has invalid pubkey')

      if (a.signature && !a.signature.equals(a.witness[0])) throw new TypeError('Signature mismatch')
      if (a.pubkey && !a.pubkey.equals(a.witness[1])) throw new TypeError('Pubkey mismatch')

      let pkh = bcrypto.hash160(a.witness[1])
      if (hash && !hash.equals(pkh)) throw new TypeError('Hash mismatch')
    }
  }

  return Object.assign(o, a)
}

module.exports = p2wpkh
