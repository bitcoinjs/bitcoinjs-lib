import { PsbtInput } from 'bip174/src/lib/interfaces';
import * as bscript from '../script';
import {
  HDSigner,
  HDSignerAsync,
  PsbtCache,
  PsbtOpts,
  Signer,
  SignerAsync,
} from './interfaces';
import { Psbt } from '../psbt';
import { checkForInput } from 'bip174/src/lib/utils';

export function check32Bit(num: number): void {
  if (
    typeof num !== 'number' ||
    num !== Math.floor(num) ||
    num > 0xffffffff ||
    num < 0
  ) {
    throw new Error('Invalid 32 bit integer');
  }
}

export function checkFees(psbt: Psbt, cache: PsbtCache, opts: PsbtOpts): void {
  const feeRate = cache.__FEE_RATE || psbt.getFeeRate();
  const vsize = cache.__EXTRACTED_TX!.virtualSize();
  const satoshis = feeRate * vsize;
  if (feeRate >= opts.maximumFeeRate) {
    throw new Error(
      `Warning: You are paying around ${(satoshis / 1e8).toFixed(8)} in ` +
        `fees, which is ${feeRate} satoshi per byte for a transaction ` +
        `with a VSize of ${vsize} bytes (segwit counted as 0.25 byte per ` +
        `byte). Use setMaximumFeeRate method to raise your threshold, or ` +
        `pass true to the first arg of extractTransaction.`,
    );
  }
}

export function getSignersFromHD(
  inputIndex: number,
  inputs: PsbtInput[],
  hdKeyPair: HDSigner | HDSignerAsync,
): Array<Signer | SignerAsync> {
  const input = checkForInput(inputs, inputIndex);
  if (!input.bip32Derivation || input.bip32Derivation.length === 0) {
    throw new Error('Need bip32Derivation to sign with HD');
  }
  const myDerivations = input.bip32Derivation
    .map(bipDv => {
      if (bipDv.masterFingerprint.equals(hdKeyPair.fingerprint)) {
        return bipDv;
      } else {
        return;
      }
    })
    .filter(v => !!v);
  if (myDerivations.length === 0) {
    throw new Error(
      'Need one bip32Derivation masterFingerprint to match the HDSigner fingerprint',
    );
  }
  const signers: Array<Signer | SignerAsync> = myDerivations.map(bipDv => {
    const node = hdKeyPair.derivePath(bipDv!.path);
    if (!bipDv!.pubkey.equals(node.publicKey)) {
      throw new Error('pubkey did not match bip32Derivation');
    }
    return node;
  });
  return signers;
}

export function range(n: number): number[] {
  return [...Array(n).keys()];
}

export function isPubkeyLike(buf: Buffer): boolean {
  return buf.length === 33 && bscript.isCanonicalPubKey(buf);
}
