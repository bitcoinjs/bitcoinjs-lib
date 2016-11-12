var bitcoin = require('../src/index.js')

var bscript = bitcoin.script
var crypto = bitcoin.crypto
var networks = bitcoin.networks
// var baddress = bitcoin.address
var TransactionBuilder = bitcoin.TransactionBuilder
var TxSigner = bitcoin.TxSigner
var network = networks.testnet

var entropy = new Buffer('14bdfeac14bdfeac14bdfeac1100feac14bdfeac14bdfeac14bdfeac14bdfeac') // my entropy
var root = bitcoin.HDNode.fromSeedBuffer(entropy, network)

var pubkeyhash = crypto.hash160(root.keyPair.getPublicKeyBuffer())
// redeem script
var toSegwitPubkey = bscript.witnessPubKeyHash.output.encode(pubkeyhash)
// aixo es l-envoltori del p2sh crec
var p2sh = bscript.scriptHash.output.encode(crypto.hash160(toSegwitPubkey))
// on hem rebut la pasta inicial
// var receiveAddress = baddress.toBase58Check(crypto.hash160(toSegwitPubkey), network.scriptHash)

// txhash de la tx que estem gastant
var txhashUnspent = 'b085099291d44edecfb3a98384f4266282964fe7b0a12d6db9169698cb7e6487'
var vout = 0
// on gastarem la pasta despres

var myaddress = '2N6stcWuMpLgt4nkiaEFXP6p9J9VKRHCwDJ'

var txOut = {
  script: p2sh,
  value: 30000
}

var txb = new TransactionBuilder(network)
txb.addInput(txhashUnspent, vout, 0xffffffff, p2sh)
txb.addOutput(myaddress, txOut.value - 5000)

var unsigned = txb.buildIncomplete()
var signer = new TxSigner(unsigned)

var opts = {
  scriptPubKey: txOut.script,
  redeemScript: toSegwitPubkey,
  value: txOut.value
}
signer.sign(0, root.keyPair, opts)
var txd = signer.done()
console.log(txd.toBuffer().toString('hex'))

var testSigner = new TxSigner(txd)

console.log(testSigner.signer(0, opts).isFullySigned());
console.log(testSigner.done().toBuffer().equals(txd.toBuffer()))