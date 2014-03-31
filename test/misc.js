var assert = require('assert')
var bitcoinjs = require('../')
var sec = require('../src/jsbn/sec')
var BigInteger = require('../src/jsbn/jsbn.js')
var SHA256 = require('crypto-js/sha256')
var rng = require('secure-random')
var ecparams = sec('secp256k1')
var ECPointFp = bitcoinjs.ECPointFp
var convert = require('../src/convert')

function sha256FromBytesToBytes(message){
  return convert.wordArrayToBytes(SHA256(convert.bytesToWordArray(message)))
}

it('Keys & Key Management', function () {
  var p1 = bitcoinjs.Key().getPub().toBytes()
  assert.equal(p1.length, 65)

  var p1_q = ECPointFp.decodeFrom(ecparams.getCurve(), p1)
  assert.ok(p1_q)
  assert.ok(p1_q.validate())

  var p2 = bitcoinjs.convert.hexToBytes(
    '0486f356006a38b847bedec1bf47013776925d939d5a35a97a4d1263e550c7f1a' +
    'b5aba44ab74d22892097a0e851addf07ba97e33416df5affaceeb35d5607cd23c')

    var p2_q = ECPointFp.decodeFrom(ecparams.getCurve(), p2)
    assert.ok(p2_q)
    assert.ok(p2_q.validate())
})

it('Signing and Verifying', function () {
  var s1 = bitcoinjs.Key()
  var sig_a = s1.sign(BigInteger.ZERO)
  assert.ok(sig_a, 'Sign null')

  assert.ok(s1.verify(BigInteger.ZERO, sig_a))

  var message = new BigInteger(1024, rng).toByteArrayUnsigned()
  var hash = sha256FromBytesToBytes(message)
  var sig_b = s1.sign(hash)
  assert.ok(sig_b, 'Sign random string')
  assert.ok(s1.verify(hash, sig_b))

  var message2 = bitcoinjs.convert.hexToBytes(
    '12dce2c169986b3346827ffb2305cf393984627f5f9722a1b1368e933c8d' +
    'd296653fbe5d7ac031c4962ad0eb1c4298c3b91d244e1116b4a76a130c13' +
    '1e7aec7fa70184a71a2e66797052831511b93c6e8d72ae58a1980eaacb66' +
    '8a33f50d7cefb96a5dab897b5efcb99cbafb0d777cb83fc9b2115b69c0fa' +
    '3d82507b932b84e4')

  var hash2 = sha256FromBytesToBytes(message2)

  var sig_c = bitcoinjs.convert.hexToBytes(
    '3044022038d9b8dd5c9fbf330565c1f51d72a59ba869aeb2c2001be959d3' +
    '79e861ec71960220a73945f32cf90d03127d2c3410d16cee120fa1a4b4c3' +
    'f273ab082801a95506c4')

  var s2 = bitcoinjs.convert.hexToBytes(
    '045a1594316e433fb91f35ef4874610d22177c3f1a1060f6c1e70a609d51' +
    'b20be5795cd2a5eae0d6b872ba42db95e9afaeea3fbb89e98099575b6828' +
    '609a978528')

  assert.ok(bitcoinjs.ecdsa.verify(hash2, sig_c, s2), 'Verify constant signature')
})
