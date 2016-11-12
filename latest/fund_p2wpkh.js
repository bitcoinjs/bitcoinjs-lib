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

var pubkeyhash = crypto.hash160(root.keyPair.getPublicKeyBuffer())

var txid = '9aa8d1a1c5df0afccf76e84df1029062b65a98dad68e13cc765aef88ab378dd0'
var vout = 0
var scriptPubKey = bscript.pubKeyHash.output.encode(pubkeyhash)
var amount = 22000

var toSegwitPubkey = bscript.witnessPubKeyHash.output.encode(pubkeyhash)

var txb = new TransactionBuilder(network)
txb.addInput(txid, vout, 0xffffffff, scriptPubKey)
txb.addOutput(toSegwitPubkey, amount - 5000)
txb.sign(0, root.keyPair)
var tx = txb.build()
console.log(tx.toBuffer().toString('hex'))
