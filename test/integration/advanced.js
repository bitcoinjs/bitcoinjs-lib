var assert = require('assert')
var bigi = require('bigi')
var bitcoin = require('../../')
var helloblock = require('helloblock-js')({
  network: 'testnet'
})

describe('bitcoinjs-lib (advanced)', function() {
  it('can sign a Bitcoin message', function() {
    var key = bitcoin.ECKey.fromWIF('5KYZdUEo39z3FPrtuX2QbbwGnNP5zTd7yyr2SC1j299sBCnWjss')
    var message = 'This is an example of a signed message.'

    var signature = bitcoin.Message.sign(key, message)
    assert.equal(signature.toString('base64'), 'G9L5yLFjti0QTHhPyFrZCT1V/MMnBtXKmoiKDZ78NDBjERki6ZTQZdSMCtkgoNmp17By9ItJr8o7ChX0XxY91nk=')
  })

  it('can verify a Bitcoin message', function() {
    var address = '1HZwkjkeaoZfTSaJxDw6aKkxp45agDiEzN'
    var signature = 'HJLQlDWLyb1Ef8bQKEISzFbDAKctIlaqOpGbrk3YVtRsjmC61lpE5ErkPRUFtDKtx98vHFGUWlFhsh3DiW6N0rE'
    var message = 'This is an example of a signed message.'

    assert(bitcoin.Message.verify(address, signature, message))
  })

  it('can generate a single-key stealth address', function() {
    var receiver = bitcoin.ECKey.fromWIF('5KYZdUEo39z3FPrtuX2QbbwGnNP5zTd7yyr2SC1j299sBCnWjss')

    // XXX: ephemeral, must be random (and secret to sender) to preserve privacy
    var sender = bitcoin.ECKey.fromWIF('Kxr9tQED9H44gCmp6HAdmemAzU3n84H3dGkuWTKvE23JgHMW8gct')

    var G = bitcoin.ECKey.curve.G
    var d = receiver.d // secret (receiver only)
    var Q = receiver.pub.Q // shared

    var e = sender.d // secret (sender only)
    var P = sender.pub.Q // shared

    // derived shared secret
    var eQ = Q.multiply(e) // sender
    var dP = P.multiply(d) // receiver
    assert.deepEqual(eQ.getEncoded(), dP.getEncoded())

    var c = bigi.fromBuffer(bitcoin.crypto.sha256(eQ.getEncoded()))
    var cG = G.multiply(c)

    // derived public key
    var QprimeS = Q.add(cG)
    var QprimeR = G.multiply(d.add(c))
    assert.deepEqual(QprimeR.getEncoded(), QprimeS.getEncoded())

    // derived shared-secret address
    var address = new bitcoin.ECPubKey(QprimeS).getAddress().toString()

    assert.equal(address, '1EwCNJNZM5q58YPPTnjR1H5BvYRNeyZi47')
  })

  // TODO
  it.skip('can generate a dual-key stealth address', function() {})

  it('can create an OP_RETURN transaction', function(done) {
    this.timeout(20000)

    var key = bitcoin.ECKey.fromWIF("L1uyy5qTuGrVXrmrsvHWHgVzW9kKdrp27wBC7Vs6nZDTF2BRUVwy")
    var address = key.pub.getAddress(bitcoin.networks.testnet).toString()

    helloblock.faucet.withdraw(address, 2e4, function(err) {
      if (err) return done(err)

      helloblock.addresses.getUnspents(address, function(err, _, unspents) {
        if (err) return done(err)

        // filter small unspents
        unspents = unspents.filter(function(unspent) { return unspent.value > 1e4 })

        // use the oldest unspent
        var unspent = unspents.pop()

        var tx = new bitcoin.TransactionBuilder()

        var data = new Buffer('cafedeadbeef', 'hex')
        var dataScript = bitcoin.scripts.nullDataOutput(data)

        tx.addInput(unspent.txHash, unspent.index)
        tx.addOutput(dataScript, 1000)
        tx.sign(0, key)

        helloblock.transactions.propagate(tx.build().toHex(), function(err) {
          if (err) return done(err)

          // check that the message was propagated
          helloblock.addresses.getTransactions(address, function(err, res, transactions) {
            if (err) return done(err)

            var transaction = transactions[0]
            var output = transaction.outputs[0]
            var dataScript2 = bitcoin.Script.fromHex(output.scriptPubKey)
            var data2 = dataScript2.chunks[1]

            assert.deepEqual(dataScript, dataScript2)
            assert.deepEqual(data, data2)

            done()
          })
        })
      })
    })
  })
})
