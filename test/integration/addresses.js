const { describe, it } = require('mocha')
const assert = require('assert')
const bitcoin = require('../../')
const dhttp = require('dhttp/200')

const LITECOIN = {
  messagePrefix: '\x19Litecoin Signed Message:\n',
  bip32: {
    public: 0x019da462,
    private: 0x019d9cfe
  },
  pubKeyHash: 0x30,
  scriptHash: 0x32,
  wif: 0xb0
}

/* eslint-disable */
// uglified to prevent copy-pasting to production apps.

// README: FOR PRODUCTION, DO NOT PASS AN rng ATTRIBUTE TO THE
// makeRandom FUNCTION. It will automatically use a default value
// which will provide proper random values.
// So this:
// const keyPair = bitcoin.ECPair.makeRandom({ rng: rng })
// Should be this instead:
// const keyPair = bitcoin.ECPair.makeRandom()

// deterministic RNG for testing only
function rng (c) {
  const e=d(Array(32).fill(122)),n=Error,t=d([114,97,110,100,111,109,98,121,116,
  101,115]),o=typeof describe,f=d([68,79,32,78,79,84,32,85,83,69,32,84,72,73,
  83,32,114,110,103,32,70,85,78,67,84,73,79,78,32,79,85,84,83,73,68,69,32,
  79,70,32,65,85,84,79,77,65,84,69,68,32,84,69,83,84,73,78,71,33]),
  i=typeof it,u=d([117,110,100,101,102,105,110,101,100]),x=Buffer.from;
  if(o===u||i===u){return function(r){throw new n(r)}(f),require(t)(c)}
  return x(e);function d(r){return r.reduce((r,e)=>r+String.fromCodePoint(e),"")}
}
/* eslint-enable */

describe('bitcoinjs-lib (addresses)', function () {
  it('can generate a random address', function () {
    // in production: const keyPair = bitcoin.ECPair.makeRandom({})
    const keyPair = bitcoin.ECPair.makeRandom({ rng: rng })
    const { address } = bitcoin.payments.p2pkh({ pubkey: keyPair.publicKey })

    assert.strictEqual(address, '1F5VhMHukdnUES9kfXqzPzMeF1GPHKiF64')
  })

  it('can import an address via WIF', function () {
    const keyPair = bitcoin.ECPair.fromWIF('Kxr9tQED9H44gCmp6HAdmemAzU3n84H3dGkuWTKvE23JgHMW8gct')
    const { address } = bitcoin.payments.p2pkh({ pubkey: keyPair.publicKey })

    assert.strictEqual(address, '19AAjaTUbRjQCMuVczepkoPswiZRhjtg31')
  })

  it('can generate a P2SH, pay-to-multisig (2-of-3) address', function () {
    const pubkeys = [
      '026477115981fe981a6918a6297d9803c4dc04f328f22041bedff886bbc2962e01',
      '02c96db2302d19b43d4c69368babace7854cc84eb9e061cde51cfa77ca4a22b8b9',
      '03c6103b3b83e4a24a0e33a4df246ef11772f9992663db0c35759a5e2ebf68d8e9'
    ].map((hex) => Buffer.from(hex, 'hex'))
    const { address } = bitcoin.payments.p2sh({
      redeem: bitcoin.payments.p2ms({ m: 2, pubkeys })
    })

    assert.strictEqual(address, '36NUkt6FWUi3LAWBqWRdDmdTWbt91Yvfu7')
  })

  it('can generate a SegWit address', function () {
    const keyPair = bitcoin.ECPair.fromWIF('Kxr9tQED9H44gCmp6HAdmemAzU3n84H3dGkuWTKvE23JgHMW8gct')
    const { address } = bitcoin.payments.p2wpkh({ pubkey: keyPair.publicKey })

    assert.strictEqual(address, 'bc1qt97wqg464zrhnx23upykca5annqvwkwujjglky')
  })

  it('can generate a SegWit address (via P2SH)', function () {
    const keyPair = bitcoin.ECPair.fromWIF('Kxr9tQED9H44gCmp6HAdmemAzU3n84H3dGkuWTKvE23JgHMW8gct')
    const { address } = bitcoin.payments.p2sh({
      redeem: bitcoin.payments.p2wpkh({ pubkey: keyPair.publicKey })
    })

    assert.strictEqual(address, '34AgLJhwXrvmkZS1o5TrcdeevMt22Nar53')
  })

  it('can generate a P2WSH (SegWit), pay-to-multisig (3-of-4) address', function () {
    const pubkeys = [
      '026477115981fe981a6918a6297d9803c4dc04f328f22041bedff886bbc2962e01',
      '02c96db2302d19b43d4c69368babace7854cc84eb9e061cde51cfa77ca4a22b8b9',
      '023e4740d0ba639e28963f3476157b7cf2fb7c6fdf4254f97099cf8670b505ea59',
      '03c6103b3b83e4a24a0e33a4df246ef11772f9992663db0c35759a5e2ebf68d8e9'
    ].map((hex) => Buffer.from(hex, 'hex'))
    const { address } = bitcoin.payments.p2wsh({
      redeem: bitcoin.payments.p2ms({ m: 3, pubkeys })
    })

    assert.strictEqual(address, 'bc1q75f6dv4q8ug7zhujrsp5t0hzf33lllnr3fe7e2pra3v24mzl8rrqtp3qul')
  })

  it('can generate a P2SH(P2WSH(...)), pay-to-multisig (2-of-2) address', function () {
    const pubkeys = [
      '026477115981fe981a6918a6297d9803c4dc04f328f22041bedff886bbc2962e01',
      '02c96db2302d19b43d4c69368babace7854cc84eb9e061cde51cfa77ca4a22b8b9'
    ].map((hex) => Buffer.from(hex, 'hex'))
    const { address } = bitcoin.payments.p2sh({
      redeem: bitcoin.payments.p2wsh({
        redeem: bitcoin.payments.p2ms({ m: 2, pubkeys })
      })
    })

    assert.strictEqual(address, '3P4mrxQfmExfhxqjLnR2Ah4WES5EB1KBrN')
  })

  it('can support the retrieval of transactions for an address (via 3PBP)', function (done) {
    const keyPair = bitcoin.ECPair.makeRandom()
    const { address } = bitcoin.payments.p2pkh({ pubkey: keyPair.publicKey })

    dhttp({
      method: 'GET',
      url: 'https://blockchain.info/rawaddr/' + address
    }, function (err, result) {
      if (err) return done(err)

      // random private keys [probably!] have no transactions
      assert.strictEqual(result.n_tx, 0)
      assert.strictEqual(result.total_received, 0)
      assert.strictEqual(result.total_sent, 0)
      done()
    })
  })

  // other networks
  it('can generate a Testnet address', function () {
    const testnet = bitcoin.networks.testnet
    // in production: const keyPair = bitcoin.ECPair.makeRandom({ network: testnet })
    const keyPair = bitcoin.ECPair.makeRandom({ network: testnet, rng: rng })
    const wif = keyPair.toWIF()
    const { address } = bitcoin.payments.p2pkh({ pubkey: keyPair.publicKey, network: testnet })

    assert.strictEqual(address, 'mubSzQNtZfDj1YdNP6pNDuZy6zs6GDn61L')
    assert.strictEqual(wif, 'cRgnQe9MUu1JznntrLaoQpB476M8PURvXVQB5R2eqms5tXnzNsrr')
  })

  it('can generate a Litecoin address', function () {
    // in production: const keyPair = bitcoin.ECPair.makeRandom({ network: LITECOIN })
    const keyPair = bitcoin.ECPair.makeRandom({ network: LITECOIN, rng: rng })
    const wif = keyPair.toWIF()
    const { address } = bitcoin.payments.p2pkh({ pubkey: keyPair.publicKey, network: LITECOIN })

    assert.strictEqual(address, 'LZJSxZbjqJ2XVEquqfqHg1RQTDdfST5PTn')
    assert.strictEqual(wif, 'T7A4PUSgTDHecBxW1ZiYFrDNRih2o7M8Gf9xpoCgudPF9gDiNvuS')
  })
})
