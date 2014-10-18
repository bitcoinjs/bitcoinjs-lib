var assert = require('assert')

var bigi = require('bigi')
var bitcoin = require('../../')

describe('bitcoinjs-lib (brainwallet examples)', function() {
  it('can initialize a ECKey from a sha256 hash', function() {
    var hash = bitcoin.crypto.sha256('correct horse battery staple')
    var d = bigi.fromBuffer(hash)

    var key = new bitcoin.ECKey(d)

    assert.equal(key.pub.getAddress().toString(), '1C7zdTfnkzmr13HfA2vNm5SJYRK6nEKyq8')
  })

  it('can sign a bitcoin message', function() {
    var key = bitcoin.ECKey.fromWIF('5KYZdUEo39z3FPrtuX2QbbwGnNP5zTd7yyr2SC1j299sBCnWjss')
    var message = 'This is an example of a signed message.'

    var signature = bitcoin.Message.sign(key, message)
    assert.equal(signature.toString('base64'), 'G9L5yLFjti0QTHhPyFrZCT1V/MMnBtXKmoiKDZ78NDBjERki6ZTQZdSMCtkgoNmp17By9ItJr8o7ChX0XxY91nk=')
  })

  it('can verify a bitcoin message', function() {
    var address = '1HZwkjkeaoZfTSaJxDw6aKkxp45agDiEzN'
    var signature = 'HJLQlDWLyb1Ef8bQKEISzFbDAKctIlaqOpGbrk3YVtRsjmC61lpE5ErkPRUFtDKtx98vHFGUWlFhsh3DiW6N0rE'
    var message = 'This is an example of a signed message.'

    assert(bitcoin.Message.verify(address, signature, message))
  })
})
