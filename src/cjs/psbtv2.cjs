'use strict';
/**
 * PSBTv2 (BIP-370) implementation for bitcoinjs-lib
 *
 * Lives at ts_src/psbtv2.ts alongside ts_src/psbt.ts.
 * Extends PSBTv2Builder from bip370 with Bitcoin-aware functionality,
 * mirroring the API of the existing Psbt class where possible.
 *
 * Usage:
 *   import { PsbtV2 } from './psbtv2.js';
 *   const psbt = new PsbtV2({ network: networks.testnet });
 *   psbt.addInputExtended({ hash: txid, index: 0, witnessUtxo: { script, value } });
 *   psbt.addOutput({ address: 'tb1q...', value: 50000n });
 *   psbt.signInput(0, ecPair);
 *   psbt.finalizeAllInputs();
 *   const tx = psbt.toTransaction();
 */
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
exports.PsbtV2 = exports.toXOnly = exports.ValidationErrorContainer = void 0;
const bip370_1 = require('bip370');
const errors_1 = require('bip370/errors');
Object.defineProperty(exports, 'ValidationErrorContainer', {
  enumerable: true,
  get: function () {
    return errors_1.ValidationErrorContainer;
  },
});
const fields_1 = require('bip370/fields');
const fields_2 = require('bip370/fields');
const utils_1 = require('bip370/utils');
const address_js_1 = require('./address.cjs');
const networks_js_1 = require('./networks.cjs');
const payments = __importStar(require('./payments/index.cjs'));
const bscript = __importStar(require('./script.cjs'));
const transaction_js_1 = require('./transaction.cjs');
const bip371_js_1 = require('./psbt/bip371.cjs');
Object.defineProperty(exports, 'toXOnly', {
  enumerable: true,
  get: function () {
    return bip371_js_1.toXOnly;
  },
});
const bip341_js_1 = require('./payments/bip341.cjs');
const psbtutils_js_1 = require('./psbt/psbtutils.cjs');
const uint8array_tools_1 = require('uint8array-tools');
// ─── Adapter ─────────────────────────────────────────────────────────────────
class PsbtV2 extends bip370_1.PSBTv2Builder {
  network;
  maximumFeeRate;
  constructor(opts = {}) {
    super();
    this.network = opts.network ?? networks_js_1.bitcoin;
    this.maximumFeeRate = opts.maximumFeeRate ?? 5000;
    // BIP-370 requires these four globals to be present from construction
    this.setGlobal(
      fields_1.GlobalTypes.PSBT_VERSION,
      fields_2.GlobalField[fields_1.GlobalTypes.PSBT_VERSION].encode(2).value,
    );
    this.setGlobal(
      fields_1.GlobalTypes.TX_VERSION,
      fields_2.GlobalField[fields_1.GlobalTypes.TX_VERSION].encode(2).value,
    );
    this.setGlobal(
      fields_1.GlobalTypes.INPUT_COUNT,
      fields_2.GlobalField[fields_1.GlobalTypes.INPUT_COUNT].encode(0).value,
    );
    this.setGlobal(
      fields_1.GlobalTypes.OUTPUT_COUNT,
      fields_2.GlobalField[fields_1.GlobalTypes.OUTPUT_COUNT].encode(0).value,
    );
  }
  setMaximumFeeRate(satoshiPerByte) {
    this.maximumFeeRate = satoshiPerByte;
  }
  // ─── Creator ───────────────────────────────────────────────────────────────
  /**
   * Mirrors Psbt.addInput() — hash + index plus any input update fields
   * in a single object. Splits into addInput() + updateInput() internally.
   */
  addInputExtended(data) {
    const {
      hash,
      index,
      witnessUtxo,
      nonWitnessUtxo,
      redeemScript,
      witnessScript,
      sighashType,
      bip32Derivation,
      tapInternalKey,
      tapMerkleRoot,
      tapBip32Derivation,
      tapLeafScript,
      sequence,
      requiredTimeLockTime,
      requiredHeightLockTime,
    } = data;
    this.addInput({ hash, index });
    const inputUpdate = {
      witnessUtxo,
      nonWitnessUtxo,
      redeemScript,
      witnessScript,
      sighashType,
      tapInternalKey,
      tapMerkleRoot,
      tapLeafScript,
      sequence,
      requiredTimeLockTime,
      requiredHeightLockTime,
      // bip174 path is string, bip370 expects number[] — structurally compatible at runtime
      bip32Derivation: bip32Derivation,
      tapBip32Derivation: tapBip32Derivation,
    };
    if (Object.values(inputUpdate).some(v => v !== undefined)) {
      this.updateInput(this.inputCount - 1, inputUpdate);
    }
    return this;
  }
  /**
   * Mirrors Psbt.addOutput() — accepts address or script plus value and any
   * output update fields. Address-to-script conversion is network-aware.
   */
  addOutput(data) {
    const script =
      'address' in data
        ? (0, address_js_1.toOutputScript)(data.address, this.network)
        : data.script;
    const outputIndex = super.addOutput({ script, value: data.value });
    const {
      redeemScript,
      witnessScript,
      bip32Derivation,
      tapInternalKey,
      tapTree,
      tapBip32Derivation,
    } = data;
    const outputUpdate = {
      redeemScript,
      witnessScript,
      tapInternalKey,
      tapTree,
      // bip174 path is string, bip370 expects number[] — compatible at runtime
      bip32Derivation: bip32Derivation,
      tapBip32Derivation: tapBip32Derivation,
    };
    if (Object.values(outputUpdate).some(v => v !== undefined)) {
      this.updateOutput(this.outputCount - 1, outputUpdate);
    }
    return outputIndex;
  }
  // ─── Signer ────────────────────────────────────────────────────────────────
  /**
   * Sign an input. Computes the sighash internally from UTXO data,
   * mirroring Psbt.signInput(). Handles legacy, segwit, and Taproot inputs.
   * For Taproot, pass tapLeafHashToSign for script-path, omit for key-path.
   */
  signInput(inputIndex, keyPair, tapLeafHashToSign, sighashTypes) {
    if (!keyPair?.publicKey) throw new Error('Need Signer to sign input');
    return this._isTaprootInput(inputIndex)
      ? this._signTaprootInput(
          inputIndex,
          keyPair,
          tapLeafHashToSign,
          sighashTypes,
        )
      : this._signNonTaprootInput(inputIndex, keyPair, sighashTypes);
  }
  signInputAsync(inputIndex, keyPair, tapLeafHashToSign, sighashTypes) {
    return Promise.resolve().then(() => {
      if (!keyPair?.publicKey) throw new Error('Need Signer to sign input');
      return this._isTaprootInput(inputIndex)
        ? this._signTaprootInputAsync(
            inputIndex,
            keyPair,
            tapLeafHashToSign,
            sighashTypes,
          )
        : this._signNonTaprootInputAsync(inputIndex, keyPair, sighashTypes);
    });
  }
  _signNonTaprootInput(
    inputIndex,
    keyPair,
    sighashTypes = [transaction_js_1.Transaction.SIGHASH_ALL],
  ) {
    const { hash, sighashType } = this._getHashForInput(
      inputIndex,
      sighashTypes,
    );
    const signature = bscript.signature.encode(keyPair.sign(hash), sighashType);
    this.addPartialSig(inputIndex, { pubkey: keyPair.publicKey, signature });
    return this;
  }
  async _signNonTaprootInputAsync(
    inputIndex,
    keyPair,
    sighashTypes = [transaction_js_1.Transaction.SIGHASH_ALL],
  ) {
    const { hash, sighashType } = this._getHashForInput(
      inputIndex,
      sighashTypes,
    );
    const signature = bscript.signature.encode(
      await keyPair.sign(hash),
      sighashType,
    );
    this.addPartialSig(inputIndex, { pubkey: keyPair.publicKey, signature });
  }
  _signTaprootInput(
    inputIndex,
    keyPair,
    tapLeafHashToSign,
    sighashTypes = [transaction_js_1.Transaction.SIGHASH_DEFAULT],
  ) {
    if (typeof keyPair.signSchnorr !== 'function')
      throw new Error(
        `Need Schnorr Signer to sign taproot input #${inputIndex}`,
      );
    const hashes = this._getTaprootHashes(
      inputIndex,
      keyPair.publicKey,
      tapLeafHashToSign,
      sighashTypes,
    );
    if (!hashes.length)
      throw new Error(
        `Can not sign for input #${inputIndex} with key ${(0, uint8array_tools_1.toHex)(keyPair.publicKey)}`,
      );
    for (const { hash, leafHash } of hashes) {
      this._addTaprootSig(
        inputIndex,
        keyPair.publicKey,
        leafHash,
        (0, bip371_js_1.serializeTaprootSignature)(
          keyPair.signSchnorr(hash),
          this._getSighashType(inputIndex),
        ),
      );
    }
    return this;
  }
  async _signTaprootInputAsync(
    inputIndex,
    keyPair,
    tapLeafHashToSign,
    sighashTypes = [transaction_js_1.Transaction.SIGHASH_DEFAULT],
  ) {
    if (typeof keyPair.signSchnorr !== 'function')
      throw new Error(
        `Need Schnorr Signer to sign taproot input #${inputIndex}`,
      );
    const hashes = this._getTaprootHashes(
      inputIndex,
      keyPair.publicKey,
      tapLeafHashToSign,
      sighashTypes,
    );
    if (!hashes.length)
      throw new Error(
        `Can not sign for input #${inputIndex} with key ${(0, uint8array_tools_1.toHex)(keyPair.publicKey)}`,
      );
    await Promise.all(
      hashes.map(async ({ hash, leafHash }) =>
        this._addTaprootSig(
          inputIndex,
          keyPair.publicKey,
          leafHash,
          (0, bip371_js_1.serializeTaprootSignature)(
            await keyPair.signSchnorr(hash),
            this._getSighashType(inputIndex),
          ),
        ),
      ),
    );
  }
  /** Shared: store a taproot signature as key-sig or script-sig depending on leafHash. */
  _addTaprootSig(inputIndex, pubkey, leafHash, sig) {
    if (leafHash) {
      this.addTapScriptSig(inputIndex, {
        pubkey: (0, bip371_js_1.toXOnly)(pubkey),
        leafHash,
        signature: sig,
      });
    } else {
      this.addTapKeySig(inputIndex, sig);
    }
  }
  // ─── Validation ───────────────────────────────────────────────────────────
  /**
   * Validate signatures for a specific input. Recomputes the sighash from
   * UTXO data. Mirrors Psbt.validateSignaturesOfInput().
   */
  validateSignaturesOfInput(inputIndex, validator, pubkey) {
    return this._isTaprootInput(inputIndex)
      ? this._validateTaprootSignatures(inputIndex, validator, pubkey)
      : this._validateNonTaprootSignatures(inputIndex, validator, pubkey);
  }
  /** Mirrors Psbt.validateSignaturesOfAllInputs(). */
  validateSignaturesOfAllInputs(validator) {
    if (this.inputCount === 0) throw new Error('No inputs to validate');
    return Array.from({ length: this.inputCount }, (_, i) => i).every(i =>
      this.validateSignaturesOfInput(i, validator),
    );
  }
  _validateNonTaprootSignatures(inputIndex, validator, pubkey) {
    const partialSigs = this.getPartialSigs(inputIndex);
    if (!partialSigs.length) throw new Error('No signatures to validate');
    const sigsToCheck = pubkey
      ? partialSigs.filter(
          ps => (0, uint8array_tools_1.compare)(ps.pubkey, pubkey) === 0,
        )
      : partialSigs;
    if (!sigsToCheck.length) throw new Error('No signatures for this pubkey');
    for (const pSig of sigsToCheck) {
      const { signature, hashType } = bscript.signature.decode(pSig.signature);
      const { hash } = this._getHashForInput(inputIndex, [hashType]);
      try {
        if (!validator(pSig.pubkey, hash, signature)) return false;
      } catch {
        return false;
      }
    }
    return true;
  }
  _validateTaprootSignatures(inputIndex, validator, pubkey) {
    const tapKeySig = this.getInput(
      inputIndex,
      fields_1.InputTypes.TAP_KEY_SIG,
    );
    const tapScriptSigs = this.getTapScriptSigs(inputIndex);
    if (!tapKeySig && !tapScriptSigs.length)
      throw new Error('No signatures to validate');
    const xOnlyPubkey = pubkey ? (0, bip371_js_1.toXOnly)(pubkey) : undefined;
    let validated = 0;
    if (tapKeySig) {
      const tapInternalKeyBuf = this.getInput(
        inputIndex,
        fields_1.InputTypes.TAP_INTERNAL_KEY,
      );
      const keyForHashes =
        pubkey ??
        (tapInternalKeyBuf
          ? fields_2.InputField[fields_1.InputTypes.TAP_INTERNAL_KEY].decode(
              tapInternalKeyBuf,
            )
          : tapKeySig.slice(0, 32));
      const keyHash = this._getTaprootHashes(inputIndex, keyForHashes).find(
        h => !h.leafHash,
      );
      if (keyHash) {
        const sig =
          tapKeySig.length === 65 ? tapKeySig.slice(0, 64) : tapKeySig;
        try {
          if (!validator(keyHash.pubkey, keyHash.hash, sig)) return false;
        } catch {
          return false;
        }
        validated++;
      }
    }
    for (const tapScriptSig of tapScriptSigs) {
      if (
        xOnlyPubkey &&
        (0, uint8array_tools_1.compare)(tapScriptSig.pubkey, xOnlyPubkey) !== 0
      )
        continue;
      const hashes = this._getTaprootHashes(
        inputIndex,
        tapScriptSig.pubkey,
        tapScriptSig.leafHash,
      );
      const match = hashes.find(
        h =>
          h.leafHash &&
          (0, uint8array_tools_1.compare)(h.leafHash, tapScriptSig.leafHash) ===
            0,
      );
      if (match) {
        const sig =
          tapScriptSig.signature.length === 65
            ? tapScriptSig.signature.slice(0, 64)
            : tapScriptSig.signature;
        try {
          if (!validator(tapScriptSig.pubkey, match.hash, sig)) return false;
        } catch {
          return false;
        }
        validated++;
      }
    }
    if (validated === 0) throw new Error('No signatures for this pubkey');
    return true;
  }
  /**
   * Verify that NON_WITNESS_UTXO txid matches PREVIOUS_TXID.
   * Only possible inside bitcoinjs-lib where we have Transaction.getHash().
   */
  verifyNonWitnessUtxo(inputIndex) {
    const nonWitnessUtxoBuf = this.getInput(
      inputIndex,
      fields_1.InputTypes.NON_WITNESS_UTXO,
    );
    const previousTxidBuf = this.getInput(
      inputIndex,
      fields_1.InputTypes.PREVIOUS_TXID,
    );
    if (!nonWitnessUtxoBuf || !previousTxidBuf) return false;
    return (
      (0, uint8array_tools_1.compare)(
        transaction_js_1.Transaction.fromBuffer(nonWitnessUtxoBuf).getHash(),
        previousTxidBuf,
      ) === 0
    );
  }
  // ─── Extractor ─────────────────────────────────────────────────────────────
  /**
   * Build a bitcoinjs-lib Transaction from the PSBT maps.
   * Mirrors Psbt.extractTransaction() including the maximumFeeRate guard.
   */
  toTransaction(disableFeeCheck = false) {
    const tx = new transaction_js_1.Transaction();
    const versionBuf = this.getGlobal(fields_1.GlobalTypes.TX_VERSION);
    tx.version = versionBuf
      ? fields_2.GlobalField[fields_1.GlobalTypes.TX_VERSION].decode(versionBuf)
      : 2;
    tx.locktime = this.computeLockTime();
    for (let i = 0; i < this.inputCount; i++) {
      const hashBuf = this.getInput(i, fields_1.InputTypes.PREVIOUS_TXID);
      const indexBuf = this.getInput(i, fields_1.InputTypes.OUTPUT_INDEX);
      if (!hashBuf || !indexBuf)
        throw new Error(`Input ${i}: missing PREVIOUS_TXID or OUTPUT_INDEX`);
      const seqBuf = this.getInput(i, fields_1.InputTypes.SEQUENCE);
      const finalScriptSig = this.getInput(
        i,
        fields_1.InputTypes.FINAL_SCRIPTSIG,
      );
      const finalScriptWitness = this.getInput(
        i,
        fields_1.InputTypes.FINAL_SCRIPTWITNESS,
      );
      if (!finalScriptSig && !finalScriptWitness)
        throw new Error(
          `Input ${i} is not finalized. Call finalizeInput() first.`,
        );
      tx.addInput(
        fields_2.InputField[fields_1.InputTypes.PREVIOUS_TXID].decode(hashBuf),
        fields_2.InputField[fields_1.InputTypes.OUTPUT_INDEX].decode(indexBuf),
        seqBuf
          ? fields_2.InputField[fields_1.InputTypes.SEQUENCE].decode(seqBuf)
          : 0xffffffff,
        finalScriptSig,
      );
      if (finalScriptWitness)
        tx.setWitness(
          i,
          (0, utils_1.deserializeWitnessStack)(finalScriptWitness),
        );
    }
    for (let i = 0; i < this.outputCount; i++) {
      const scriptBuf = this.getOutput(i, fields_1.OutputTypes.SCRIPT);
      const amountBuf = this.getOutput(i, fields_1.OutputTypes.AMOUNT);
      if (!scriptBuf || !amountBuf)
        throw new Error(`Output ${i}: missing SCRIPT or AMOUNT`);
      tx.addOutput(
        fields_2.OutputField[fields_1.OutputTypes.SCRIPT].decode(scriptBuf),
        fields_2.OutputField[fields_1.OutputTypes.AMOUNT].decode(amountBuf),
      );
    }
    if (!disableFeeCheck) {
      const inputTotal = this.getTotalInputValue();
      if (inputTotal > 0n) {
        const feeRate =
          Number(inputTotal - this.getTotalOutputValue()) / tx.virtualSize();
        if (feeRate >= this.maximumFeeRate)
          throw new Error(
            `Warning: fee rate ${feeRate} sat/vB exceeds maximumFeeRate ${this.maximumFeeRate}. ` +
              `Use setMaximumFeeRate() to raise your threshold, or pass true to toTransaction().`,
          );
      }
    }
    return tx;
  }
  /**
   * Get the sighash for a non-taproot input (legacy, P2WPKH, P2WSH).
   * Sign externally, inject with addPartialSig(), then serialize with toHex().
   *
   * @example
   * const { hash, sighashType } = psbt.getInputHashForSig(0);
   * psbt.addPartialSig(0, { pubkey, signature: bscript.signature.encode(signer.sign(hash), sighashType) });
   * const signedHex = psbt.toHex();
   */
  getInputHashForSig(
    inputIndex,
    sighashTypes = [transaction_js_1.Transaction.SIGHASH_ALL],
  ) {
    return this._getHashForInput(inputIndex, sighashTypes);
  }
  /**
   * Get the sighash(es) for a taproot input (key-path or script-path).
   * Sign externally, inject with addTapKeySig()/addTapScriptSig(), then serialize with toHex().
   *
   * @example
   * const [{ hash }] = psbt.getTaprootHashesForSig(0, pubkey);
   * psbt.addTapKeySig(0, serializeTaprootSignature(signer.signSchnorr(hash)));
   * const signedHex = psbt.toHex();
   */
  getTaprootHashesForSig(
    inputIndex,
    pubkey,
    tapLeafHashToSign,
    sighashTypes = [transaction_js_1.Transaction.SIGHASH_DEFAULT],
  ) {
    return this._getTaprootHashes(
      inputIndex,
      pubkey,
      tapLeafHashToSign,
      sighashTypes,
    );
  }
  // ─── Private helpers ───────────────────────────────────────────────────────
  /**
   * Check if an input is taproot by inspecting its input map fields.
   * Uses field presence rather than UTXO script type — more reliable and
   * avoids WITNESS_UTXO decode issues with untweaked keys in tests.
   * TAP_LEAF_SCRIPT and TAP_SCRIPT_SIG use key data so need a prefix scan.
   */
  _isTaprootInput(inputIndex) {
    if (
      this.getInput(inputIndex, fields_1.InputTypes.TAP_INTERNAL_KEY) !=
      undefined
    )
      return true;
    if (this.getInput(inputIndex, fields_1.InputTypes.TAP_KEY_SIG) != undefined)
      return true;
    const map = this._inputMaps[inputIndex];
    if (!map) return false;
    const tapLeafPrefix = (0, utils_1.keyFromType)(
      fields_1.InputTypes.TAP_LEAF_SCRIPT,
    );
    const tapScriptPrefix = (0, utils_1.keyFromType)(
      fields_1.InputTypes.TAP_SCRIPT_SIG,
    );
    for (const key of map.keys()) {
      if (key.startsWith(tapLeafPrefix) || key.startsWith(tapScriptPrefix))
        return true;
    }
    return false;
  }
  _buildUnsignedTx() {
    const tx = new transaction_js_1.Transaction();
    const versionBuf = this.getGlobal(fields_1.GlobalTypes.TX_VERSION);
    tx.version = versionBuf
      ? fields_2.GlobalField[fields_1.GlobalTypes.TX_VERSION].decode(versionBuf)
      : 2;
    tx.locktime = this.computeLockTime();
    for (let i = 0; i < this.inputCount; i++) {
      const hashBuf = this.getInput(i, fields_1.InputTypes.PREVIOUS_TXID);
      const indexBuf = this.getInput(i, fields_1.InputTypes.OUTPUT_INDEX);
      const seqBuf = this.getInput(i, fields_1.InputTypes.SEQUENCE);
      tx.addInput(
        fields_2.InputField[fields_1.InputTypes.PREVIOUS_TXID].decode(hashBuf),
        fields_2.InputField[fields_1.InputTypes.OUTPUT_INDEX].decode(indexBuf),
        seqBuf
          ? fields_2.InputField[fields_1.InputTypes.SEQUENCE].decode(seqBuf)
          : 0xffffffff,
      );
    }
    for (let i = 0; i < this.outputCount; i++) {
      const scriptBuf = this.getOutput(i, fields_1.OutputTypes.SCRIPT);
      const amountBuf = this.getOutput(i, fields_1.OutputTypes.AMOUNT);
      tx.addOutput(
        fields_2.OutputField[fields_1.OutputTypes.SCRIPT].decode(scriptBuf),
        fields_2.OutputField[fields_1.OutputTypes.AMOUNT].decode(amountBuf),
      );
    }
    return tx;
  }
  _getUtxoForInput(inputIndex) {
    const witnessUtxoBuf = this.getInput(
      inputIndex,
      fields_1.InputTypes.WITNESS_UTXO,
    );
    if (witnessUtxoBuf)
      return fields_2.InputField[fields_1.InputTypes.WITNESS_UTXO].decode(
        witnessUtxoBuf,
      );
    const nonWitnessUtxoBuf = this.getInput(
      inputIndex,
      fields_1.InputTypes.NON_WITNESS_UTXO,
    );
    const indexBuf = this.getInput(
      inputIndex,
      fields_1.InputTypes.OUTPUT_INDEX,
    );
    if (nonWitnessUtxoBuf && indexBuf) {
      const prevTx = transaction_js_1.Transaction.fromBuffer(nonWitnessUtxoBuf);
      const out =
        prevTx.outs[
          fields_2.InputField[fields_1.InputTypes.OUTPUT_INDEX].decode(indexBuf)
        ];
      return { script: out.script, value: out.value };
    }
    throw new Error(
      `Input ${inputIndex}: missing WITNESS_UTXO or NON_WITNESS_UTXO`,
    );
  }
  _getSighashType(inputIndex) {
    const buf = this.getInput(inputIndex, fields_1.InputTypes.SIGHASH_TYPE);
    return buf
      ? fields_2.InputField[fields_1.InputTypes.SIGHASH_TYPE].decode(buf)
      : undefined;
  }
  _getHashForInput(
    inputIndex,
    sighashTypes = [transaction_js_1.Transaction.SIGHASH_ALL],
  ) {
    const sighashType =
      this._getSighashType(inputIndex) ??
      transaction_js_1.Transaction.SIGHASH_ALL;
    if (!sighashTypes.includes(sighashType))
      throw new Error(
        `Sighash type ${sighashType} not in allowed list: ${sighashTypes}`,
      );
    const tx = this._buildUnsignedTx();
    const utxo = this._getUtxoForInput(inputIndex);
    const redeemScriptBuf = this.getInput(
      inputIndex,
      fields_1.InputTypes.REDEEM_SCRIPT,
    );
    const witnessScriptBuf = this.getInput(
      inputIndex,
      fields_1.InputTypes.WITNESS_SCRIPT,
    );
    const redeemScript = redeemScriptBuf
      ? fields_2.InputField[fields_1.InputTypes.REDEEM_SCRIPT].decode(
          redeemScriptBuf,
        )
      : undefined;
    const witnessScript = witnessScriptBuf
      ? fields_2.InputField[fields_1.InputTypes.WITNESS_SCRIPT].decode(
          witnessScriptBuf,
        )
      : undefined;
    // Determine meaningful script (mirrors getMeaningfulScript in psbt.ts)
    const meaningfulScript = witnessScript ?? redeemScript ?? utxo.script;
    let hash;
    if (witnessScript || (0, psbtutils_js_1.isP2WPKH)(meaningfulScript)) {
      const signingScript = (0, psbtutils_js_1.isP2WPKH)(meaningfulScript)
        ? payments.p2pkh({ hash: meaningfulScript.slice(2) }).output
        : meaningfulScript;
      hash = tx.hashForWitnessV0(
        inputIndex,
        signingScript,
        utxo.value,
        sighashType,
      );
    } else {
      hash = tx.hashForSignature(inputIndex, meaningfulScript, sighashType);
    }
    return { hash, sighashType };
  }
  _getTaprootHashes(
    inputIndex,
    pubkey,
    tapLeafHashToSign,
    sighashTypes = [transaction_js_1.Transaction.SIGHASH_DEFAULT],
  ) {
    const sighashType =
      this._getSighashType(inputIndex) ??
      transaction_js_1.Transaction.SIGHASH_DEFAULT;
    if (!sighashTypes.includes(sighashType))
      throw new Error(`Sighash type ${sighashType} not in allowed list`);
    const tx = this._buildUnsignedTx();
    const witnessUtxos = Array.from({ length: this.inputCount }, (_, i) => {
      const buf = this.getInput(i, fields_1.InputTypes.WITNESS_UTXO);
      if (!buf)
        throw new Error(
          `Input ${i}: missing WITNESS_UTXO (required for taproot)`,
        );
      return fields_2.InputField[fields_1.InputTypes.WITNESS_UTXO].decode(buf);
    });
    const scripts = witnessUtxos.map(u => u.script);
    const values = witnessUtxos.map(u => u.value);
    const xOnly =
      pubkey.length === 32 ? pubkey : (0, bip371_js_1.toXOnly)(pubkey);
    const hashes = [];
    // Key-path spend
    // Key-path spend (synthetic/internal-key match only; does not derive tweaked output key)
    if (
      !tapLeafHashToSign &&
      this.getInput(inputIndex, fields_1.InputTypes.TAP_INTERNAL_KEY)
    ) {
      const outputKey = witnessUtxos[inputIndex].script.slice(2, 34);
      if ((0, uint8array_tools_1.compare)(xOnly, outputKey) === 0) {
        hashes.push({
          pubkey: xOnly,
          hash: tx.hashForWitnessV1(inputIndex, scripts, values, sighashType),
        });
      }
    }
    // Script-path spend
    for (const leaf of this.getTapLeafScripts(inputIndex)) {
      const leafHash = (0, bip341_js_1.tapleafHash)({
        output: leaf.script,
        version: leaf.leafVersion,
      });
      if (
        tapLeafHashToSign &&
        (0, uint8array_tools_1.compare)(leafHash, tapLeafHashToSign) !== 0
      )
        continue;
      if (!(0, psbtutils_js_1.pubkeyInScript)(pubkey, leaf.script)) continue;
      hashes.push({
        pubkey: xOnly,
        hash: tx.hashForWitnessV1(
          inputIndex,
          scripts,
          values,
          sighashType,
          leafHash,
        ),
        leafHash,
      });
    }
    return hashes;
  }
}
exports.PsbtV2 = PsbtV2;
