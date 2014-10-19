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

    it('can generate same text as default Brainwallet page', function() {
        // Open Brainwallet at https://brainwallet.github.io/
        // and you'll see these strings

        var hash = bitcoin.crypto.sha256('') // Empty passphrase
        assert.equal (hash.toString('hex'),'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
        var d = bigi.fromBuffer(hash)
        var eckey = new bitcoin.ECKey(d, false) // Uncompressed
        var addr = eckey.pub.getAddress()

        assert.equal(addr.toBase58Check(), '1HZwkjkeaoZfTSaJxDw6aKkxp45agDiEzN')
        assert.equal(eckey.toWIF(), '5KYZdUEo39z3FPrtuX2QbbwGnNP5zTd7yyr2SC1j299sBCnWjss')
        assert.equal(eckey.pub.toBuffer().toString('hex'), '04a34b99f22c790c4e36b2b3c2c35a36db06226e41c692fc82b8b56ac1c540c5bd5b8dec5235a0fa8722476c7709c02559e3aa73aa03918ba2d492eea75abea235')
        assert.equal(addr.hash.toString('hex'), 'b5bd079c4d57cc7fc28ecf8213a6b791625b8183')
    })
})
