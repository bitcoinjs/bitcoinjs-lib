const assert = require('assert')
const bitcoin = require('../../')
const dhttpCallback = require('dhttp/200')
// use Promises
const dhttp = options => new Promise((resolve, reject) => {
  return dhttpCallback(options, (err, data) => {
    if (err) return reject(err)
    else return resolve(data)
  })
})

const APIPASS = process.env.APIPASS || 'satoshi'
const APIURL = process.env.APIURL || 'https://regtest.bitbank.cc/1'
const NETWORK = bitcoin.networks.testnet

function broadcast (txHex) {
  return dhttp({
    method: 'POST',
    url: APIURL + '/t/push',
    body: txHex
  })
}

function mine (count) {
  return dhttp({
    method: 'POST',
    url: APIURL + '/r/generate?count=' + count + '&key=' + APIPASS
  })
}

function height () {
  return dhttp({
    method: 'GET',
    url: APIURL + '/b/best/height'
  })
}

function _faucetRequest (address, value) {
  return dhttp({
    method: 'POST',
    url: APIURL + '/r/faucet?address=' + address + '&value=' + value + '&key=' + APIPASS
  })
}

async function faucet (address, value) {
  let count = 0
  let _unspents = []
  const sleep = ms => new Promise((resolve, reject) => setTimeout(resolve, ms))
  const randInt = (min, max) => min + Math.floor((max - min + 1) * Math.random())
  while (_unspents.length === 0) {
    if (count > 0) {
      if (count >= 5) throw new Error('Missing Inputs')
      console.log('Missing Inputs, retry #' + count)
      await sleep(randInt(150, 250))
    }

    const txId = await _faucetRequest(address, value)
      .then(
        v => v, // Pass success value as is
        async err => {
          // Bad Request error is fixed by making sure height is >= 432
          const currentHeight = await height()
          if (err.message === 'Bad Request' && currentHeight < 432) {
            await mine(432 - currentHeight)
            return _faucetRequest(address, value)
          } else if (err.message === 'Bad Request' && currentHeight >= 432) {
            return _faucetRequest(address, value)
          } else {
            throw err
          }
        }
      )

    await sleep(randInt(10, 40))

    const results = await unspents(address)

    _unspents = results.filter(x => x.txId === txId)

    count++
  }

  return _unspents.pop()
}

async function faucetComplex (output, value) {
  const keyPair = bitcoin.ECPair.makeRandom({ network: NETWORK })
  const p2pkh = bitcoin.payments.p2pkh({ pubkey: keyPair.publicKey, network: NETWORK })

  const unspent = await faucet(p2pkh.address, value * 2)

  const txvb = new bitcoin.TransactionBuilder(NETWORK)
  txvb.addInput(unspent.txId, unspent.vout, null, p2pkh.output)
  txvb.addOutput(output, value)
  txvb.sign(0, keyPair)
  const txv = txvb.build()

  await broadcast(txv.toHex())

  return {
    txId: txv.getId(),
    vout: 0,
    value
  }
}

function fetch (txId) {
  return dhttp({
    method: 'GET',
    url: APIURL + '/t/' + txId + '/json'
  })
}

function unspents (address) {
  return dhttp({
    method: 'GET',
    url: APIURL + '/a/' + address + '/unspents'
  })
}

async function verify (txo) {
  const tx = await fetch(txo.txId)

  const txoActual = tx.outs[txo.vout]
  if (txo.address) assert.strictEqual(txoActual.address, txo.address)
  if (txo.value) assert.strictEqual(txoActual.value, txo.value)
}

function getAddress (node, network) {
  return bitcoin.payments.p2pkh({ pubkey: node.publicKey, network }).address
}

function randomAddress () {
  return getAddress(bitcoin.ECPair.makeRandom({
    network: bitcoin.networks.testnet
  }), bitcoin.networks.testnet)
}

module.exports = {
  broadcast,
  dhttp,
  faucet,
  faucetComplex,
  fetch,
  height,
  mine,
  network: NETWORK,
  unspents,
  verify,
  randomAddress,
  RANDOM_ADDRESS: randomAddress()
}
