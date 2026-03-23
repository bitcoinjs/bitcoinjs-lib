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

import { PSBTv2Builder } from 'bip370';
import { ValidationErrorContainer } from 'bip370/errors';
export { ValidationErrorContainer };
import type { InputUpdateData, OutputUpdateData } from 'bip370/roles';
import { InputTypes, OutputTypes, GlobalTypes } from 'bip370/fields';
import { GlobalField, InputField, OutputField } from 'bip370/fields';
import { deserializeWitnessStack, keyFromType } from 'bip370/utils';

import { toOutputScript } from './address.js';
import type { Signer, SignerAsync } from './psbt.js';
import type { PsbtInput, PsbtOutput } from 'bip174';
import type { TransactionInput } from './psbt.js';
import { bitcoin as btcNetwork, Network } from './networks.js';
import * as payments from './payments/index.js';
import * as bscript from './script.js';
import { Output, Transaction } from './transaction.js';
import { toXOnly, serializeTaprootSignature } from './psbt/bip371.js';
import { tapleafHash } from './payments/bip341.js';
import { isP2WPKH, pubkeyInScript } from './psbt/psbtutils.js';
import { compare, toHex } from 'uint8array-tools';

export { toXOnly };

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PsbtV2Opts {
  network?: Network;
  /** Maximum fee rate in sat/vB checked on toTransaction(). Matches Psbt's default. */
  maximumFeeRate?: number;
}

/**
 * PSBTv2 input — mirrors psbt.ts's internal PsbtInputExtended plus
 * PSBTv2-only fields (requiredTimeLockTime, requiredHeightLockTime).
 */
export interface PsbtV2InputExtended extends PsbtInput, TransactionInput {
  requiredTimeLockTime?: number;
  requiredHeightLockTime?: number;
}

/**
 * PSBTv2 output — mirrors psbt.ts's internal PsbtOutputExtended plus
 * bip370's tapTree as Uint8Array (bip174 uses a TapTree object).
 */
export type PsbtV2OutputExtended =
  | (PsbtOutput & { address: string; value: bigint; tapTree?: Uint8Array })
  | (PsbtOutput & { script: Uint8Array; value: bigint; tapTree?: Uint8Array });

/** (pubkey, msghash, signature) → boolean — same as Psbt's ValidateSigFunction */
export type ValidateSigFunction = (
  pubkey: Uint8Array,
  msghash: Uint8Array,
  signature: Uint8Array,
) => boolean;

// ─── Adapter ─────────────────────────────────────────────────────────────────

export class PsbtV2 extends PSBTv2Builder {
  readonly network: Network;
  private maximumFeeRate: number;

  constructor(opts: PsbtV2Opts = {}) {
    super();
    this.network = opts.network ?? btcNetwork;
    this.maximumFeeRate = opts.maximumFeeRate ?? 5000;
    // BIP-370 requires these four globals to be present from construction
    this.setGlobal(
      GlobalTypes.PSBT_VERSION,
      GlobalField[GlobalTypes.PSBT_VERSION].encode(2).value,
    );
    this.setGlobal(
      GlobalTypes.TX_VERSION,
      GlobalField[GlobalTypes.TX_VERSION].encode(2).value,
    );
    this.setGlobal(
      GlobalTypes.INPUT_COUNT,
      GlobalField[GlobalTypes.INPUT_COUNT].encode(0).value,
    );
    this.setGlobal(
      GlobalTypes.OUTPUT_COUNT,
      GlobalField[GlobalTypes.OUTPUT_COUNT].encode(0).value,
    );
  }

  setMaximumFeeRate(satoshiPerByte: number): void {
    this.maximumFeeRate = satoshiPerByte;
  }

  // ─── Creator ───────────────────────────────────────────────────────────────

  /**
   * Mirrors Psbt.addInput() — hash + index plus any input update fields
   * in a single object. Splits into addInput() + updateInput() internally.
   */
  addInputExtended(data: PsbtV2InputExtended): this {
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

    const inputUpdate: InputUpdateData = {
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
      bip32Derivation: bip32Derivation as InputUpdateData['bip32Derivation'],
      tapBip32Derivation:
        tapBip32Derivation as InputUpdateData['tapBip32Derivation'],
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
  addOutput(data: PsbtV2OutputExtended): number {
    const script =
      'address' in data
        ? toOutputScript(data.address, this.network)
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
    const outputUpdate: OutputUpdateData = {
      redeemScript,
      witnessScript,
      tapInternalKey,
      tapTree,
      // bip174 path is string, bip370 expects number[] — compatible at runtime
      bip32Derivation: bip32Derivation as OutputUpdateData['bip32Derivation'],
      tapBip32Derivation:
        tapBip32Derivation as OutputUpdateData['tapBip32Derivation'],
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
  signInput(
    inputIndex: number,
    keyPair: Signer,
    tapLeafHashToSign?: Uint8Array,
    sighashTypes?: number[],
  ): this {
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

  signInputAsync(
    inputIndex: number,
    keyPair: SignerAsync,
    tapLeafHashToSign?: Uint8Array,
    sighashTypes?: number[],
  ): Promise<void> {
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

  private _signNonTaprootInput(
    inputIndex: number,
    keyPair: Signer,
    sighashTypes: number[] = [Transaction.SIGHASH_ALL],
  ): this {
    const { hash, sighashType } = this._getHashForInput(
      inputIndex,
      sighashTypes,
    );
    const signature = bscript.signature.encode(keyPair.sign(hash), sighashType);
    this.addPartialSig(inputIndex, { pubkey: keyPair.publicKey, signature });
    return this;
  }

  private async _signNonTaprootInputAsync(
    inputIndex: number,
    keyPair: SignerAsync,
    sighashTypes: number[] = [Transaction.SIGHASH_ALL],
  ): Promise<void> {
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

  private _signTaprootInput(
    inputIndex: number,
    keyPair: Signer,
    tapLeafHashToSign?: Uint8Array,
    sighashTypes: number[] = [Transaction.SIGHASH_DEFAULT],
  ): this {
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
        `Can not sign for input #${inputIndex} with key ${toHex(keyPair.publicKey)}`,
      );

    for (const { hash, leafHash } of hashes) {
      this._addTaprootSig(
        inputIndex,
        keyPair.publicKey,
        leafHash,
        serializeTaprootSignature(
          keyPair.signSchnorr!(hash),
          this._getSighashType(inputIndex),
        ),
      );
    }
    return this;
  }

  private async _signTaprootInputAsync(
    inputIndex: number,
    keyPair: SignerAsync,
    tapLeafHashToSign?: Uint8Array,
    sighashTypes: number[] = [Transaction.SIGHASH_DEFAULT],
  ): Promise<void> {
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
        `Can not sign for input #${inputIndex} with key ${toHex(keyPair.publicKey)}`,
      );

    await Promise.all(
      hashes.map(async ({ hash, leafHash }) =>
        this._addTaprootSig(
          inputIndex,
          keyPair.publicKey,
          leafHash,
          serializeTaprootSignature(
            await keyPair.signSchnorr!(hash),
            this._getSighashType(inputIndex),
          ),
        ),
      ),
    );
  }

  /** Shared: store a taproot signature as key-sig or script-sig depending on leafHash. */
  private _addTaprootSig(
    inputIndex: number,
    pubkey: Uint8Array,
    leafHash: Uint8Array | undefined,
    sig: Uint8Array,
  ): void {
    if (leafHash) {
      this.addTapScriptSig(inputIndex, {
        pubkey: toXOnly(pubkey),
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
  validateSignaturesOfInput(
    inputIndex: number,
    validator: ValidateSigFunction,
    pubkey?: Uint8Array,
  ): boolean {
    return this._isTaprootInput(inputIndex)
      ? this._validateTaprootSignatures(inputIndex, validator, pubkey)
      : this._validateNonTaprootSignatures(inputIndex, validator, pubkey);
  }

  /** Mirrors Psbt.validateSignaturesOfAllInputs(). */
  validateSignaturesOfAllInputs(validator: ValidateSigFunction): boolean {
    if (this.inputCount === 0) throw new Error('No inputs to validate');
    return Array.from({ length: this.inputCount }, (_, i) => i).every(i =>
      this.validateSignaturesOfInput(i, validator),
    );
  }

  private _validateNonTaprootSignatures(
    inputIndex: number,
    validator: ValidateSigFunction,
    pubkey?: Uint8Array,
  ): boolean {
    const partialSigs = this.getPartialSigs(inputIndex);
    if (!partialSigs.length) throw new Error('No signatures to validate');

    const sigsToCheck = pubkey
      ? partialSigs.filter(ps => compare(ps.pubkey, pubkey) === 0)
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

  private _validateTaprootSignatures(
    inputIndex: number,
    validator: ValidateSigFunction,
    pubkey?: Uint8Array,
  ): boolean {
    const tapKeySig = this.getInput(inputIndex, InputTypes.TAP_KEY_SIG);
    const tapScriptSigs = this.getTapScriptSigs(inputIndex);

    if (!tapKeySig && !tapScriptSigs.length)
      throw new Error('No signatures to validate');

    const xOnlyPubkey = pubkey ? toXOnly(pubkey) : undefined;
    let validated = 0;

    if (tapKeySig) {
      const tapInternalKeyBuf = this.getInput(
        inputIndex,
        InputTypes.TAP_INTERNAL_KEY,
      );
      const keyForHashes =
        pubkey ??
        (tapInternalKeyBuf
          ? InputField[InputTypes.TAP_INTERNAL_KEY].decode(tapInternalKeyBuf)
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
      if (xOnlyPubkey && compare(tapScriptSig.pubkey, xOnlyPubkey) !== 0)
        continue;

      const hashes = this._getTaprootHashes(
        inputIndex,
        tapScriptSig.pubkey,
        tapScriptSig.leafHash,
      );
      const match = hashes.find(
        h => h.leafHash && compare(h.leafHash, tapScriptSig.leafHash) === 0,
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
  verifyNonWitnessUtxo(inputIndex: number): boolean {
    const nonWitnessUtxoBuf = this.getInput(
      inputIndex,
      InputTypes.NON_WITNESS_UTXO,
    );
    const previousTxidBuf = this.getInput(inputIndex, InputTypes.PREVIOUS_TXID);
    if (!nonWitnessUtxoBuf || !previousTxidBuf) return false;
    return (
      compare(
        Transaction.fromBuffer(nonWitnessUtxoBuf).getHash(),
        previousTxidBuf,
      ) === 0
    );
  }

  // ─── Extractor ─────────────────────────────────────────────────────────────

  /**
   * Build a bitcoinjs-lib Transaction from the PSBT maps.
   * Mirrors Psbt.extractTransaction() including the maximumFeeRate guard.
   */
  toTransaction(disableFeeCheck = false): Transaction {
    const tx = new Transaction();

    const versionBuf = this.getGlobal(GlobalTypes.TX_VERSION);
    tx.version = versionBuf
      ? GlobalField[GlobalTypes.TX_VERSION].decode(versionBuf)
      : 2;
    tx.locktime = this.computeLockTime();

    for (let i = 0; i < this.inputCount; i++) {
      const hashBuf = this.getInput(i, InputTypes.PREVIOUS_TXID);
      const indexBuf = this.getInput(i, InputTypes.OUTPUT_INDEX);
      if (!hashBuf || !indexBuf)
        throw new Error(`Input ${i}: missing PREVIOUS_TXID or OUTPUT_INDEX`);

      const seqBuf = this.getInput(i, InputTypes.SEQUENCE);
      const finalScriptSig = this.getInput(i, InputTypes.FINAL_SCRIPTSIG);
      const finalScriptWitness = this.getInput(
        i,
        InputTypes.FINAL_SCRIPTWITNESS,
      );

      if (!finalScriptSig && !finalScriptWitness)
        throw new Error(
          `Input ${i} is not finalized. Call finalizeInput() first.`,
        );

      tx.addInput(
        InputField[InputTypes.PREVIOUS_TXID].decode(hashBuf),
        InputField[InputTypes.OUTPUT_INDEX].decode(indexBuf),
        seqBuf ? InputField[InputTypes.SEQUENCE].decode(seqBuf) : 0xffffffff,
        finalScriptSig,
      );
      if (finalScriptWitness)
        tx.setWitness(i, deserializeWitnessStack(finalScriptWitness));
    }

    for (let i = 0; i < this.outputCount; i++) {
      const scriptBuf = this.getOutput(i, OutputTypes.SCRIPT);
      const amountBuf = this.getOutput(i, OutputTypes.AMOUNT);
      if (!scriptBuf || !amountBuf)
        throw new Error(`Output ${i}: missing SCRIPT or AMOUNT`);
      tx.addOutput(
        OutputField[OutputTypes.SCRIPT].decode(scriptBuf),
        OutputField[OutputTypes.AMOUNT].decode(amountBuf),
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
    inputIndex: number,
    sighashTypes: number[] = [Transaction.SIGHASH_ALL],
  ): { hash: Uint8Array; sighashType: number } {
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
    inputIndex: number,
    pubkey: Uint8Array,
    tapLeafHashToSign?: Uint8Array,
    sighashTypes: number[] = [Transaction.SIGHASH_DEFAULT],
  ): { pubkey: Uint8Array; hash: Uint8Array; leafHash?: Uint8Array }[] {
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
  private _isTaprootInput(inputIndex: number): boolean {
    if (this.getInput(inputIndex, InputTypes.TAP_INTERNAL_KEY) != undefined)
      return true;
    if (this.getInput(inputIndex, InputTypes.TAP_KEY_SIG) != undefined)
      return true;

    const map = this._inputMaps[inputIndex];
    if (!map) return false;
    const tapLeafPrefix = keyFromType(InputTypes.TAP_LEAF_SCRIPT);
    const tapScriptPrefix = keyFromType(InputTypes.TAP_SCRIPT_SIG);
    for (const key of map.keys()) {
      if (key.startsWith(tapLeafPrefix) || key.startsWith(tapScriptPrefix))
        return true;
    }
    return false;
  }

  private _buildUnsignedTx(): Transaction {
    const tx = new Transaction();
    const versionBuf = this.getGlobal(GlobalTypes.TX_VERSION);
    tx.version = versionBuf
      ? GlobalField[GlobalTypes.TX_VERSION].decode(versionBuf)
      : 2;
    tx.locktime = this.computeLockTime();

    for (let i = 0; i < this.inputCount; i++) {
      const hashBuf = this.getInput(i, InputTypes.PREVIOUS_TXID);
      const indexBuf = this.getInput(i, InputTypes.OUTPUT_INDEX);
      const seqBuf = this.getInput(i, InputTypes.SEQUENCE);
      tx.addInput(
        InputField[InputTypes.PREVIOUS_TXID].decode(hashBuf!),
        InputField[InputTypes.OUTPUT_INDEX].decode(indexBuf!),
        seqBuf ? InputField[InputTypes.SEQUENCE].decode(seqBuf) : 0xffffffff,
      );
    }
    for (let i = 0; i < this.outputCount; i++) {
      const scriptBuf = this.getOutput(i, OutputTypes.SCRIPT);
      const amountBuf = this.getOutput(i, OutputTypes.AMOUNT);
      tx.addOutput(
        OutputField[OutputTypes.SCRIPT].decode(scriptBuf!),
        OutputField[OutputTypes.AMOUNT].decode(amountBuf!),
      );
    }
    return tx;
  }

  private _getUtxoForInput(inputIndex: number): {
    script: Uint8Array;
    value: bigint;
  } {
    const witnessUtxoBuf = this.getInput(inputIndex, InputTypes.WITNESS_UTXO);
    if (witnessUtxoBuf)
      return InputField[InputTypes.WITNESS_UTXO].decode(witnessUtxoBuf);

    const nonWitnessUtxoBuf = this.getInput(
      inputIndex,
      InputTypes.NON_WITNESS_UTXO,
    );
    const indexBuf = this.getInput(inputIndex, InputTypes.OUTPUT_INDEX);
    if (nonWitnessUtxoBuf && indexBuf) {
      const prevTx = Transaction.fromBuffer(nonWitnessUtxoBuf);
      const out = prevTx.outs[
        InputField[InputTypes.OUTPUT_INDEX].decode(indexBuf)
      ] as Output;
      return { script: out.script, value: out.value };
    }
    throw new Error(
      `Input ${inputIndex}: missing WITNESS_UTXO or NON_WITNESS_UTXO`,
    );
  }

  private _getSighashType(inputIndex: number): number | undefined {
    const buf = this.getInput(inputIndex, InputTypes.SIGHASH_TYPE);
    return buf ? InputField[InputTypes.SIGHASH_TYPE].decode(buf) : undefined;
  }

  private _getHashForInput(
    inputIndex: number,
    sighashTypes: number[] = [Transaction.SIGHASH_ALL],
  ): { hash: Uint8Array; sighashType: number } {
    const sighashType =
      this._getSighashType(inputIndex) ?? Transaction.SIGHASH_ALL;
    if (!sighashTypes.includes(sighashType))
      throw new Error(
        `Sighash type ${sighashType} not in allowed list: ${sighashTypes}`,
      );

    const tx = this._buildUnsignedTx();
    const utxo = this._getUtxoForInput(inputIndex);

    const redeemScriptBuf = this.getInput(inputIndex, InputTypes.REDEEM_SCRIPT);
    const witnessScriptBuf = this.getInput(
      inputIndex,
      InputTypes.WITNESS_SCRIPT,
    );
    const redeemScript = redeemScriptBuf
      ? InputField[InputTypes.REDEEM_SCRIPT].decode(redeemScriptBuf)
      : undefined;
    const witnessScript = witnessScriptBuf
      ? InputField[InputTypes.WITNESS_SCRIPT].decode(witnessScriptBuf)
      : undefined;

    // Determine meaningful script (mirrors getMeaningfulScript in psbt.ts)
    const meaningfulScript = witnessScript ?? redeemScript ?? utxo.script;

    let hash: Uint8Array;
    if (witnessScript || isP2WPKH(meaningfulScript)) {
      const signingScript = isP2WPKH(meaningfulScript)
        ? payments.p2pkh({ hash: meaningfulScript.slice(2) }).output!
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

  private _getTaprootHashes(
    inputIndex: number,
    pubkey: Uint8Array,
    tapLeafHashToSign?: Uint8Array,
    sighashTypes: number[] = [Transaction.SIGHASH_DEFAULT],
  ): { pubkey: Uint8Array; hash: Uint8Array; leafHash?: Uint8Array }[] {
    const sighashType =
      this._getSighashType(inputIndex) ?? Transaction.SIGHASH_DEFAULT;
    if (!sighashTypes.includes(sighashType))
      throw new Error(`Sighash type ${sighashType} not in allowed list`);

    const tx = this._buildUnsignedTx();

    const witnessUtxos = Array.from({ length: this.inputCount }, (_, i) => {
      const buf = this.getInput(i, InputTypes.WITNESS_UTXO);
      if (!buf)
        throw new Error(
          `Input ${i}: missing WITNESS_UTXO (required for taproot)`,
        );
      return InputField[InputTypes.WITNESS_UTXO].decode(buf);
    });
    const scripts = witnessUtxos.map(u => u.script);
    const values = witnessUtxos.map(u => u.value);

    const xOnly = pubkey.length === 32 ? pubkey : toXOnly(pubkey);
    const hashes: {
      pubkey: Uint8Array;
      hash: Uint8Array;
      leafHash?: Uint8Array;
    }[] = [];

    // Key-path spend
    // Key-path spend (synthetic/internal-key match only; does not derive tweaked output key)
    if (
      !tapLeafHashToSign &&
      this.getInput(inputIndex, InputTypes.TAP_INTERNAL_KEY)
    ) {
      const outputKey = witnessUtxos[inputIndex].script.slice(2, 34);
      if (compare(xOnly, outputKey) === 0) {
        hashes.push({
          pubkey: xOnly,
          hash: tx.hashForWitnessV1(inputIndex, scripts, values, sighashType),
        });
      }
    }

    // Script-path spend
    for (const leaf of this.getTapLeafScripts(inputIndex)) {
      const leafHash = tapleafHash({
        output: leaf.script,
        version: leaf.leafVersion,
      });
      if (tapLeafHashToSign && compare(leafHash, tapLeafHashToSign) !== 0)
        continue;

      if (!pubkeyInScript(pubkey, leaf.script)) continue;

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
