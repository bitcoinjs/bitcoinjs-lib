'use strict';
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (
          !desc ||
          ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)
        ) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, 'default', { enumerable: true, value: v });
      }
    : function (o, v) {
        o['default'] = v;
      });
var __importStar =
  (this && this.__importStar) ||
  function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null)
      for (var k in mod)
        if (k !== 'default' && Object.prototype.hasOwnProperty.call(mod, k))
          __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
  };
Object.defineProperty(exports, '__esModule', { value: true });
exports.getFinalScripts = getFinalScripts;
const payments = __importStar(require('../../payments/index.cjs'));
const psbtutils_js_1 = require('../psbtutils.cjs');
const psbtutils_js_2 = require('../psbtutils.cjs');
const scriptType_js_1 = require('./scriptType.cjs');
const tools = __importStar(require('uint8array-tools'));
function getFinalScripts(inputIndex, input, script, isSegwit, isP2SH, isP2WSH) {
  const scriptType = (0, scriptType_js_1.classifyScript)(script, {
    isP2WPKH: psbtutils_js_2.isP2WPKH,
    isP2PKH: psbtutils_js_2.isP2PKH,
    isP2MS: psbtutils_js_2.isP2MS,
    isP2PK: psbtutils_js_2.isP2PK,
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
      finalScriptWitness = (0, psbtutils_js_1.witnessStackToScriptWitness)(
        p2wsh.witness,
      );
    } else {
      finalScriptWitness = (0, psbtutils_js_1.witnessStackToScriptWitness)(
        payment.witness,
      );
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
