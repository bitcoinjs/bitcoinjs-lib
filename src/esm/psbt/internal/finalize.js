import * as payments from '../../payments/index.js';
import { witnessStackToScriptWitness } from '../psbtutils.js';
import { isP2MS, isP2PK, isP2PKH, isP2WPKH } from '../psbtutils.js';
import { classifyScript } from './scriptType.js';
import * as tools from 'uint8array-tools';
export function getFinalScripts(
  inputIndex,
  input,
  script,
  isSegwit,
  isP2SH,
  isP2WSH,
) {
  const scriptType = classifyScript(script, {
    isP2WPKH,
    isP2PKH,
    isP2MS,
    isP2PK,
  });
  if (!canFinalize(input, script, scriptType))
    throw new Error(`Can not finalize input #${inputIndex}`);
  return prepareFinalScripts(
    script,
    scriptType,
    input.partialSig,
    isSegwit,
    isP2SH,
    isP2WSH,
  );
}
function prepareFinalScripts(
  script,
  scriptType,
  partialSig,
  isSegwit,
  isP2SH,
  isP2WSH,
) {
  let finalScriptSig;
  let finalScriptWitness;
  const payment = getPayment(script, scriptType, partialSig);
  const p2wsh = !isP2WSH ? null : payments.p2wsh({ redeem: payment });
  const p2sh = !isP2SH ? null : payments.p2sh({ redeem: p2wsh || payment });
  if (isSegwit) {
    if (p2wsh) {
      finalScriptWitness = witnessStackToScriptWitness(p2wsh.witness);
    } else {
      finalScriptWitness = witnessStackToScriptWitness(payment.witness);
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
function canFinalize(input, script, scriptType) {
  switch (scriptType) {
    case 'pubkey':
    case 'pubkeyhash':
    case 'witnesspubkeyhash':
      return hasSigs(1, input.partialSig);
    case 'multisig':
      const p2ms = payments.p2ms({ output: script });
      return hasSigs(p2ms.m, input.partialSig, p2ms.pubkeys);
    default:
      return false;
  }
}
function hasSigs(neededSigs, partialSig, pubkeys) {
  if (!partialSig) return false;
  let sigs;
  if (pubkeys) {
    sigs = pubkeys
      .map(pkey => {
        const pubkey = compressPubkey(pkey);
        return partialSig.find(
          pSig => tools.compare(pSig.pubkey, pubkey) === 0,
        );
      })
      .filter(v => !!v);
  } else {
    sigs = partialSig;
  }
  if (sigs.length > neededSigs) throw new Error('Too many signatures');
  return sigs.length === neededSigs;
}
function getSortedSigs(script, partialSig) {
  const p2ms = payments.p2ms({ output: script });
  return p2ms.pubkeys
    .map(pk => {
      return (
        partialSig.filter(ps => {
          return tools.compare(ps.pubkey, pk) === 0;
        })[0] || {}
      ).signature;
    })
    .filter(v => !!v);
}
function getPayment(script, scriptType, partialSig) {
  let payment;
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
  return payment;
}
function compressPubkey(pubkey) {
  if (pubkey.length === 65) {
    const parity = pubkey[64] & 1;
    const newKey = pubkey.slice(0, 33);
    newKey[0] = 2 | parity;
    return newKey;
  }
  return pubkey.slice();
}
