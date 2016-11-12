var bitcoin = require('../src/index.js')
var bscript = bitcoin.script
var crypto = bitcoin.crypto
var networks = bitcoin.networks
var TransactionBuilder = bitcoin.TransactionBuilder
var TxSigner = bitcoin.TxSigner

var network = networks.testnet
var entropy = new Buffer('14bdfeac14bdfeac14bdfeac14bdfeac14bdfeac14bdfeac14bdfeac14bdfeac')
var root = bitcoin.HDNode.fromSeedBuffer(entropy, network)

var pubkeyhash = crypto.hash160(root.keyPair.getPublicKeyBuffer())

var txid = '9aa8d1a1c5df0afccf76e84df1029062b65a98dad68e13cc765aef88ab378dd0'
var vout = 0
var receivePK = bscript.pubKeyHash.output.encode(pubkeyhash)
var receiveAmount = 22000

var toSegwitPubkey = bscript.witnessPubKeyHash.output.encode(pubkeyhash)

var txb = new TransactionBuilder(network)
txb.addInput(txid, vout, 0xffffffff)
txb.addOutput(toSegwitPubkey, receiveAmount - 5000)

var txs = new TxSigner(txb.buildIncomplete())
txs.sign(0, root.keyPair, {
  scriptPubKey: receivePK
})

var tx = txs.done()
console.log(tx.toBuffer().toString('hex'))
