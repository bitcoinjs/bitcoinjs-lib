import * as varuint from 'varuint-bitcoin';
import { PartialSig, PsbtInput } from 'bip174';
import * as bscript from '../script.js';
import { Transaction } from '../transaction.js';
import { hash160 } from '../crypto.js';
import * as payments from '../payments/index.js';
import * as tools from 'uint8array-tools';

/**
 * Checks if a given payment factory can generate a payment script from a given script.
 * @param payment The payment factory to check.
 * @returns A function that takes a script and returns a boolean indicating whether the payment factory can generate a payment script from the script.
 */
function isPaymentFactory(payment: any): (script: Uint8Array) => boolean {
  return (script: Uint8Array): boolean => {
    try {
      payment({ output: script });
      return true;
    } catch (err) {
      return false;
    }
  };
}

export const isP2MS = isPaymentFactory(payments.p2ms);
export const isP2PK = isPaymentFactory(payments.p2pk);
export const isP2PKH = isPaymentFactory(payments.p2pkh);
export const isP2WPKH = isPaymentFactory(payments.p2wpkh);
export const isP2WSHScript = isPaymentFactory(payments.p2wsh);
export const isP2SHScript = isPaymentFactory(payments.p2sh);
export const isP2TR = isPaymentFactory(payments.p2tr);

/**
 * Converts a witness stack to a script witness.
 * @param witness The witness stack to convert.
 * @returns The script witness as a Buffer.
 */
export function witnessStackToScriptWitness(witness: Uint8Array[]): Uint8Array {
  let buffer = new Uint8Array(0);

  function writeSlice(slice: Uint8Array): void {
    buffer = tools.concat([buffer, slice]);
  }

  function writeVarInt(i: number): void {
    const currentLen = buffer.length;
    const varintLen = varuint.encodingLength(i);

    buffer = tools.concat([buffer, new Uint8Array(varintLen)]);
    varuint.encode(i, buffer, currentLen);
  }

  function writeVarSlice(slice: Uint8Array): void {
    writeVarInt(slice.length);
    writeSlice(slice);
  }

  function writeVector(vector: Uint8Array[]): void {
    writeVarInt(vector.length);
    vector.forEach(writeVarSlice);
  }

  writeVector(witness);

  return buffer;
}

/**
 * Finds the position of a public key in a script.
 * @param pubkey The public key to search for.
 * @param script The script to search in.
 * @returns The index of the public key in the script, or -1 if not found.
 * @throws {Error} If there is an unknown script error.
 */
export function pubkeyPositionInScript(
  pubkey: Uint8Array,
  script: Uint8Array,
): number {
  const pubkeyHash = hash160(pubkey);
  const pubkeyXOnly = pubkey.slice(1, 33); // slice before calling?

  const decompiled = bscript.decompile(script);
  if (decompiled === null) throw new Error('Unknown script error');

  return decompiled.findIndex(element => {
    if (typeof element === 'number') return false;
    return (
      tools.compare(pubkey, element) === 0 ||
      tools.compare(pubkeyHash, element) === 0 ||
      tools.compare(pubkeyXOnly, element) === 0
    );
  });
}

/**
 * Checks if a public key is present in a script.
 * @param pubkey The public key to check.
 * @param script The script to search in.
 * @returns A boolean indicating whether the public key is present in the script.
 */
export function pubkeyInScript(
  pubkey: Uint8Array,
  script: Uint8Array,
): boolean {
  return pubkeyPositionInScript(pubkey, script) !== -1;
}

/**
 * Checks if an input contains a signature for a specific action.
 * @param input - The input to check.
 * @param action - The action to check for.
 * @returns A boolean indicating whether the input contains a signature for the specified action.
 */
export function checkInputForSig(input: PsbtInput, action: string): boolean {
  const pSigs = extractPartialSigs(input);
  return pSigs.some(pSig =>
    signatureBlocksAction(pSig, bscript.signature.decode, action),
  );
}

type SignatureDecodeFunc = (buffer: Uint8Array) => {
  signature: Uint8Array;
  hashType: number;
};

/**
 * Determines if a given action is allowed for a signature block.
 * @param signature - The signature block.
 * @param signatureDecodeFn - The function used to decode the signature.
 * @param action - The action to be checked.
 * @returns True if the action is allowed, false otherwise.
 */
export function signatureBlocksAction(
  signature: Uint8Array,
  signatureDecodeFn: SignatureDecodeFunc,
  action: string,
): boolean {
  const { hashType } = signatureDecodeFn(signature);
  const whitelist: string[] = [];
  const isAnyoneCanPay = hashType & Transaction.SIGHASH_ANYONECANPAY;
  if (isAnyoneCanPay) whitelist.push('addInput');
  const hashMod = hashType & 0x1f;
  switch (hashMod) {
    case Transaction.SIGHASH_ALL:
      break;
    case Transaction.SIGHASH_SINGLE:
    case Transaction.SIGHASH_NONE:
      whitelist.push('addOutput');
      whitelist.push('setInputSequence');
      break;
  }
  if (whitelist.indexOf(action) === -1) {
    return true;
  }
  return false;
}

/**
 * Extracts the signatures from a PsbtInput object.
 * If the input has partial signatures, it returns an array of the signatures.
 * If the input does not have partial signatures, it checks if it has a finalScriptSig or finalScriptWitness.
 * If it does, it extracts the signatures from the final scripts and returns them.
 * If none of the above conditions are met, it returns an empty array.
 *
 * @param input - The PsbtInput object from which to extract the signatures.
 * @returns An array of signatures extracted from the PsbtInput object.
 */
function extractPartialSigs(input: PsbtInput): Uint8Array[] {
  let pSigs: PartialSig[] = [];
  if ((input.partialSig || []).length === 0) {
    if (!input.finalScriptSig && !input.finalScriptWitness) return [];
    pSigs = getPsigsFromInputFinalScripts(input);
  } else {
    pSigs = input.partialSig!;
  }
  return pSigs.map(p => p.signature);
}

/**
 * Retrieves the partial signatures (Psigs) from the input's final scripts.
 * Psigs are extracted from both the final scriptSig and final scriptWitness of the input.
 * Only canonical script signatures are considered.
 *
 * @param input - The PsbtInput object representing the input.
 * @returns An array of PartialSig objects containing the extracted Psigs.
 */
function getPsigsFromInputFinalScripts(input: PsbtInput): PartialSig[] {
  const scriptItems = !input.finalScriptSig
    ? []
    : bscript.decompile(input.finalScriptSig) || [];
  const witnessItems = !input.finalScriptWitness
    ? []
    : bscript.decompile(input.finalScriptWitness) || [];
  return scriptItems
    .concat(witnessItems)
    .filter(item => {
      return (
        item instanceof Uint8Array && bscript.isCanonicalScriptSignature(item)
      );
    })
    .map(sig => ({ signature: sig })) as PartialSig[];
}
