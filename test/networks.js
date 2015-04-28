/* global describe, it */

var assert = require('assert')
var networks = require('../src/networks')

var HDNode = require('../src/hdnode')

var fixtures = require('./fixtures/network')

describe('networks', function () {
  fixtures.forEach(function (f) {
    var network = networks[f.network]

    Object.keys(f.bip32).forEach(function (name) {
      var extb58 = f.bip32[name]

      it(extb58 + ' auto-detects ' + f.network, function () {
        assert.equal(HDNode.fromBase58(extb58).keyPair.network, network)
      })
    })
  })
})
