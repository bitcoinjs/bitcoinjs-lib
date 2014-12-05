var assert = require('assert')
var bigi = require('bigi')
var bitcoin = require('../../')
var crypto = require('crypto')

describe('bitcoinjs-lib (crypto)', function() {
  it('can recover a parent private key from the parent\'s public key and a derived non-hardened child private key', function() {
    function recoverParent(master, child) {
      assert(!master.privKey, 'You already have the parent private key')
      assert(child.privKey, 'Missing child private key')

      var curve = bitcoin.ECKey.curve
      var QP = master.pubKey.toBuffer()
      var QP64 = QP.toString('base64')
      var d1 = child.privKey.d
      var d2
      var indexBuffer = new Buffer(4)

      // search index space until we find it
      for (var i = 0; i < bitcoin.HDNode.HIGHEST_BIT; ++i) {
        indexBuffer.writeUInt32BE(i, 0)

        // calculate I
        var data = Buffer.concat([QP, indexBuffer])
        var I = crypto.createHmac('sha512', master.chainCode).update(data).digest()
        var IL = I.slice(0, 32)
        var pIL = bigi.fromBuffer(IL)

        // See hdnode.js:273 to understand
        d2 = d1.subtract(pIL).mod(curve.n)

        var Qp = new bitcoin.ECKey(d2, true).pub.toBuffer()
        if (Qp.toString('base64') === QP64) break
      }

      var node = new bitcoin.HDNode(d2, master.chainCode, master.network)
      node.depth = master.depth
      node.index = master.index
      node.masterFingerprint = master.masterFingerprint
      return node
    }

    var seed = crypto.randomBytes(32)
    var master = bitcoin.HDNode.fromSeedBuffer(seed)
    var child = master.derive(6) // m/6

    // now for the recovery
    var neuteredMaster = master.neutered()
    var recovered = recoverParent(neuteredMaster, child)
    assert.equal(recovered.toBase58(), master.toBase58())
  })
})
