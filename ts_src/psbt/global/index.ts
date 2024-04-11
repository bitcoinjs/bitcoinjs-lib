import {
  Bip32Derivation,
  PartialSig,
  PsbtInput,
} from 'bip174/src/lib/interfaces';
import { hasSigs } from './sign';
import * as payments from '../../payments';
import { HDSigner, ScriptType } from '../interfaces';
import { witnessStackToScriptWitness } from '../psbtutils';

const { isP2MS, isP2PK, isP2PKH, isP2WPKH } = payments;

export function getFinalScripts(
  inputIndex: number,
  input: PsbtInput,
  script: Buffer,
  isSegwit: boolean,
  isP2SH: boolean,
  isP2WSH: boolean,
): {
  finalScriptSig: Buffer | undefined;
  finalScriptWitness: Buffer | undefined;
} {
  const scriptType = classifyScript(script);
  if (!canFinalize(input, script, scriptType))
    throw new Error(`Can not finalize input #${inputIndex}`);
  return prepareFinalScripts(
    script,
    scriptType,
    input.partialSig!,
    isSegwit,
    isP2SH,
    isP2WSH,
  );
}

export function bip32DerivationIsMine(
  root: HDSigner,
): (d: Bip32Derivation) => boolean {
  return (d: Bip32Derivation): boolean => {
    if (!d.masterFingerprint.equals(root.fingerprint)) return false;
    if (!root.derivePath(d.path).publicKey.equals(d.pubkey)) return false;
    return true;
  };
}

function prepareFinalScripts(
  script: Buffer,
  scriptType: string,
  partialSig: PartialSig[],
  isSegwit: boolean,
  isP2SH: boolean,
  isP2WSH: boolean,
): {
  finalScriptSig: Buffer | undefined;
  finalScriptWitness: Buffer | undefined;
} {
  let finalScriptSig: Buffer | undefined;
  let finalScriptWitness: Buffer | undefined;

  // Wow, the payments API is very handy
  const payment: payments.Payment = getPayment(script, scriptType, partialSig);
  const p2wsh = !isP2WSH ? null : payments.p2wsh({ redeem: payment });
  const p2sh = !isP2SH ? null : payments.p2sh({ redeem: p2wsh || payment });

  if (isSegwit) {
    if (p2wsh) {
      finalScriptWitness = witnessStackToScriptWitness(p2wsh.witness!);
    } else {
      finalScriptWitness = witnessStackToScriptWitness(payment.witness!);
    }
    if (p2sh) {
      finalScriptSig = p2sh.input;
    }
  } else {
    if (p2sh) {
      finalScriptSig = p2sh.input;
    } else {
      finalScriptSig = payment.input;
    }
  }
  return {
    finalScriptSig,
    finalScriptWitness,
  };
}
function getPayment(
  script: Buffer,
  scriptType: string,
  partialSig: PartialSig[],
): payments.Payment {
  let payment: payments.Payment;
  switch (scriptType) {
    case 'multisig':
      const sigs = getSortedSigs(script, partialSig);
      payment = payments.p2ms({
        output: script,
        signatures: sigs,
      });
      break;
    case 'pubkey':
      payment = payments.p2pk({
        output: script,
        signature: partialSig[0].signature,
      });
      break;
    case 'pubkeyhash':
      payment = payments.p2pkh({
        output: script,
        pubkey: partialSig[0].pubkey,
        signature: partialSig[0].signature,
      });
      break;
    case 'witnesspubkeyhash':
      payment = payments.p2wpkh({
        output: script,
        pubkey: partialSig[0].pubkey,
        signature: partialSig[0].signature,
      });
      break;
  }
  return payment!;
}

function getSortedSigs(script: Buffer, partialSig: PartialSig[]): Buffer[] {
  const p2ms = payments.p2ms({ output: script });
  // for each pubkey in order of p2ms script
  return p2ms
    .pubkeys!.map(pk => {
      // filter partialSig array by pubkey being equal
      return (
        partialSig.filter(ps => {
          return ps.pubkey.equals(pk);
        })[0] || {}
      ).signature;
      // Any pubkey without a match will return undefined
      // this last filter removes all the undefined items in the array.
    })
    .filter(v => !!v);
}

function classifyScript(script: Buffer): ScriptType {
  if (isP2WPKH(script)) return 'witnesspubkeyhash';
  if (isP2PKH(script)) return 'pubkeyhash';
  if (isP2MS(script)) return 'multisig';
  if (isP2PK(script)) return 'pubkey';
  return 'nonstandard';
}

export function canFinalize(
  input: PsbtInput,
  script: Buffer,
  scriptType: string,
): boolean {
  switch (scriptType) {
    case 'pubkey':
    case 'pubkeyhash':
    case 'witnesspubkeyhash':
      return hasSigs(1, input.partialSig);
    case 'multisig':
      const p2ms = payments.p2ms({ output: script });
      return hasSigs(p2ms.m!, input.partialSig, p2ms.pubkeys);
    default:
      return false;
  }
}

export function isFinalized(input: PsbtInput): boolean {
  return !!input.finalScriptSig || !!input.finalScriptWitness;
}
