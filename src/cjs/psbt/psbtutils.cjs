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
exports.isP2TR =
  exports.isP2SHScript =
  exports.isP2WSHScript =
  exports.isP2WPKH =
  exports.isP2PKH =
  exports.isP2PK =
  exports.isP2MS =
    void 0;
exports.witnessStackToScriptWitness = witnessStackToScriptWitness;
exports.pubkeyPositionInScript = pubkeyPositionInScript;
exports.pubkeyInScript = pubkeyInScript;
exports.checkInputForSig = checkInputForSig;
exports.signatureBlocksAction = signatureBlocksAction;
const varuint = __importStar(require('varuint-bitcoin'));
const bscript = __importStar(require('../script.cjs'));
const transaction_js_1 = require('../transaction.cjs');
const crypto_js_1 = require('../crypto.cjs');
const payments = __importStar(require('../payments/index.cjs'));
const tools = __importStar(require('uint8array-tools'));
/**
 * Checks if a given payment factory can generate a payment script from a given script.
 * @param payment The payment factory to check.
 * @returns A function that takes a script and returns a boolean indicating whether the payment factory can generate a payment script from the script.
 */
function isPaymentFactory(payment) {
  return script => {
    try {
      payment({ output: script });
      return true;
    } catch (err) {
      return false;
    }
  };
}
exports.isP2MS = isPaymentFactory(payments.p2ms);
exports.isP2PK = isPaymentFactory(payments.p2pk);
exports.isP2PKH = isPaymentFactory(payments.p2pkh);
exports.isP2WPKH = isPaymentFactory(payments.p2wpkh);
exports.isP2WSHScript = isPaymentFactory(payments.p2wsh);
exports.isP2SHScript = isPaymentFactory(payments.p2sh);
exports.isP2TR = isPaymentFactory(payments.p2tr);
/**
 * Converts a witness stack to a script witness.
 * @param witness The witness stack to convert.
 * @returns The script witness as a Buffer.
 */
function witnessStackToScriptWitness(witness) {
  let buffer = new Uint8Array(0);
  function writeSlice(slice) {
    buffer = tools.concat([buffer, slice]);
  }
  function writeVarInt(i) {
    const currentLen = buffer.length;
    const varintLen = varuint.encodingLength(i);
    buffer = tools.concat([buffer, new Uint8Array(varintLen)]);
    varuint.encode(i, buffer, currentLen);
  }
  function writeVarSlice(slice) {
    writeVarInt(slice.length);
    writeSlice(slice);
  }
  function writeVector(vector) {
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
function pubkeyPositionInScript(pubkey, script) {
  const pubkeyHash = (0, crypto_js_1.hash160)(pubkey);
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
function pubkeyInScript(pubkey, script) {
  return pubkeyPositionInScript(pubkey, script) !== -1;
}
/**
 * Checks if an input contains a signature for a specific action.
 * @param input - The input to check.
 * @param action - The action to check for.
 * @returns A boolean indicating whether the input contains a signature for the specified action.
 */
function checkInputForSig(input, action) {
  const pSigs = extractPartialSigs(input);
  return pSigs.some(pSig =>
    signatureBlocksAction(pSig, bscript.signature.decode, action),
  );
}
/**
 * Determines if a given action is allowed for a signature block.
 * @param signature - The signature block.
 * @param signatureDecodeFn - The function used to decode the signature.
 * @param action - The action to be checked.
 * @returns True if the action is allowed, false otherwise.
 */
function signatureBlocksAction(signature, signatureDecodeFn, action) {
  const { hashType } = signatureDecodeFn(signature);
  const whitelist = [];
  const isAnyoneCanPay =
    hashType & transaction_js_1.Transaction.SIGHASH_ANYONECANPAY;
  if (isAnyoneCanPay) whitelist.push('addInput');
  const hashMod = hashType & 0x1f;
  switch (hashMod) {
    case transaction_js_1.Transaction.SIGHASH_ALL:
      break;
    case transaction_js_1.Transaction.SIGHASH_SINGLE:
    case transaction_js_1.Transaction.SIGHASH_NONE:
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
function extractPartialSigs(input) {
  let pSigs = [];
  if ((input.partialSig || []).length === 0) {
    if (!input.finalScriptSig && !input.finalScriptWitness) return [];
    pSigs = getPsigsFromInputFinalScripts(input);
  } else {
    pSigs = input.partialSig;
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
function getPsigsFromInputFinalScripts(input) {
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
    .map(sig => ({ signature: sig }));
}
