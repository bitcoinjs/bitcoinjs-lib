/**
 * Example: Generate and validate a SegWit (P2WPKH) Bitcoin address
 *
 * This short example shows how to generate a Bech32 address,
 * verify it, and display the result using bitcoinjs-lib.
 */

import * as bitcoin from 'bitcoinjs-lib';
import { ECPairFactory } from 'ecpair';
import * as tinysecp from 'tiny-secp256k1';

const ECPair = ECPairFactory(tinysecp);

export function generateSegWitAddress() {
  const keyPair = ECPair.makeRandom();
  const { address } = bitcoin.payments.p2wpkh({
    pubkey: keyPair.publicKey,
    network: bitcoin.networks.testnet,
  });

  const isValid = bitcoin.address.fromBech32(address).prefix === 'tb';

  console.log('Generated Testnet SegWit Address:', address);
  console.log('Address valid:', isValid);

  return { address, isValid };
}

// Uncomment below for direct testing
// generateSegWitAddress();
