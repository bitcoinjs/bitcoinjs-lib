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
var witnessScript = bscript.pubKeyHash.output.encode(pubkeyhash)
var p2shScript = bscript.witnessScriptHash.output.encode(crypto.sha256(witnessScript))
var scriptPubKey = bscript.scriptHash.output.encode(crypto.hash160(p2shScript))

var txid = '2f789c63bb88c0ca844cf9ab5c59e1d6e935fa9ae6d6b5bc2c5251fca549f09d'
var vout = 0
var txOut = {
  script: scriptPubKey,
  value: 90000
}

var builder = new TransactionBuilder(network)
builder.addInput(txid, vout, 0xffffffff, txOut.script)
builder.addOutput('2N6stcWuMpLgt4nkiaEFXP6p9J9VKRHCwDJ', 10000)

var unsigned = builder.buildIncomplete()
var signer = new TxSigner(unsigned)
var opts = {
  scriptPubKey: txOut.script,
  redeemScript: p2shScript,
  witnessScript: witnessScript,
  value: txOut.value
}
signer.sign(0, root.keyPair, opts)

var txd = signer.done()
console.log(txd.toBuffer().toString('hex'))
var testSigner = new TxSigner(txd)

console.log(testSigner.signer(0, opts).isFullySigned());
console.log(testSigner.done().toBuffer().equals(txd.toBuffer()))