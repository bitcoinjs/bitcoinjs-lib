const { describe, it, beforeEach } = require('mocha')
const assert = require('assert')

const ECPair = require('../src/ecpair')
const Psbt = require('..').Psbt

// For now, just hardcoding some test values is fine
// const fixtures = require('./fixtures/psbt')

describe(`Psbt`, () => {
  // constants
  const keyPair = ECPair.fromPrivateKey(Buffer.from('0000000000000000000000000000000000000000000000000000000000000001', 'hex'))

  describe('signInput', () => {
    it('throws if non-witness UTXO hash doesn\'t match the hash specified in the prevout', () => {
      const inputUtxo = '0200000001c1602ba68c8c241450a78b61dbfde272989181d07537b1e70d31b7db939557f2000000006a473044022029872b97579850c87658e431bb9df4a3f3e41590777529a55e25eb11eccafef50220511700aa1ea2c2cd499251f99014f22c5af63a00c76fd24da650014a0a8199e901210264187d9ee773aa333ac223678478b1df3ea268178fc9447e0a60c443eddaa749fdffffff01995d0000000000001976a914759d6677091e973b9e9d99f19c68fbf43e3f05f988acc8d30800'
      const inputHash = 'd2d00ff71b1d1920d3a7717274b720f3d8230d9f38ec8f3e6867a207f2a40092'
      const inputIndex = 0

      const psbt = new Psbt()
      psbt.addInput({hash: inputHash, index: inputIndex})
      psbt.addNonWitnessUtxoToInput(inputIndex, Buffer.from(inputUtxo, 'hex'))

      assert.throws(() => {
        psbt.signInput(inputIndex, keyPair)
      })
    })

    it('does not throw if non-witness UTXO hash matches the hash specified in the prevout', () => {
      const inputUtxo = '01000000027dddcf79a2e541030bc753871d1c9d4dc163e4d6bd5aefae4bd84de64e16a652000000008b483045022100d3a2c3b58ae0f0b551711aa8949f478724428efa03f3179c3a50dc2c9ace46aa02201b2da84a21429a10af187731c882fc1f727e7b89573e07f0192e9e3de79fabf00141040e3a759c33b03e1af8e5d86fb447a40eff244c847a4f8274276db490054e8be076f8801ddc9c5246ee86b6f33cfe38e8b7e57ab9db390eb3ec1ec6ae9eeea113fdffffff4fef6d7f3c1e5d0bea733b2fd644fa456cdf73f21eb7e8866a2721d79266e9e8010000008a4730440220284a2989d45c48a6c8a556b30b3467eaf6abf866ec75c4d9f0e3872074f62c070220686ad82869c1669e6be162c4a34e4c617a971766f2b9688789eb2f498fe5eb6b0141040e3a759c33b03e1af8e5d86fb447a40eff244c847a4f8274276db490054e8be076f8801ddc9c5246ee86b6f33cfe38e8b7e57ab9db390eb3ec1ec6ae9eeea113fdffffff0224c70d00000000001976a914da6473ed373e08f46dd8003fca7ba72fbe9c555e88ac9cb00e00000000001976a91449707992598f85a31aa6715af70fe507610b6f8b88ac11c00800'
      const inputHash = 'd2d00ff71b1d1920d3a7717274b720f3d8230d9f38ec8f3e6867a207f2a40092'
      const inputIndex = 0

      const psbt = new Psbt()
      psbt.addInput({hash: inputHash, index: inputIndex})
      psbt.addNonWitnessUtxoToInput(inputIndex, Buffer.from(inputUtxo, 'hex'))

      assert.doesNotThrow(() => {
        psbt.signInput(inputIndex, keyPair)
      })
    })

    it('throws if redeem script does not match the scriptPubKey in the prevout', () => {
      const inputUtxo = '0200000001aad73931018bd25f84ae400b68848be09db706eac2ac18298babee71ab656f8b0000000048473044022058f6fc7c6a33e1b31548d481c826c015bd30135aad42cd67790dab66d2ad243b02204a1ced2604c6735b6393e5b41691dd78b00f0c5942fb9f751856faa938157dba01feffffff0280f0fa020000000017a9140fb9463421696b82c833af241c78c17ddbde493487d0f20a270100000017a91429ca74f8a08f81999428185c97b5d852e4063f618765000000'
      const inputRedeemScript = '00208c2353173743b595dfb4a07b72ba8e42e3797da74e87fe7d9d7497e3b2028903'
      const inputHash = '75ddabb27b8845f5247975c8a5ba7c6f336c4570708ebe230caf6db5217ae858'
      const inputIndex = 0

      const psbt = new Psbt()
      psbt.addInput({hash: inputHash, index: inputIndex})
      psbt.addNonWitnessUtxoToInput(inputIndex, Buffer.from(inputUtxo, 'hex'))
      psbt.addRedeemScriptToInput(inputIndex, Buffer.from(inputRedeemScript, 'hex'))

      assert.throws(() => {
        psbt.signInput(inputIndex, keyPair)
      })
    })

    it('does not throw if redeem script matches the scriptPubKey in the prevout', () => {
      const inputUtxo = '0200000001aad73931018bd25f84ae400b68848be09db706eac2ac18298babee71ab656f8b0000000048473044022058f6fc7c6a33e1b31548d481c826c015bd30135aad42cd67790dab66d2ad243b02204a1ced2604c6735b6393e5b41691dd78b00f0c5942fb9f751856faa938157dba01feffffff0280f0fa020000000017a9140fb9463421696b82c833af241c78c17ddbde493487d0f20a270100000017a91429ca74f8a08f81999428185c97b5d852e4063f618765000000'
      const inputRedeemScript = '5221029583bf39ae0a609747ad199addd634fa6108559d6c5cd39b4c2183f1ab96e07f2102dab61ff49a14db6a7d02b0cd1fbb78fc4b18312b5b4e54dae4dba2fbfef536d752ae'
      const inputHash = '75ddabb27b8845f5247975c8a5ba7c6f336c4570708ebe230caf6db5217ae858'
      const inputIndex = 0

      const psbt = new Psbt()
      psbt.addInput({hash: inputHash, index: inputIndex})
      psbt.addNonWitnessUtxoToInput(inputIndex, Buffer.from(inputUtxo, 'hex'))
      psbt.addRedeemScriptToInput(inputIndex, Buffer.from(inputRedeemScript, 'hex'))

      assert.doesNotThrow(() => {
        psbt.signInput(inputIndex, keyPair)
      })
    })
  })
})
