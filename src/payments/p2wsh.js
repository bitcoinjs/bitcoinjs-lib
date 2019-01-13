const lazy = require('./lazy')
const typef = require('typeforce')
const OPS = require('bitcoin-ops')

const bech32 = require('bech32')
const bcrypto = require('../crypto')
const bscript = require('../script')
const BITCOIN_NETWORK = require('../networks').bitcoin

const EMPTY_BUFFER = Buffer.alloc(0)

function stacksEqual (a, b) {
  if (a.length !== b.length) return false

  return a.every(function (x, i) {
    return x.equals(b[i])
  })
}

// input: <>
// witness: [redeemScriptSig ...] {redeemScript}
// output: OP_0 {sha256(redeemScript)}
function p2wsh (a, opts) {
  if (
    !a.address &&
    !a.hash &&
    !a.output &&
    !a.redeem &&
    !a.witness
  ) throw new TypeError('Not enough data')
  opts = Object.assign({ validate: true }, opts || {})

  typef({
    network: typef.maybe(typef.Object),

    address: typef.maybe(typef.String),
    hash: typef.maybe(typef.BufferN(32)),
    output: typef.maybe(typef.BufferN(34)),

    redeem: typef.maybe({
      input: typef.maybe(typef.Buffer),
      network: typef.maybe(typef.Object),
      output: typef.maybe(typef.Buffer),
      witness: typef.maybe(typef.arrayOf(typef.Buffer))
    }),
    input: typef.maybe(typef.BufferN(0)),
    witness: typef.maybe(typef.arrayOf(typef.Buffer))
  }, a)

  const _address = lazy.value(function () {
    const result = bech32.decode(a.address)
    const version = result.words.shift()
    const data = bech32.fromWords(result.words)
    return {
      version,
      prefix: result.prefix,
      data: Buffer.from(data)
    }
  })
  const _rchunks = lazy.value(function () { return bscript.decompile(a.redeem.input) })

  let network = a.network
  if (!network) {
    network = (a.redeem && a.redeem.network) || BITCOIN_NETWORK
  }

  const o = { network }

  lazy.prop(o, 'address', function () {
    if (!o.hash) return
    const words = bech32.toWords(o.hash)
    words.unshift(0x00)
    return bech32.encode(network.bech32, words)
  })
  lazy.prop(o, 'hash', function () {
    if (a.output) return a.output.slice(2)
    if (a.address) return _address().data
    if (o.redeem && o.redeem.output) return bcrypto.sha256(o.redeem.output)
  })
  lazy.prop(o, 'output', function () {
    if (!o.hash) return
    return bscript.compile([
      OPS.OP_0,
      o.hash
    ])
  })
  lazy.prop(o, 'redeem', function () {
    if (!a.witness) return
    return {
      output: a.witness[a.witness.length - 1],
      input: EMPTY_BUFFER,
      witness: a.witness.slice(0, -1)
    }
  })
  lazy.prop(o, 'input', function () {
    if (!o.witness) return
    return EMPTY_BUFFER
  })
  lazy.prop(o, 'witness', function () {
    // transform redeem input to witness stack?
    if (
      a.redeem &&
      a.redeem.input &&
      a.redeem.input.length > 0 &&
      a.redeem.output &&
      a.redeem.output.length > 0
    ) {
      const stack = bscript.toStack(_rchunks())

      // assign, and blank the existing input
      o.redeem = Object.assign({ witness: stack }, a.redeem)
      o.redeem.input = EMPTY_BUFFER
      return [].concat(stack, a.redeem.output)
    }

    if (!a.redeem) return
    if (!a.redeem.output) return
    if (!a.redeem.witness) return
    return [].concat(a.redeem.witness, a.redeem.output)
  })

  // extended validation
  if (opts.validate) {
    let hash
    if (a.address) {
      if (_address().prefix !== network.bech32) throw new TypeError('Invalid prefix or Network mismatch')
      if (_address().version !== 0x00) throw new TypeError('Invalid address version')
      if (_address().data.length !== 32) throw new TypeError('Invalid address data')
      hash = _address().data
    }

    if (a.hash) {
      if (hash && !hash.equals(a.hash)) throw new TypeError('Hash mismatch')
      else hash = a.hash
    }

    if (a.output) {
      if (
        a.output.length !== 34 ||
        a.output[0] !== OPS.OP_0 ||
        a.output[1] !== 0x20) throw new TypeError('Output is invalid')
      const hash2 = a.output.slice(2)
      if (hash && !hash.equals(hash2)) throw new TypeError('Hash mismatch')
      else hash = hash2
    }

    if (a.redeem) {
      if (a.redeem.network && a.redeem.network !== network) throw new TypeError('Network mismatch')

      // is there two redeem sources?
      if (
        a.redeem.input &&
        a.redeem.input.length > 0 &&
        a.redeem.witness &&
        a.redeem.witness.length > 0
      ) throw new TypeError('Ambiguous witness source')

      // is the redeem output non-empty?
      if (a.redeem.output) {
        if (bscript.decompile(a.redeem.output).length === 0) throw new TypeError('Redeem.output is invalid')

        // match hash against other sources
        const hash2 = bcrypto.sha256(a.redeem.output)
        if (hash && !hash.equals(hash2)) throw new TypeError('Hash mismatch')
        else hash = hash2
      }

      if (a.redeem.input && !bscript.isPushOnly(_rchunks())) throw new TypeError('Non push-only scriptSig')
      if (a.witness && a.redeem.witness && !stacksEqual(a.witness, a.redeem.witness)) throw new TypeError('Witness and redeem.witness mismatch')
    }

    if (a.witness) {
      if (a.redeem && a.redeem.output && !a.redeem.output.equals(a.witness[a.witness.length - 1])) throw new TypeError('Witness and redeem.output mismatch')
    }
  }

  return Object.assign(o, a)
}

module.exports = p2wsh
