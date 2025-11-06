/**
 * Example: Generate a simple 2-of-3 P2SH multisig address
 * using bitcoinjs-lib on testnet.
 */

import * as bitcoin from 'bitcoinjs-lib';
import { ECPairFactory } from 'ecpair';
import * as tinysecp from 'tiny-secp256k1';

const ECPair = ECPairFactory(tinysecp);

export function generateMultisigAddress() {
  const keys = [
    ECPair.makeRandom({ network: bitcoin.networks.testnet }).publicKey,
    ECPair.makeRandom({ network: bitcoin.networks.testnet }).publicKey,
    ECPair.makeRandom({ network: bitcoin.networks.testnet }).publicKey,
  ];

  const { address } = bitcoin.payments.p2sh({
    redeem: bitcoin.payments.p2ms({ m: 2, pubkeys: keys }),
    network: bitcoin.networks.testnet,
  });

  console.log('Generated 2-of-3 P2SH Testnet Address:', address);
  return address;
}

// generateMultisigAddress();
