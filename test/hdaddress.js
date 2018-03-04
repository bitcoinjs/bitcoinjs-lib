/* global describe, it */
/* eslint-disable no-new */

var assert = require('assert')
var HDNode = require('../src/hdnode')
var bnetwork = require('../src/networks')

describe('bip44', function () {
  it('works without a ScriptFactory', function () {
    // mnemonic: abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about
    var seed = '5eb00bbddcf069084889a8ab9155568165f5c453ccb85e70811aaed6f6da5fc19a5ac40b389cd370d086206dec8aa6c43daea6690f20ad3d8d48b2d2ce9e38e4'
    var network = bnetwork.bitcoin

    var root = HDNode.fromSeedHex(seed, network)
    assert.equal(
      root.toBase58(),
      'xprv9s21ZrQH143K3GJpoapnV8SFfukcVBSfeCficPSGfubmSFDxo1kuHnLisriDvSnRRuL2Qrg5ggqHKNVpxR86QEC8w35uxmGoggxtQTPvfUu'
    )

    var account = root.derivePath('44\'/0\'/0\'')
    assert.equal(
      account.toBase58(),
      'xprv9xpXFhFpqdQK3TmytPBqXtGSwS3DLjojFhTGht8gwAAii8py5X6pxeBnQ6ehJiyJ6nDjWGJfZ95WxByFXVkDxHXrqu53WCRGypk2ttuqncb'
    )
    assert.equal(
      'xpub6BosfCnifzxcFwrSzQiqu2DBVTshkCXacvNsWGYJVVhhawA7d4R5WSWGFNbi8Aw6ZRc1brxMyWMzG3DSSSSoekkudhUd9yLb6qx39T9nMdj',
      account.neutered().toBase58()
    )

    var key = account.derivePath('0/0')
    assert.equal('1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA', key.getAddress())
  })

  it('works with a prefix', function () {
    // mnemonic: abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about
    var seed = '5eb00bbddcf069084889a8ab9155568165f5c453ccb85e70811aaed6f6da5fc19a5ac40b389cd370d086206dec8aa6c43daea6690f20ad3d8d48b2d2ce9e38e4'
    var network = bnetwork.bitcoin

    var root = HDNode.fromSeedHex(seed, network, network.bip32)
    var account = root.derivePath('44\'/0\'/0\'')
    assert.equal(
      account.toBase58(),
      'xprv9xpXFhFpqdQK3TmytPBqXtGSwS3DLjojFhTGht8gwAAii8py5X6pxeBnQ6ehJiyJ6nDjWGJfZ95WxByFXVkDxHXrqu53WCRGypk2ttuqncb'
    )
    assert.equal(
      'xpub6BosfCnifzxcFwrSzQiqu2DBVTshkCXacvNsWGYJVVhhawA7d4R5WSWGFNbi8Aw6ZRc1brxMyWMzG3DSSSSoekkudhUd9yLb6qx39T9nMdj',
      account.neutered().toBase58()
    )

    var key = account.derivePath('0/0')
    assert.equal('1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA', key.getAddress())
  })
})

describe('bip49', function () {
  it('serialization and address', function () {
    // mnemonic: abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about
    var seed = '5eb00bbddcf069084889a8ab9155568165f5c453ccb85e70811aaed6f6da5fc19a5ac40b389cd370d086206dec8aa6c43daea6690f20ad3d8d48b2d2ce9e38e4'
    var network = bnetwork.bitcoin
    var root = HDNode.fromSeedHex(seed, network, network.bip49)
    var account = root.derivePath('49\'/0\'/0\'')
    assert.equal(
      account.toBase58(),
      'yprvAHwhK6RbpuS3dgCYHM5jc2ZvEKd7Bi61u9FVhYMpgMSuZS613T1xxQeKTffhrHY79hZ5PsskBjcc6C2V7DrnsMsNaGDaWev3GLRQRgV7hxF'
    )
    assert.equal(
      'ypub6Ww3ibxVfGzLrAH1PNcjyAWenMTbbAosGNB6VvmSEgytSER9azLDWCxoJwW7Ke7icmizBMXrzBx9979FfaHxHcrArf3zbeJJJUZPf663zsP',
      account.neutered().toBase58()
    )

    var key = account.derivePath('0/0')
    assert.equal('37VucYSaXLCAsxYyAPfbSi9eh4iEcbShgf', key.getAddress())
  })
})

describe('bip84', function () {
  it('serialization and address', function () {
    // mnemonic: abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about
    var seed = '5eb00bbddcf069084889a8ab9155568165f5c453ccb85e70811aaed6f6da5fc19a5ac40b389cd370d086206dec8aa6c43daea6690f20ad3d8d48b2d2ce9e38e4'
    var network = bnetwork.bitcoin
    var root = HDNode.fromSeedHex(seed, network, network.bip84)
    var account = root.derivePath('84\'/0\'/0\'')
    assert.equal(
      account.toBase58(),
      'zprvAdG4iTXWBoARxkkzNpNh8r6Qag3irQB8PzEMkAFeTRXxHpbF9z4QgEvBRmfvqWvGp42t42nvgGpNgYSJA9iefm1yYNZKEm7z6qUWCroSQnE'
    )
    assert.equal(
      'zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs',
      account.neutered().toBase58()
    )

    var key = account.derivePath('0/0')
    assert.equal('bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu', key.getAddress())
  })
})
