import { PsbtInput } from 'bip174/src/lib/interfaces';
import { PsbtCache } from '../interfaces';
import { checkForInput } from 'bip174/src/lib/utils';
import {
  checkScriptForPubkey,
  getMeaningfulScript,
  getScriptAndAmountFromUtxo,
  pubkeyInScript,
} from '../input/script';
import { Output, Transaction } from '../../transaction';
import { nonWitnessUtxoTxFromCache } from './cache';
import * as payments from '../../payments';
import { getPrevoutTaprootKey } from '../input';
import { toXOnly } from '../bip371';
import { tapleafHash } from '../../payments/bip341';

const { isP2WPKH } = payments;

export function getHashAndSighashType(
  inputs: PsbtInput[],
  inputIndex: number,
  pubkey: Buffer,
  cache: PsbtCache,
  sighashTypes: number[],
): {
  hash: Buffer;
  sighashType: number;
} {
  const input = checkForInput(inputs, inputIndex);
  const { hash, sighashType, script } = getHashForSig(
    inputIndex,
    input,
    cache,
    false,
    sighashTypes,
  );
  checkScriptForPubkey(pubkey, script, 'sign');
  return {
    hash,
    sighashType,
  };
}

export function getHashForSig(
  inputIndex: number,
  input: PsbtInput,
  cache: PsbtCache,
  forValidate: boolean,
  sighashTypes?: number[],
): {
  script: Buffer;
  hash: Buffer;
  sighashType: number;
} {
  const unsignedTx = cache.__TX;
  const sighashType = input.sighashType || Transaction.SIGHASH_ALL;
  checkSighashTypeAllowed(sighashType, sighashTypes);

  let hash: Buffer;
  let prevout: Output;

  if (input.nonWitnessUtxo) {
    const nonWitnessUtxoTx = nonWitnessUtxoTxFromCache(
      cache,
      input,
      inputIndex,
    );

    const prevoutHash = unsignedTx.ins[inputIndex].hash;
    const utxoHash = nonWitnessUtxoTx.getHash();

    // If a non-witness UTXO is provided, its hash must match the hash specified in the prevout
    if (!prevoutHash.equals(utxoHash)) {
      throw new Error(
        `Non-witness UTXO hash for input #${inputIndex} doesn't match the hash specified in the prevout`,
      );
    }

    const prevoutIndex = unsignedTx.ins[inputIndex].index;
    prevout = nonWitnessUtxoTx.outs[prevoutIndex] as Output;
  } else if (input.witnessUtxo) {
    prevout = input.witnessUtxo;
  } else {
    throw new Error('Need a Utxo input item for signing');
  }

  const { meaningfulScript, type } = getMeaningfulScript(
    prevout.script,
    inputIndex,
    'input',
    input.redeemScript,
    input.witnessScript,
  );

  if (['p2sh-p2wsh', 'p2wsh'].indexOf(type) >= 0) {
    hash = unsignedTx.hashForWitnessV0(
      inputIndex,
      meaningfulScript,
      prevout.value,
      sighashType,
    );
  } else if (isP2WPKH(meaningfulScript)) {
    // P2WPKH uses the P2PKH template for prevoutScript when signing
    const signingScript = payments.p2pkh({ hash: meaningfulScript.slice(2) })
      .output!;
    hash = unsignedTx.hashForWitnessV0(
      inputIndex,
      signingScript,
      prevout.value,
      sighashType,
    );
  } else {
    // non-segwit
    if (
      input.nonWitnessUtxo === undefined &&
      cache.__UNSAFE_SIGN_NONSEGWIT === false
    )
      throw new Error(
        `Input #${inputIndex} has witnessUtxo but non-segwit script: ` +
          `${meaningfulScript.toString('hex')}`,
      );
    if (!forValidate && cache.__UNSAFE_SIGN_NONSEGWIT !== false)
      console.warn(
        'Warning: Signing non-segwit inputs without the full parent transaction ' +
          'means there is a chance that a miner could feed you incorrect information ' +
          "to trick you into paying large fees. This behavior is the same as Psbt's predecessor " +
          '(TransactionBuilder - now removed) when signing non-segwit scripts. You are not ' +
          'able to export this Psbt with toBuffer|toBase64|toHex since it is not ' +
          'BIP174 compliant.\n*********************\nPROCEED WITH CAUTION!\n' +
          '*********************',
      );
    hash = unsignedTx.hashForSignature(
      inputIndex,
      meaningfulScript,
      sighashType,
    );
  }

  return {
    script: meaningfulScript,
    sighashType,
    hash,
  };
}

export function getAllTaprootHashesForSig(
  inputIndex: number,
  input: PsbtInput,
  inputs: PsbtInput[],
  cache: PsbtCache,
): { pubkey: Buffer; hash: Buffer; leafHash?: Buffer }[] {
  const allPublicKeys = [];
  if (input.tapInternalKey) {
    const key = getPrevoutTaprootKey(inputIndex, input, cache);
    if (key) {
      allPublicKeys.push(key);
    }
  }

  if (input.tapScriptSig) {
    const tapScriptPubkeys = input.tapScriptSig.map(tss => tss.pubkey);
    allPublicKeys.push(...tapScriptPubkeys);
  }

  const allHashes = allPublicKeys.map(pubicKey =>
    getTaprootHashesForSig(inputIndex, input, inputs, pubicKey, cache),
  );

  return allHashes.flat();
}

export function getTaprootHashesForSig(
  inputIndex: number,
  input: PsbtInput,
  inputs: PsbtInput[],
  pubkey: Buffer,
  cache: PsbtCache,
  tapLeafHashToSign?: Buffer,
  allowedSighashTypes?: number[],
): { pubkey: Buffer; hash: Buffer; leafHash?: Buffer }[] {
  const unsignedTx = cache.__TX;

  const sighashType = input.sighashType || Transaction.SIGHASH_DEFAULT;
  checkSighashTypeAllowed(sighashType, allowedSighashTypes);

  const prevOuts: Output[] = inputs.map((i, index) =>
    getScriptAndAmountFromUtxo(index, i, cache),
  );
  const signingScripts = prevOuts.map(o => o.script);
  const values = prevOuts.map(o => o.value);

  const hashes = [];
  if (input.tapInternalKey && !tapLeafHashToSign) {
    const outputKey =
      getPrevoutTaprootKey(inputIndex, input, cache) || Buffer.from([]);
    if (toXOnly(pubkey).equals(outputKey)) {
      const tapKeyHash = unsignedTx.hashForWitnessV1(
        inputIndex,
        signingScripts,
        values,
        sighashType,
      );
      hashes.push({ pubkey, hash: tapKeyHash });
    }
  }

  const tapLeafHashes = (input.tapLeafScript || [])
    .filter(tapLeaf => pubkeyInScript(pubkey, tapLeaf.script))
    .map(tapLeaf => {
      const hash = tapleafHash({
        output: tapLeaf.script,
        version: tapLeaf.leafVersion,
      });
      return Object.assign({ hash }, tapLeaf);
    })
    .filter(
      tapLeaf => !tapLeafHashToSign || tapLeafHashToSign.equals(tapLeaf.hash),
    )
    .map(tapLeaf => {
      const tapScriptHash = unsignedTx.hashForWitnessV1(
        inputIndex,
        signingScripts,
        values,
        Transaction.SIGHASH_DEFAULT,
        tapLeaf.hash,
      );

      return {
        pubkey,
        hash: tapScriptHash,
        leafHash: tapLeaf.hash,
      };
    });

  return hashes.concat(tapLeafHashes);
}

function checkSighashTypeAllowed(
  sighashType: number,
  sighashTypes?: number[],
): void {
  if (sighashTypes && sighashTypes.indexOf(sighashType) < 0) {
    const str = sighashTypeToString(sighashType);
    throw new Error(
      `Sighash type is not allowed. Retry the sign method passing the ` +
        `sighashTypes array of whitelisted types. Sighash type: ${str}`,
    );
  }
}

function sighashTypeToString(sighashType: number): string {
  let text =
    sighashType & Transaction.SIGHASH_ANYONECANPAY
      ? 'SIGHASH_ANYONECANPAY | '
      : '';
  const sigMod = sighashType & 0x1f;
  switch (sigMod) {
    case Transaction.SIGHASH_ALL:
      text += 'SIGHASH_ALL';
      break;
    case Transaction.SIGHASH_SINGLE:
      text += 'SIGHASH_SINGLE';
      break;
    case Transaction.SIGHASH_NONE:
      text += 'SIGHASH_NONE';
      break;
  }
  return text;
}
