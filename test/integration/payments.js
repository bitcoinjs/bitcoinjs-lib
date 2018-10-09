const bitcoin = require('../../')

const { describe, it } = require('mocha')
const regtestUtils = require('./_regtest')
const NETWORK = regtestUtils.network
const keyPairs = [
  bitcoin.ECPair.makeRandom({ network: NETWORK }),
  bitcoin.ECPair.makeRandom({ network: NETWORK })
]

function buildAndSign (depends, prevOutput, redeemScript, witnessScript, done) {
  regtestUtils.faucetComplex(prevOutput, 5e4, (err, unspent) => {
    if (err) return done(err)

    const txb = new bitcoin.TransactionBuilder(NETWORK)
    txb.addInput(unspent.txId, unspent.vout, null, prevOutput)
    txb.addOutput(regtestUtils.RANDOM_ADDRESS, 2e4)

    if (depends.signatures) {
      keyPairs.forEach((keyPair) => {
        txb.sign(0, keyPair, redeemScript, null, unspent.value, witnessScript)
      })
    } else if (depends.signature) {
      txb.sign(0, keyPairs[0], redeemScript, null, unspent.value, witnessScript)
    }

    regtestUtils.broadcast(txb.build().toHex(), done)
  })
}

;['p2ms', 'p2pk', 'p2pkh', 'p2wpkh'].forEach((k) => {
  const fixtures = require('../fixtures/' + k)
  const { depends } = fixtures.dynamic
  const fn = bitcoin.payments[k]

  const base = {}
  if (depends.pubkey) base.pubkey = keyPairs[0].publicKey
  if (depends.pubkeys) base.pubkeys = keyPairs.map(x => x.publicKey)
  if (depends.m) base.m = base.pubkeys.length

  const { output } = fn(base)
  if (!output) throw new TypeError('Missing output')

  describe('bitcoinjs-lib (payments - ' + k + ')', function () {
    it('can broadcast as an output, and be spent as an input', (done) => {
      buildAndSign(depends, output, null, null, done)
    })

    it('can (as P2SH(' + k + ')) broadcast as an output, and be spent as an input', (done) => {
      const p2sh = bitcoin.payments.p2sh({ redeem: { output }, network: NETWORK })
      buildAndSign(depends, p2sh.output, p2sh.redeem.output, null, done)
    })

    // NOTE: P2WPKH cannot be wrapped in P2WSH, consensus fail
    if (k === 'p2wpkh') return

    it('can (as P2WSH(' + k + ')) broadcast as an output, and be spent as an input', (done) => {
      const p2wsh = bitcoin.payments.p2wsh({ redeem: { output }, network: NETWORK })
      buildAndSign(depends, p2wsh.output, null, p2wsh.redeem.output, done)
    })

    it('can (as P2SH(P2WSH(' + k + '))) broadcast as an output, and be spent as an input', (done) => {
      const p2wsh = bitcoin.payments.p2wsh({ redeem: { output }, network: NETWORK })
      const p2sh = bitcoin.payments.p2sh({ redeem: { output: p2wsh.output }, network: NETWORK })

      buildAndSign(depends, p2sh.output, p2sh.redeem.output, p2wsh.redeem.output, done)
    })
  })
})
