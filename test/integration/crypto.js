/* global describe, it */

var assert = require('assert')
var async = require('async')
var bigi = require('bigi')
var bitcoin = require('../../')
var blockchain = require('./_blockchain')

var ecurve = require('ecurve')
var secp256k1 = ecurve.getCurveByName('secp256k1')

describe('bitcoinjs-lib (crypto)', function () {
  it('can recover a private key from duplicate R values', function (done) {
    this.timeout(30000)

    var inputs = [
      {
        txId: 'f4c16475f2a6e9c602e4a287f9db3040e319eb9ece74761a4b84bc820fbeef50',
        vout: 0
      },
      {
        txId: 'f4c16475f2a6e9c602e4a287f9db3040e319eb9ece74761a4b84bc820fbeef50',
        vout: 1
      }
    ]

    var txIds = inputs.map(function (x) { return x.txId })

    // first retrieve the relevant transactions
    blockchain.m.transactions.get(txIds, function (err, results) {
      assert.ifError(err)

      var transactions = {}
      results.forEach(function (tx) {
        transactions[tx.txId] = bitcoin.Transaction.fromHex(tx.txHex)
      })

      var tasks = []

      // now we need to collect/transform a bit of data from the selected inputs
      inputs.forEach(function (input) {
        var transaction = transactions[input.txId]
        var script = transaction.ins[input.vout].script
        var scriptChunks = bitcoin.script.decompile(script)

        assert(bitcoin.script.pubKeyHash.input.check(scriptChunks), 'Expected pubKeyHash script')

        var prevOutTxId = new Buffer(transaction.ins[input.vout].hash).reverse().toString('hex')
        var prevVout = transaction.ins[input.vout].index

        tasks.push(function (callback) {
          blockchain.m.transactions.get(prevOutTxId, function (err, result) {
            if (err) return callback(err)

            var prevOut = bitcoin.Transaction.fromHex(result.txHex)
            var prevOutScript = prevOut.outs[prevVout].script

            var scriptSignature = bitcoin.ECSignature.parseScriptSignature(scriptChunks[0])
            var publicKey = bitcoin.ECPair.fromPublicKeyBuffer(scriptChunks[1])

            var m = transaction.hashForSignature(input.vout, prevOutScript, scriptSignature.hashType)
            assert(publicKey.verify(m, scriptSignature.signature), 'Invalid m')

            // store the required information
            input.signature = scriptSignature.signature
            input.z = bigi.fromBuffer(m)

            return callback()
          })
        })
      })

      // finally, run the tasks, then on to the math
      async.parallel(tasks, function (err) {
        if (err) throw err

        var n = secp256k1.n

        for (var i = 0; i < inputs.length; ++i) {
          for (var j = i + 1; j < inputs.length; ++j) {
            var inputA = inputs[i]
            var inputB = inputs[j]

            // enforce matching r values
            assert.strictEqual(inputA.signature.r.toString(), inputB.signature.r.toString())
            var r = inputA.signature.r
            var rInv = r.modInverse(n)

            var s1 = inputA.signature.s
            var s2 = inputB.signature.s
            var z1 = inputA.z
            var z2 = inputB.z

            var zz = z1.subtract(z2).mod(n)
            var ss = s1.subtract(s2).mod(n)

            // k = (z1 - z2) / (s1 - s2)
            // d1 = (s1 * k - z1) / r
            // d2 = (s2 * k - z2) / r
            var k = zz.multiply(ss.modInverse(n)).mod(n)
            var d1 = ((s1.multiply(k).mod(n)).subtract(z1).mod(n)).multiply(rInv).mod(n)
            var d2 = ((s2.multiply(k).mod(n)).subtract(z2).mod(n)).multiply(rInv).mod(n)

            // enforce matching private keys
            assert.strictEqual(d1.toString(), d2.toString())
          }
        }

        done()
      })
    })
  })
})
