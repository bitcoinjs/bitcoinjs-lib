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
import type { Signer, SignerAsync } from './psbt.js';
import type { PsbtInput, PsbtOutput } from 'bip174';
import type { TransactionInput } from './psbt.js';
import { Network } from './networks.js';
import { Transaction } from './transaction.js';
import { toXOnly } from './psbt/bip371.js';
export { toXOnly };
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
export type PsbtV2OutputExtended = (PsbtOutput & {
    address: string;
    value: bigint;
    tapTree?: Uint8Array;
}) | (PsbtOutput & {
    script: Uint8Array;
    value: bigint;
    tapTree?: Uint8Array;
});
/** (pubkey, msghash, signature) → boolean — same as Psbt's ValidateSigFunction */
export type ValidateSigFunction = (pubkey: Uint8Array, msghash: Uint8Array, signature: Uint8Array) => boolean;
export declare class PsbtV2 extends PSBTv2Builder {
    readonly network: Network;
    private maximumFeeRate;
    constructor(opts?: PsbtV2Opts);
    setMaximumFeeRate(satoshiPerByte: number): void;
    /**
     * Mirrors Psbt.addInput() — hash + index plus any input update fields
     * in a single object. Splits into addInput() + updateInput() internally.
     */
    addInputExtended(data: PsbtV2InputExtended): this;
    /**
     * Mirrors Psbt.addOutput() — accepts address or script plus value and any
     * output update fields. Address-to-script conversion is network-aware.
     */
    addOutput(data: PsbtV2OutputExtended): number;
    /**
     * Sign an input. Computes the sighash internally from UTXO data,
     * mirroring Psbt.signInput(). Handles legacy, segwit, and Taproot inputs.
     * For Taproot, pass tapLeafHashToSign for script-path, omit for key-path.
     */
    signInput(inputIndex: number, keyPair: Signer, tapLeafHashToSign?: Uint8Array, sighashTypes?: number[]): this;
    signInputAsync(inputIndex: number, keyPair: SignerAsync, tapLeafHashToSign?: Uint8Array, sighashTypes?: number[]): Promise<void>;
    private _signNonTaprootInput;
    private _signNonTaprootInputAsync;
    private _signTaprootInput;
    private _signTaprootInputAsync;
    /** Shared: store a taproot signature as key-sig or script-sig depending on leafHash. */
    private _addTaprootSig;
    /**
     * Validate signatures for a specific input. Recomputes the sighash from
     * UTXO data. Mirrors Psbt.validateSignaturesOfInput().
     */
    validateSignaturesOfInput(inputIndex: number, validator: ValidateSigFunction, pubkey?: Uint8Array): boolean;
    /** Mirrors Psbt.validateSignaturesOfAllInputs(). */
    validateSignaturesOfAllInputs(validator: ValidateSigFunction): boolean;
    private _validateNonTaprootSignatures;
    private _validateTaprootSignatures;
    /**
     * Verify that NON_WITNESS_UTXO txid matches PREVIOUS_TXID.
     * Only possible inside bitcoinjs-lib where we have Transaction.getHash().
     */
    verifyNonWitnessUtxo(inputIndex: number): boolean;
    /**
     * Build a bitcoinjs-lib Transaction from the PSBT maps.
     * Mirrors Psbt.extractTransaction() including the maximumFeeRate guard.
     */
    toTransaction(disableFeeCheck?: boolean): Transaction;
    /**
     * Get the sighash for a non-taproot input (legacy, P2WPKH, P2WSH).
     * Sign externally, inject with addPartialSig(), then serialize with toHex().
     *
     * @example
     * const { hash, sighashType } = psbt.getInputHashForSig(0);
     * psbt.addPartialSig(0, { pubkey, signature: bscript.signature.encode(signer.sign(hash), sighashType) });
     * const signedHex = psbt.toHex();
     */
    getInputHashForSig(inputIndex: number, sighashTypes?: number[]): {
        hash: Uint8Array;
        sighashType: number;
    };
    /**
     * Get the sighash(es) for a taproot input (key-path or script-path).
     * Sign externally, inject with addTapKeySig()/addTapScriptSig(), then serialize with toHex().
     *
     * @example
     * const [{ hash }] = psbt.getTaprootHashesForSig(0, pubkey);
     * psbt.addTapKeySig(0, serializeTaprootSignature(signer.signSchnorr(hash)));
     * const signedHex = psbt.toHex();
     */
    getTaprootHashesForSig(inputIndex: number, pubkey: Uint8Array, tapLeafHashToSign?: Uint8Array, sighashTypes?: number[]): {
        pubkey: Uint8Array;
        hash: Uint8Array;
        leafHash?: Uint8Array;
    }[];
    /**
     * Check if an input is taproot by inspecting its input map fields.
     * Uses field presence rather than UTXO script type — more reliable and
     * avoids WITNESS_UTXO decode issues with untweaked keys in tests.
     * TAP_LEAF_SCRIPT and TAP_SCRIPT_SIG use key data so need a prefix scan.
     */
    private _isTaprootInput;
    private _buildUnsignedTx;
    private _getUtxoForInput;
    private _getSighashType;
    private _getHashForInput;
    private _getTaprootHashes;
}
