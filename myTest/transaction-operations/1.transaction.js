var assert = require('assert')
var bitcoin = require('../../')
var regtestUtils = require('./../_regtest')
var regtest = regtestUtils.network

// Random generator
function rng () {
  return Buffer.from('YT8dAtK4d16A3P1z+TpwB2jJ4aFH3g9M1EioIBkLEV4=', 'base64')
}

// importing PrivateKey from WIF
var alice = bitcoin.ECPair.fromWIF('L1uyy5qTuGrVXrmrsvHWHgVzW9kKdrp27wBC7Vs6nZDTF2BRUVwy')
var txb = new bitcoin.TransactionBuilder()

// Fees are not specified, the difference of the input and output is taken by miner as fees
txb.addInput('61d520ccb74288c96bc1a2b20ea1c0d5a704776dd0164a396efec3ea7040349d', 0) // Alice's previous transaction output, has 15000 satoshis
txb.addOutput('1cMh228HTCiwS8ZsaakH8A8wze1JR5ZsP', 12000)
// (in)15000 - (out)12000 = (fee)3000, this is the miner fee

// console.log(txb);

txb.sign(0, alice)
// Alice to sign her transaction

// convert transaction to hex and prepare to broadcast it to bitcoin network
console.log( 'Transaction to be broadcasted to Bitcoin network in hex format :'+'\n'+txb.build().toHex())
