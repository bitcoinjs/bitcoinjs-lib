var assert = require('assert')
var bigi = require('bigi')
var bitcoin = require('../../')
var crypto = require('crypto')
var sinon = require('sinon')

describe('bitcoinjs-lib (basic)', function() {
  it('can generate a random bitcoin address', sinon.test(function() {
    // for testing only
    this.mock(crypto).expects('randomBytes')
      .onCall(0).returns(new Buffer('zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz'))

    // generate random key
    var key = bitcoin.ECKey.makeRandom()
    var address = key.pub.getAddress().toString()

    assert.equal(address, '1F5VhMHukdnUES9kfXqzPzMeF1GPHKiF64')
  }))

  it('can generate an address from a SHA256 hash', function() {
    var hash = bitcoin.crypto.sha256('correct horse battery staple')
    var d = bigi.fromBuffer(hash)

    var key = new bitcoin.ECKey(d)

    assert.equal(key.pub.getAddress().toString(), '1C7zdTfnkzmr13HfA2vNm5SJYRK6nEKyq8')
  })

  it('can import an address via WIF', function() {
    var key = bitcoin.ECKey.fromWIF('Kxr9tQED9H44gCmp6HAdmemAzU3n84H3dGkuWTKvE23JgHMW8gct')
    var address = key.pub.getAddress().toString()

    assert.equal(address, '19AAjaTUbRjQCMuVczepkoPswiZRhjtg31')
  })

  it('can create a Transaction', function() {
    var key = bitcoin.ECKey.fromWIF("L1uyy5qTuGrVXrmrsvHWHgVzW9kKdrp27wBC7Vs6nZDTF2BRUVwy")
    var tx = new bitcoin.TransactionBuilder()

    tx.addInput("aa94ab02c182214f090e99a0d57021caffd0f195a81c24602b1028b130b63e31", 0)
    tx.addOutput("1Gokm82v6DmtwKEB8AiVhm82hyFSsEvBDK", 15000)
    tx.sign(0, key)

    assert.equal(tx.build().toHex(), '0100000001313eb630b128102b60241ca895f1d0ffca2170d5a0990e094f2182c102ab94aa000000006b483045022100aefbcf847900b01dd3e3debe054d3b6d03d715d50aea8525f5ea3396f168a1fb022013d181d05b15b90111808b22ef4f9ebe701caf2ab48db269691fdf4e9048f4f60121029f50f51d63b345039a290c94bffd3180c99ed659ff6ea6b1242bca47eb93b59fffffffff01983a0000000000001976a914ad618cf4333b3b248f9744e8e81db2964d0ae39788ac00000000')
  })
})
