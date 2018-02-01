var assert = require('assert')
var bitcoin = require('../../')
var dhttp = require('dhttp/200')

var APIPASS = process.env.APIPASS || 'satoshi'
var APIURL = 'https://api.dcousens.cloud/1'

function broadcast (txHex, callback) {
  dhttp({
    method: 'PUT',
    url: APIURL + '/t/push',
    body: txHex
  }, callback)
}

function mine (count, callback) {
  dhttp({
    method: 'POST',
    url: APIURL + '/r/generate?count=' + count + '&key=' + APIPASS
  }, callback)
}

function height (callback) {
  dhttp({
    method: 'GET',
    url: APIURL + '/b/best/height'
  }, callback)
}

function faucet (address, value, callback) {
  dhttp({
    method: 'POST',
    url: APIURL + '/r/faucet?address=' + address + '&value=' + value + '&key=' + APIPASS
  }, function (err, txId) {
    if (err) return callback(err)

    unspents(address, function (err, results) {
      if (err) return callback(err)

      callback(null, results.filter(x => x.txId === txId).pop())
    })
  })
}

function fetch (txId, callback) {
  dhttp({
    method: 'GET',
    url: APIURL + '/t/' + txId + '/json'
  }, callback)
}

function unspents (address, callback) {
  dhttp({
    method: 'GET',
    url: APIURL + '/a/' + address + '/unspents'
  }, callback)
}

function verify (txo, callback) {
  fetch(txo.txId, function (err, tx) {
    if (err) return callback(err)

    var txoActual = tx.outs[txo.vout]
    if (txo.address) assert.strictEqual(txoActual.address, txo.address)
    if (txo.value) assert.strictEqual(txoActual.value, txo.value)
    callback()
  })
}

function randomAddress () {
  return bitcoin.ECPair.makeRandom({
    network: bitcoin.networks.testnet
  }).getAddress()
}

module.exports = {
  broadcast: broadcast,
  faucet: faucet,
  fetch: fetch,
  height: height,
  mine: mine,
  network: bitcoin.networks.testnet,
  unspents: unspents,
  verify: verify,
  randomAddress: randomAddress,
  RANDOM_ADDRESS: randomAddress()
}
