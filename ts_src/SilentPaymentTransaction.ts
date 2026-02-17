import { Input, Transaction } from './transaction';
import { fromHex, toHex, writeUInt32 } from 'uint8array-tools';
import * as ecc from 'tiny-secp256k1';
import { deriveSilentOutput } from './payments';
import {
  calculateInputHashTweak,
  calculateSharedSecret,
  calculateSumA,
  decodeSilentPaymentAddress,
  generateLabelAndAddress,
} from './payments/p2sp';
import * as tools from 'uint8array-tools';
import { isZero32 } from './bufferutils';
import { bitcoin } from './networks';

/**
 * Serialize output with number little endian
 * (used to sort outputs)
 * @param txidHexBE - big endian encoded tx
 * @param vout - output index
 * @returns the serialized little endian encoded output
 */
export const serOutpointLE = (txidHexBE: Uint8Array, vout: number) => {
  const out = new Uint8Array(36);
  if (txidHexBE.length !== 32) throw new Error('txid must be 32 bytes');
  txidHexBE.reverse(); // BE -> LE
  out.set(txidHexBE, 0);
  writeUInt32(out, 32, vout >>> 0, 'le');
  return out;
};

/**
 * Smallest outpoint = lexicographic min of (txidLE || voutLE)
 * @param inputs an array of inputs you want the first lexicographically sorted result
 * @returns the first output after sorting lexicographically
 */
export const findSmallestOutpoint = (inputs: Array<Input>) =>
  inputs
    .map(v => serOutpointLE(v.hash, v.index))
    .sort((a, b) => tools.compare(a, b))[0];

/**
 * Scans a transaction's inputs and outputs to find any silent payments for the receiver.
 * @param receiverScanPrivkey - b_scan
 * @param receiverSpendPrivkey - b_spend
 * @param inputHashTweak
 * @param summedSenderPubkey - A_sum
 * @param outputsToCheck - array of hex xOnly encoded outputs to check
 * @param labelNonces
 */
export function scanForSilentPayments(
  receiverScanPrivkey: Uint8Array,
  receiverSpendPrivkey: Uint8Array,
  inputHashTweak: Uint8Array,
  summedSenderPubkey: Uint8Array,
  outputsToCheck: Set<string>,
  labelNonces: Array<number> = Array.from([]),
): SilentOutput[] {
  let foundPayments: SilentOutput[] = [];

  // G
  const baseSpendPubkey: Uint8Array = ecc.pointFromScalar(
    receiverSpendPrivkey,
    true,
  )!;

  // Shared secret S = (inputHash * A_sum) * b_scan  (order equivalent)
  const S = calculateSharedSecret(
    inputHashTweak,
    summedSenderPubkey,
    receiverScanPrivkey,
  );
  if (!S) return [];

  // First, scan for the base (unlabeled) address
  foundPayments = foundPayments.concat(
    performScan(baseSpendPubkey, S, outputsToCheck, null),
  );

  // Then, scan for each labeled address
  for (const m of labelNonces) {
    const { L, Bm } = generateLabelAndAddress(
      receiverScanPrivkey,
      baseSpendPubkey,
      m,
    );

    const labeledResults = performScan(Bm, S, outputsToCheck, L);

    // Add the label nonce to any found payments for identification
    labeledResults.forEach(result => {
      foundPayments.push({ ...result, labelNonce: m });
    });
  }

  return foundPayments;
}

/**
 * The core scanning logic, performed for a specific spend public key (B_spend).
 * @param receiverSpendPubkey - G or B_m
 * @param S
 * @param outputsToCheck - array of hex xOnly encoded outputs to check
 * @param labelScalar
 = */
function performScan(
  receiverSpendPubkey: Uint8Array,
  S: Uint8Array,
  outputsToCheck: Set<string>,
  labelScalar: Uint8Array | null, // L (or null for base)
): SilentOutput[] {
  const found: SilentOutput[] = [];

  for (let k = 0; k < outputsToCheck.size; k++) {
    const derivedOutput = deriveSilentOutput(S, receiverSpendPubkey, k);
    if (!derivedOutput.pub_key) break;
    const xonlyHex = toHex(derivedOutput.pub_key).toLowerCase();

    if (outputsToCheck.size === 0 || outputsToCheck.has(xonlyHex)) {
      // priv_key_tweak returned by L + t_k (mod n) for labeled, or t_k for unlabeled
      let spendTweak = derivedOutput.tweak_key;
      if (labelScalar != null && !isZero32(labelScalar)) {
        const sum: Uint8Array | null = ecc.privateAdd(
          labelScalar,
          derivedOutput.tweak_key,
        );
        if (!sum) throw new Error('privateAdd(label, t_k) failed');
        spendTweak = sum;
      }
      found.push({
        ...derivedOutput,
        priv_key_tweak: spendTweak,
        labelScalar,
      });
    }
  }
  return found;
}

/** A Previous Output object, containing the scriptPubKey and value needed to scan an input. */
export interface Prevout {
  txid: string; // The transaction id of the previous output.
  vout: number; // The output index of the previous output.
  script: Uint8Array; // The scriptPubKey of the previous output.
  value: number; // The value of the previous output.
}

/** The receiver's private keys needed for scanning. */
interface ReceiverKeys {
  scanPrivKey: Uint8Array;
  spendPrivKey: Uint8Array;
}

/**
 * The result of a successful scan, providing the data needed to spend the output.
 * Extends the base SilentOutput from p2sp.ts to include transaction-specific UTXO info.
 */
export interface SilentOutput extends P2SPSilentOutput {
  utxo: {
    txid: string;
    vout: number;
    value: number;
  };
}

/**
 * Extends the bitcoinjs-lib Transaction class to provide methods
 * for creating and scanning for BIP-352 Silent Payments.
 */
export class SilentPaymentTransaction extends bitcoin.Transaction {
  private _senderPrivateKeys: { key: Uint8Array; isXOnly: boolean }[] = [];
  private _silentIntents: {
    recipientAddress: string;
    value: number;
    vout: number; // The index of the placeholder output
  }[] = [];
  private _outputsDirty: boolean = true;

  /**
   * Adds an input to the transaction and tracks its private key for SP calculations.
   * NOTE: Adding an input invalidates any previously calculated silent payment outputs.
   * Call `finalizeSilentOutputs()` after all inputs have been added.
   * @param hash Transaction hash of the input.
   * @param index Output index of the input.
   * @param sequence The sequence number.
   * @param scriptSig The script signature (for non-witness inputs).
   * @param prevoutScript The scriptPubKey of the UTXO being spent.
   * @param senderPrivateKey The private key corresponding to this input.
   */
  addSilentInput(
    hash: Uint8Array,
    index: number,
    sequence: number | undefined,
    scriptSig: Uint8Array | undefined,
    prevoutScript: Uint8Array,
    senderPrivateKey: Uint8Array,
  ): number {
    const isP2TR = prevoutScript.length === 34 && prevoutScript[0] === 0x51;
    this._senderPrivateKeys.push({ key: senderPrivateKey, isXOnly: isP2TR });
    this._outputsDirty = true; // Mark outputs as dirty whenever an input changes.
    // The parent class expects Buffers. Casting to `any` to match user's request.
    return super.addInput(hash as any, index, sequence, scriptSig as any);
  }

  /**
   * Calculates the sum of the sender's private keys using the helper from p2sp.ts.
   * This is the `a_sum` scalar.
   */
  private _calculateSummedPrivateKey(): Uint8Array | null {
    if (this._senderPrivateKeys.length === 0) {
      throw new Error('Cannot create a silent payment without inputs.');
    }
    return calculateSumA(
      this._senderPrivateKeys.map(pk => ({
        priv: pk.key,
        isXOnly: pk.isXOnly,
      })),
    );
  }

  /**
   * Adds a placeholder for a silent payment output and stores the intent to calculate it later.
   * The actual script will be generated and inserted when `finalizeSilentOutputs()` is called.
   * @param recipientAddress The bech32m-encoded silent payment address of the recipient.
   * @param value The amount in satoshis to send.
   * @returns The vout (output index) of the placeholder output.
   */
  addSilentPaymentOutput(recipientAddress: string, value: number): number {
    // Add a placeholder output (empty script) to reserve the vout and value.
    const placeholderScript = new Uint8Array(0);
    const vout = this.addOutput(placeholderScript, value);

    // Store the intent to be finalized later.
    this._silentIntents.push({
      recipientAddress,
      value,
      vout,
    });

    return vout;
  }

  /**
   * Finalizes all pending silent payment outputs. This method calculates the correct
   * output scripts based on the final set of inputs and updates the transaction.
   * It is idempotent and will only perform calculations if inputs have changed.
   *
   * THIS METHOD MUST BE CALLED after all inputs have been added and before signing.
   */
  finalizeSilentOutputs(): void {
    if (!this._outputsDirty || this._silentIntents.length === 0) {
      return; // Nothing to do or already up-to-date.
    }

    const a_sum = this._calculateSummedPrivateKey();
    if (!a_sum) {
      throw new Error(
        'Sender private keys sum to zero; cannot create silent payment outputs.',
      );
    }

    const smallestOutpoint = findSmallestOutpoint(this.ins);
    const A_sum_point = ecc.pointFromScalar(a_sum, true)!;
    const input_hash = calculateInputHashTweak(smallestOutpoint, A_sum_point);

    // This map tracks the 'k' value for each recipient (B_scan) during this finalization.
    const kValues = new Map<string, number>();

    for (const intent of this._silentIntents) {
      const { recipientAddress, vout } = intent;

      const { B_scan, B_spend } = decodeSilentPaymentAddress(recipientAddress);
      const bScanHex = toHex(B_scan);
      const k = kValues.get(bScanHex) || 0;

      // S = (input_hash * B_scan) * a_sum
      const S = calculateSharedSecret(input_hash, B_scan, a_sum);

      // { pub_key, tweak_key } = deriveSilentOutput(...)
      const { pub_key } = deriveSilentOutput(S, B_spend, k);

      const p2tr = bitcoin.payments.p2tr({ pubkey: pub_key });
      if (!p2tr.output) {
        throw new Error(
          `Failed to create P2TR output script for recipient ${recipientAddress}`,
        );
      }

      // Update the placeholder output with the correct script.
      this.outs[vout].script = p2tr.output;

      // Increment k for the next payment to this same recipient in this batch.
      kValues.set(bScanHex, k + 1);
    }

    // Reset the dirty flag after successful finalization.
    this._outputsDirty = false;
  }

  /**
   * Scans a finalized transaction to find any outputs belonging to the receiver.
   * @param tx The finalized bitcoinjs-lib Transaction object.
   * @param prevouts An array of Previous Outputs being spent by the transaction, used to get prevout scripts.
   * @param receiverKeys The receiver's scan and spend private keys.
   * @param labelNonces An optional array of label nonces to scan for.
   * @returns An array of found silent payment outputs with spending information.
   */
  static scan(
    tx: Transaction,
    prevouts: Prevout[],
    receiverKeys: ReceiverKeys,
    labelNonces: number[] = [],
  ): SilentOutput[] {
    const validPubkeys = tx.ins
      .map(input => {
        const prevout = prevouts.find(
          p =>
            tools.equals(tools.fromHex(p.txid).reverse(), input.hash) &&
            p.vout === input.index,
        );
        if (!prevout) return null;
        // The getPublicKeyFromInput function expects Buffers.
        // Casting to `any` to match user's request to avoid Buffer.from()
        return getPublicKeyFromInput({
          prevoutScript: prevout.script as any,
          scriptSig: input.script as any,
          witness: input.witness as any,
        });
      })
      .filter((pk): pk is Uint8Array => pk !== null);

    if (validPubkeys.length === 0) return [];

    const A_sum = validPubkeys.reduce((acc, pk) => ecc.pointAdd(acc, pk)!);
    if (!A_sum) return [];

    const smallestOutpoint = findSmallestOutpoint(this.ins);
    const input_hash = calculateInputHashTweak(smallestOutpoint, A_sum);

    const txOutputXOnlyPubkeys = tx.outs.map(out => toHex(out.script.slice(2)));
    const outputsToCheck = new Set(txOutputXOnlyPubkeys);

    // Delegate the core scanning logic to the tested helper function.
    const foundP2SPOutputs = scanForSilentPayments(
      receiverKeys.scanPrivKey,
      receiverKeys.spendPrivKey,
      input_hash,
      A_sum,
      outputsToCheck,
      labelNonces,
    );

    // Map the results from the generic helper to the transaction-specific SilentOutput type.
    return foundP2SPOutputs.map(p2spOutput => {
      const pubkeyHex = toHex(p2spOutput.pub_key);
      const vout = txOutputXOnlyPubkeys.findIndex(hex => hex === pubkeyHex);

      if (vout === -1) {
        throw new Error(
          'Logic error: Found output not present in transaction.',
        );
      }

      return {
        ...p2spOutput,
        utxo: {
          txid: tx.getId(),
          vout,
          value: tx.outs[vout].value,
        },
      };
    });
  }
}
