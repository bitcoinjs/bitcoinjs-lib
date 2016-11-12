var bitcoin = require('../src/index.js')
var bscript = bitcoin.script
var crypto = bitcoin.crypto
var networks = bitcoin.networks
var TransactionBuilder = bitcoin.TransactionBuilder

var network = networks.testnet
var entropy = new Buffer('14bdfeac14bdfeac14bdfeac14bdfeac14bdfeac14bdfeac14bdfeac14bdfeac')
var root = bitcoin.HDNode.fromSeedBuffer(entropy, network)
var address = root.keyPair.getAddress()
var wif = root.keyPair.toWIF()
console.log(address)
console.log(wif)

var txid = '06fc7b675a31bfe3f05dab40d0cd8c044a9b2e890c696a53449d970a4adc6d52'
var vout = 0
var p2shScript = bscript.witnessPubKeyHash.output.encode(crypto.hash160(root.keyPair.getPublicKeyBuffer()))
var scriptPubKey = bscript.scriptHash.output.encode(crypto.hash160(p2shScript))
var amount = 22000

var txb = new TransactionBuilder(network)
txb.addInput(txid, vout, 0xffffffff)
txb.addOutput(scriptPubKey, amount - 5000)
txb.sign(0, root.keyPair)
var tx = txb.build()
console.log(tx.toBuffer().toString('hex'))
