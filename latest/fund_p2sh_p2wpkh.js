var bitcoin = require('../src/index.js')
var bscript = bitcoin.script
var crypto = bitcoin.crypto
var networks = bitcoin.networks
var TransactionBuilder = bitcoin.TransactionBuilder
var TxSigner = bitcoin.TxSigner

var network = networks.testnet
var entropy = new Buffer('14bdfeac14bdfeac14bdfeac14bdfeac14bdfeac14bdfeac14bdfeac14bdfeac')
var root = bitcoin.HDNode.fromSeedBuffer(entropy, network)

var txid = '06fc7b675a31bfe3f05dab40d0cd8c044a9b2e890c696a53449d970a4adc6d52'
var vout = 0
var receivePK = bscript.pubKeyHash.output.encode(crypto.hash160(root.keyPair.getPublicKeyBuffer()))
var receiveAmount = 22000

var fundP2shScript = bscript.witnessPubKeyHash.output.encode(crypto.hash160(root.keyPair.getPublicKeyBuffer()))
var fundScriptPubKey = bscript.scriptHash.output.encode(crypto.hash160(fundP2shScript))

var txb = new TransactionBuilder(network)
txb.addInput(txid, vout, 0xffffffff)
txb.addOutput(fundScriptPubKey, receiveAmount - 5000)

var unsigned = txb.buildIncomplete()
var signer = new TxSigner(unsigned)
signer.sign(0, root.keyPair, {
  scriptPubKey: receivePK
})
var tx = signer.done()
console.log(tx.toBuffer().toString('hex'))
