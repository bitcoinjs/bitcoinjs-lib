import { bitcoin as BITCOIN_NETWORK, Network } from '../networks';
import * as ecc from 'tiny-secp256k1';
import { toXOnly } from '../psbt/bip371';
import * as tools from 'uint8array-tools';
import { writeUInt32 } from 'uint8array-tools';
import { bech32m } from 'bech32';

// Explicitly import the Payment type for clarity
import { Payment, PaymentOpts } from './index';
import * as lazy from './lazy';
import { taggedHash } from '../crypto';
import { isZero32 } from '../bufferutils';

// --- TYPE DEFINITIONS & UTILITIES ---
export const BECH32_SP_LIMIT = 150;

/**
 * @property {Uint8Array} [S] - Shared secret between you and recipient
 * @property {Uint8Array} [B_spend_pub] - Recipients spend pubkey B_scan
 */
interface Recipient {
  S?: Uint8Array;
  B_spend_pub?: Uint8Array;
}

/**
 * @property {Uint8Array} [pub_key] - Resulting xOnly P_k of {@link calculateP_k}
 * @property {Uint8Array} [tweak_key] - t_k
 * @property {Uint8Array} [priv_key_tweak] - labeled t_k when labeled are used else the same as t_k
 * @property {number} [labelNonce] -
 * @property {Uint8Array} [labelScalar] - result of TaggedHash("BIP0352/Label", ser256(b_scan) || ser32BE(m)) {@link createLabelTweak}
 */
interface SilentOutput {
  pub_key: Uint8Array;
  tweak_key: Uint8Array;
  priv_key_tweak?: Uint8Array;
  labelNonce?: number;
  labelScalar?: Uint8Array;
}

/**
 * Represents a Silent Payment transaction structure that extends a standard {@link Payment}.
 * Includes additional cryptographic and metadata fields used for constructing
 * or parsing silent payments.
 *
 * @property {Uint8Array} [spendPubkey] - Optional spend public key for the sender.
 * @property {Uint8Array} [scanPubkey] - Optional scan public key used for recipient address derivation.
 * @property {SilentOutput[]} [silentOutputs] - Optional array of silentOutputs generated for use in the transaction.
 * @property {number} [version] - Optional version number of the silent payment scheme.
 * @property {Uint8Array} [aSum] - Optional summed private key (see `calculateSumA`).
 * @property {Uint8Array} [outpointL] - Optional first result of lexicographically sorted input transaction IDs.
 * @property {{ priv: Uint8Array; isXOnly: boolean }[]} [privKeys] - Optional array of private keys associated with the transaction.
 * Each object includes the private key and a flag indicating if it's x-only.
 * @property {Recipient[]} recipients - Array of recipients for this silent payment.
 */
export interface SilentPayment extends Payment {
  spendPubkey?: Uint8Array;
  scanPubkey?: Uint8Array;
  silentOutputs?: SilentOutput[];
  version?: number;
  aSum?: Uint8Array;
  outpointL?: Uint8Array;
  privKeys?: Array<{ priv: Uint8Array; isXOnly: boolean }>;
  recipients?: Array<Recipient>;
}

/**
 * Main function for creating a Pay-to-Silent-Payment (P2SP) payment object.
 * This function encapsulates the logic for handling silent payment addresses and keys.
 *
 * @param {SilentPayment} [a] - The payment object containing the necessary data for P2SP.
 * @param {PaymentOpts} [opts] - Optional payment options.
 * @returns The P2SP payment object.
 */
export function p2sp(a: SilentPayment, opts?: PaymentOpts): SilentPayment {
  if (!a.address && !(a.spendPubkey && a.scanPubkey)) {
    throw new TypeError('Not enough data');
  }
  opts = Object.assign({ validate: true }, opts || {});

  const network = a.network || BITCOIN_NETWORK;
  const o: SilentPayment = { name: 'p2sp', network };

  // Lazy load silent payment specific properties
  lazy.prop(o, 'spendPubkey', () => {
    if (a.address) return decodeSilentPaymentAddress(a.address).B_spend;
    return a.spendPubkey!;
  });
  lazy.prop(o, 'scanPubkey', () => {
    if (a.address) return decodeSilentPaymentAddress(a.address).B_scan;
    return a.scanPubkey!;
  });
  lazy.prop(o, 'address', () => {
    if (a.address) return a.address;
    const version = a.version !== undefined ? a.version : 0;
    return encodeSilentPaymentAddress(
      o.spendPubkey!,
      o.scanPubkey!,
      version,
      network,
    );
  });
  lazy.prop(o, 'silentOutputs', () => {
    if (a.silentOutputs) return a.silentOutputs;
    const allRecipientsComplete = a.recipients.every(
      r => r.S.length > 0 && r.B_spend_pub.length > 0,
    );
    const allRecipientsHaveB_spend = a.recipients.every(
      r => r.B_spend_pub.length > 0,
    );
    // If we have both the secret and B_spend for each key we can derive directly
    if (allRecipientsComplete) {
      return a.recipients?.map((value, index) => {
        deriveSilentOutput(value.S, value.B_spend_pub, index);
      });
    }
    // If we have outpointL, aSum and only the spend keys for the recipients we need to calculate the input hash and secret
    else if (
      a.outpointL != null &&
      a.outpointL?.length > 0 &&
      a.aSum != null &&
      a.aSum?.length > 0 &&
      a.recipients?.length > 0 &&
      allRecipientsHaveB_spend
    ) {
      const A: Uint8Array = ecc.pointFromScalar(a.aSum, true); // compressed 33B
      const inputHashTweak: Uint8Array = calculateInputHashTweak(
        a.outpointL,
        A,
      );
      return a.recipients?.map((value, index) => {
        const S = calculateSharedSecret(
          inputHashTweak,
          value.B_spend_pub,
          a.aSum,
        );
        deriveSilentOutput(S, value.B_spend_pub, index);
      });
    } else throw Error('Not enough data to derive outputs');
  });

  if (opts.validate) {
    if (a.address) {
      const decoded = decodeSilentPaymentAddress(a.address);
      if (a.spendPubkey && tools.compare(a.spendPubkey, decoded.B_spend) !== 0)
        throw new TypeError('Spend pubkey mismatch');
      if (a.scanPubkey && tools.compare(a.scanPubkey, decoded.B_scan) !== 0)
        throw new TypeError('Scan pubkey mismatch');

      const HRP = network.bech32 === 'bc' ? 'sp' : 'tsp';
      if (!a.address.startsWith(HRP)) {
        throw new TypeError('Invalid prefix or Network mismatch');
      }
    }
    if (o.spendPubkey && o.spendPubkey.length !== 33)
      throw new TypeError('Invalid spend pubkey length');
    if (o.scanPubkey && o.scanPubkey.length !== 33)
      throw new TypeError('Invalid scan pubkey length');
  }

  return Object.assign(o, a);
}

/**
 * Create a 32Bit Unsigned integer
 * @param n the number to put
 * @returns a in [Uint8Array] big endian encoded
 */
export function ser32BE(n: number): Uint8Array {
  const b = new Uint8Array(4);
  writeUInt32(b, 0, n >>> 0, 'be');
  return b;
}

/**
 * Encodes spend and scan public keys into a Bech32m Silent Payment address.
 * @param {Uint8Array} [B_spend] - spend public key.
 * @param {Uint8Array} [B_scan] - public scan key.
 * @param {number} [version] - Optional version number of the silent payment scheme.
 * @param network - testing, regtest or prod
 * @returns bech32m encoded string
 */
export function encodeSilentPaymentAddress(
  B_spend: Uint8Array,
  B_scan: Uint8Array,
  version = 0,
  network: Network = BITCOIN_NETWORK,
): string {
  if (version !== 0)
    throw new Error(`Unsupported silent payment address version: ${version}`);

  const SP_HRP = network.bech32 === 'bc' ? 'sp' : 'tsp';
  let data: Uint8Array;

  // To ensure encode/decode is symmetric, we use the legacy 66-byte format
  // if full 33-byte keys are provided. This preserves the original y-parity.
  if (B_spend.length === 33 && B_scan.length === 33) {
    data = tools.concat([B_scan, B_spend]);
  } else {
    // Otherwise, we use the modern 64-byte format with x-only keys as per the spec.
    const B_spend_xonly = B_spend.length === 33 ? B_spend.slice(1) : B_spend;
    const B_scan_xonly = B_scan.length === 33 ? B_scan.slice(1) : B_scan;

    if (B_spend_xonly.length !== 32 || B_scan_xonly.length !== 32) {
      throw new Error('Invalid public key length for silent payment address');
    }
    data = tools.concat([B_scan_xonly, B_spend_xonly]);
  }

  // The data is converted to 5-bit words, and the version is prepended to the words array.
  const words = bech32m.toWords(data);
  words.unshift(version);

  // The default bech32 limit is 90, but silent payment addresses are longer.
  // We pass a higher limit to accommodate this, as the underlying implementation allows it.
  return bech32m.encode(SP_HRP, words, BECH32_SP_LIMIT);
}

/**
 * @property {Uint8Array} [B_spend] - spend public key.
 * @property {Uint8Array} [B_scan] - public scan key.
 * @property {number} [version] - silent payment version
 */
interface DecodedSilentPaymentAddress {
  B_spend: Uint8Array; // pub spend key
  B_scan: Uint8Array; // pub scan key
  version: number;
}

/**
 * Decodes a Bech32m Silent payment address into its spend and scan public keys.
 * @param address - bech32m silent payment address format
 * @returns { DecodedSilentPaymentAddress } - Decoded silent payment address
 */
export function decodeSilentPaymentAddress(
  address: string,
): DecodedSilentPaymentAddress {
  // The default bech32 limit is 90, but silent payment addresses are longer.
  // We pass a higher limit to accommodate this, as the underlying implementation allows it.
  const { prefix, words } = bech32m.decode(address, BECH32_SP_LIMIT);
  if (prefix !== 'sp' && prefix !== 'tsp') {
    throw new Error('Invalid silent payment address prefix');
  }

  // The first word is the version, the rest are the data payload.
  const version = words[0];
  const dataWords = words.slice(1);
  const keysData = new Uint8Array(bech32m.fromWords(dataWords));

  let B_spend: Uint8Array;
  let B_scan: Uint8Array;

  switch (version) {
    case 0:
      // Handle both current (64 bytes for x-only keys) and legacy (66 bytes for full keys) payload lengths.
      if (keysData.length === 64) {
        // Current spec: 32-byte x-only keys. Reconstruct with even y-parity (0x02) as per convention.
        const B_scan_xOnly = keysData.slice(0, 32);
        const B_spend_xOnly = keysData.slice(32, 64);

        B_spend = new Uint8Array(33);
        B_spend[0] = 0x02;
        B_spend.set(B_spend_xOnly, 1);

        B_scan = new Uint8Array(33);
        B_scan[0] = 0x02;
        B_scan.set(B_scan_xOnly, 1);
      } else if (keysData.length === 66) {
        // Legacy spec: 33-byte full keys. We can return them directly to preserve the original y-parity.
        B_scan = keysData.slice(0, 33);
        B_spend = keysData.slice(33, 66);
      } else {
        throw new Error(
          `Invalid silent payment address data length for v0: ${keysData.length}`,
        );
      }
      break;
    default:
      // Future versions might have different lengths. For now, we only support v0.
      throw new Error(`Unsupported silent payment address version: ${version}`);
  }

  return { B_spend, B_scan, version };
}

/** Calculate Input hash tweak
 * input_hash tweak = H_tag(Inputs, outpoint_L || ser_P(A))
 * @returns the input_hash tweak
 * @param outpointL36
 * @param summedSenderPubkey33
 */
export function calculateInputHashTweak(
  outpointL36: Uint8Array, // 36B = txid(LE 32B) || vout(LE 4B)
  summedSenderPubkey33: Uint8Array, // ser_P(A): 33B compressed
): Uint8Array {
  // Basic format checks
  if (outpointL36.length !== 36) {
    throw new Error('outpoint_L must be 36 bytes (txid||vout LE)');
  }
  // Accept only compressed points for ser_P(A)
  if (
    !(
      summedSenderPubkey33.length === 33 &&
      (summedSenderPubkey33[0] === 0x02 || summedSenderPubkey33[0] === 0x03)
    )
  ) {
    throw new Error('ser_P(A) must be a 33-byte compressed pubkey');
  }

  const ihRaw: Uint8Array = taggedHash(
    'BIP0352/Inputs',
    tools.concat([outpointL36, summedSenderPubkey33]),
  );

  // BIP-352 rule: must be in [1..n-1]
  if (!ecc.isPrivate(ihRaw)) {
    throw new Error('input_hash scalar is 0 or >= n');
  }

  return ihRaw;
}

/**
 * Calculate the sum of input private keys
 * @param inputPrivKeyTuples - an array of inputs to sum
 * @returns aSum the resulting sum
 */
export function calculateSumA(
  inputPrivKeyTuples: Array<{ priv: Uint8Array; isXOnly: boolean }>,
): Uint8Array | null {
  if (inputPrivKeyTuples.length === 0) return null;

  let aSum: Uint8Array | null = null;

  for (const { priv, isXOnly } of inputPrivKeyTuples) {
    if (!ecc.isPrivate(priv)) continue;

    let k: Uint8Array = priv;

    // only normalize when key will be used as x-only (Taproot key-spend).
    if (isXOnly) {
      const P: Uint8Array | null = ecc.pointFromScalar(k, true);
      if (!P) continue; // skip invalid
      if (P[0] === 0x03) {
        const neg = ecc.privateNegate(k);
        if (!neg) return null; // defensive
        k = neg;
      }
    }

    aSum = aSum ? (ecc.privateAdd(aSum, k) as Uint8Array | null) : k;

    // If sum == 0 mod n, tiny-secp returns null. Treat as degenerate.
    if (aSum == null || isZero32(aSum)) return null;
  }

  return aSum && !isZero32(aSum) ? aSum : null;
}

/**
 *  Calculate shared secret
 *  S = (inputHash * B_scan) * a_sum   (compressed)
 * @param inputHash
 * @param scanPubkey - B_scan
 * @param summedSenderPrivKey - a_Sum
 * @returns S
 */
export function calculateSharedSecret(
  inputHash: Uint8Array, // 32B scalar
  scanPubkey: Uint8Array, // 33B compressed B_scan
  summedSenderPrivKey: Uint8Array, // 32B a_sum (even-Y normalized upstream)
): Uint8Array {
  if (!ecc.isPrivate(inputHash))
    throw new Error('input_hash scalar is 0 or >= n');
  if (!ecc.isPrivate(summedSenderPrivKey)) throw new Error('a_sum invalid');
  if (!ecc.isPointCompressed(scanPubkey))
    throw new Error('B_scan must be compressed');

  const Si = ecc.pointMultiply(scanPubkey, inputHash, true);
  if (Si === null)
    throw new Error('pointMultiply(B_scan, input_hash) -> infinity');

  const S = ecc.pointMultiply(Si, summedSenderPrivKey, true);
  if (S === null) throw new Error('pointMultiply(Si, a_sum) -> infinity');

  return S; // 33B compressed ser_P(S)
}
/**
 *  Calculate the tweak key
 *  input_hash tweak = H_tag(Inputs, outpoint_L || ser_P(A))
 * @constructor
 * @param S
 * @param k
 * @returns input_hash tweak
 */
export function calculateT_k(S: Uint8Array, k: number): Uint8Array {
  const t_k = taggedHash('BIP0352/SharedSecret', tools.concat([S, ser32BE(k)]));
  if (!ecc.isPrivate(t_k)) throw new Error('shared-secret scalar is 0 or >= n');
  return t_k;
}

/**
 *  Calculate P_k
 *  P_k = B_spend + t_k·G (compressed) -> x-only for P2TR
 * @param spendPubKey - B_spend
 * @param t_k
 * @returns Pk
 */
export function calculateP_k(
  spendPubKey: Uint8Array,
  t_k: Uint8Array,
): Uint8Array {
  const Pk: Uint8Array | null = ecc.pointAddScalar(spendPubKey, t_k, true);
  if (!Pk) throw new Error('pointAddScalar failed');
  return Pk;
}

/**
 * derive a silent payment output for a transaction.
 * @param S - shared secret = (inputHash * B_scan) * a_sum   (compressed)
 * @param spendPubkey - B_spend
 * @param k - output number
 * @returns {SilentOutput} the newly calculated output
 */
export function deriveSilentOutput(
  S: Uint8Array,
  spendPubkey: Uint8Array,
  k: number,
): SilentOutput {
  // t_k = H_tag(SharedSecret, ser_P(S) || ser32BE(k))
  const t_k: Uint8Array | null = calculateT_k(S, k);
  if (!t_k) throw new Error('t_k: failed');

  // P_k = B_spend + t_k·G (compressed) -> x-only for P2TR
  const P_k: Uint8Array = calculateP_k(spendPubkey, t_k);
  const P_xOnly: Uint8Array = toXOnly(P_k);
  if (!P_xOnly) throw new Error('pointAddScalar failed');

  return { pub_key: P_xOnly, tweak_key: t_k };
}

/**
 * Label scalar: TaggedHash("BIP0352/Label", ser256(b_scan) || ser32BE(m))
 * @param receiverScanPrivkey
 * @param m
 * @return tweaked label hash
 */
export function createLabelTweak(
  receiverScanPrivkey: Uint8Array,
  m: number,
): Uint8Array {
  // normalize m to uint32 per BIP
  if (!Number.isInteger(m) || m < 0) throw new Error('label m must be uint32');
  const m32 = m >>> 0;
  const raw = taggedHash(
    'BIP0352/Label',
    tools.concat([receiverScanPrivkey, ser32BE(m32)]),
  );
  if (!ecc.isPrivate(raw)) throw new Error('label scalar is 0 or >= n');
  return raw;
}

/**
 * Generate labeled address Bm
 *
 * @param B_scan
 * @param B_spend
 * @param label
 * @returns {L, Bm} - Label tweak and unencoded labeled address Bm
 */
export function generateLabelAndAddress(
  B_scan: Uint8Array,
  B_spend: Uint8Array,
  label: number,
): { L: Uint8Array; Bm: Uint8Array } {
  // TaggedHash("BIP0352/Label", ser256(b_scan) || ser32BE(m))
  const L: Uint8Array = createLabelTweak(B_scan, label);
  // Bm = B_spend + hashBIP0352/Label(ser256(b_scan) || ser32(m))·G
  const Bm: Uint8Array | null = ecc.pointAddScalar(B_spend, L, true);
  if (!Bm) throw new Error('pointAddScalar(B_spend, L) failed');
  return { L, Bm };
}
