var assert = require('assert');
var Message = require('../src/message')
var convert = require('../src/convert')
var ECKey = require('../src/eckey').ECKey
var testnet = require('../src/network.js').testnet.addressVersion

describe('Message', function() {
  var msg = 'vires is numeris'

  describe('verify', function(){
    it('works for mainnet address, messaged signed with uncompressed key', function() {
      var addr = '16UwLL9Risc3QfPqBUvKofHmBQ7wMtjvM';
      var sig = '1bc25ac0fb503abc9bad23f558742740fafaec1f52deaaf106b9759a5ce84c93921c4a669c5ec3dfeb7e2d7d177a2f49db407900874f6de2f701a4c16783776d8d'
      assert.ok(Message.verify(addr, sig, msg));
      verifyNegativeCases(addr, sig, msg)
    })

    it('works for testnet address, message signed with compressed key', function() {
      var addr = 'mgdnNWji2bXYSi7E9c1DQBSp64kCemaS7V'
      var sig = '1feece860e952253ddf465cd1c5aea76ab16287aee093be6f67d196c39f5075436f0407a4e50694e6956c06108fab8608debf9554d75e57c110f7c512a6eb15d0a'

      assert(Message.verify(addr, sig, msg))
      verifyNegativeCases(addr, sig, msg)
    })

    function verifyNegativeCases(addr, sig, msg){
      var wrongMsg = 'vires in numeris'
      assert.ok(!Message.verify(addr, sig, wrongMsg));

      var wrongAddress = new ECKey(null).getAddress()
      assert.ok(!Message.verify(wrongAddress, sig, msg));
    }
  })

  describe('sign', function() {
    describe('uncompressed key', function(){
      it('works', function(){
        var key = new ECKey(null)
        var sig = Message.sign(key, msg);

        var addr = key.getAddress()
        assert(Message.verify(addr, sig, msg));
      })
    })

    describe('compressed key', function(){
      it('works', function(){
        var key = new ECKey(null, true)
        var sig = Message.sign(key, msg);

        var addr = key.getAddress()
        assert(Message.verify(addr, sig, msg));
      })
    })

    describe('testnet address', function(){
      it('works', function(){
        var key = new ECKey(null)
        var sig = Message.sign(key, msg);

        var addr = key.getAddress(testnet)
        assert(Message.verify(addr, sig, msg));
      })
    })
  })
})
