import { bitcoin as BITCOIN_NETWORK } from '../networks';
import * as ecc from 'tiny-secp256k1';
import { toXOnly } from '../psbt/bip371';
import * as tools from 'uint8array-tools';
import { toHex, writeUInt32 } from 'uint8array-tools';
import { bech32m } from 'bech32';
import * as lazy from './lazy';
import { taggedHash } from '../crypto';
// --- TYPE DEFINITIONS & UTILITIES ---
export const BECH32_SP_LIMIT = 150;
/**
 * Create a 32Bit Unsigned integer
 * @param n the number to put
 * @returns a in [Uint8Array] big endian encoded
 */
export function ser32BE(n) {
  const b = new Uint8Array(4);
  writeUInt32(b, 0, n >>> 0, 'be');
  return b;
}
const N = tools.fromHex(
  'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141',
);
function isZero32(a) {
  for (let i = 0; i < 32; i++) if (a[i] !== 0) return false;
  return true;
}
//TODO I guess there already is a function for this ?
function subBE(a, b) {
  const o = new Uint8Array(32);
  let c = 0;
  for (let i = 31; i >= 0; i--) {
    let v = a[i] - b[i] - c;
    if (v < 0) {
      v += 256;
      c = 1;
    } else c = 0;
    o[i] = v;
  }
  return o;
}
//TODO I guess there already is a function for this ?
function modN32(x) {
  let r = new Uint8Array(x);
  while (tools.compare(r, N) >= 0) r = subBE(r, N);
  return r;
}
function hashToTweak(h) {
  let t = modN32(h);
  if (isZero32(t)) {
    t = new Uint8Array(32);
    t[31] = 1;
  }
  return t;
}
/**
 * Smallest outpoint = lexicographic min of (txidLE || voutLE)
 * @param inputs an array of inputs you want the first lexicographically sorted result
 * @returns the first output after sorting lexicographically
 */
export const findSmallestOutpoint = inputs =>
  inputs
    .map(v => serOutpointLE(v.hash, v.index))
    .sort((a, b) => tools.compare(a, b))[0];
/**
 * Serialize output with number little endian
 * (used to sort outputs)
 * @param txidHexBE - big endian encoded tx
 * @param vout - output index
 * @returns the serialized little endian encoded output
 */
export const serOutpointLE = (txidHexBE, vout) => {
  const out = new Uint8Array(36);
  if (txidHexBE.length !== 32) throw new Error('txid must be 32 bytes');
  txidHexBE.reverse(); // BE -> LE
  out.set(txidHexBE, 0);
  writeUInt32(out, 32, vout >>> 0, 'le');
  return out;
};
/**
 * Encodes spend and scan public keys into a Bech32m Silent Payment address.
 * @param B_spend
 * @param B_scan
 * @param version
 * @param network - testing, regtest or prod
 * @returns bech32m encoded string
 */
export function encodeSilentPaymentAddress(
  B_spend,
  B_scan,
  version = 0,
  network = BITCOIN_NETWORK,
) {
  if (version !== 0)
    throw new Error(`Unsupported silent payment address version: ${version}`);
  const SP_HRP = network.bech32 === 'bc' ? 'sp' : 'tsp';
  let data;
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
 * Decodes a Bech32m Silent payment address into its spend and scan public keys.
 * @param address - bech32m silent payment address format
 * @returns { B_spend, B_scan, version }
 */
export function decodeSilentPaymentAddress(address) {
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
  let B_spend;
  let B_scan;
  switch (version) {
    case 0:
      // Handle both current (64 bytes for x-only keys) and legacy (66 bytes for full keys) payload lengths.
      if (keysData.length === 64) {
        // Current spec: 32-byte x-only keys. Reconstruct with even y-parity (0x02) as per convention.
        const B_scan_xonly = keysData.slice(0, 32);
        const B_spend_xonly = keysData.slice(32, 64);
        B_spend = new Uint8Array(33);
        B_spend[0] = 0x02;
        B_spend.set(B_spend_xonly, 1);
        B_scan = new Uint8Array(33);
        B_scan[0] = 0x02;
        B_scan.set(B_scan_xonly, 1);
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
/**
 * Main function for creating a Pay-to-Silent-Payment (P2SP) payment object.
 * This function encapsulates the logic for handling silent payment addresses and keys.
 *
 * @param a - The payment object containing the necessary data for P2SP.
 * @param opts - Optional payment options.
 * @returns The P2SP payment object.
 */
export function p2sp(a, opts) {
  if (!a.address && !(a.spendPubkey && a.scanPubkey)) {
    throw new TypeError('Not enough data');
  }
  opts = Object.assign({ validate: true }, opts || {});
  const network = a.network || BITCOIN_NETWORK;
  const o = { name: 'p2sp', network };
  // Lazy load silent payment specific properties
  lazy.prop(o, 'spendPubkey', () => {
    if (a.address) return decodeSilentPaymentAddress(a.address).B_spend;
    return a.spendPubkey;
  });
  lazy.prop(o, 'scanPubkey', () => {
    if (a.address) return decodeSilentPaymentAddress(a.address).B_scan;
    return a.scanPubkey;
  });
  lazy.prop(o, 'address', () => {
    if (a.address) return a.address;
    const version = a.version !== undefined ? a.version : 0;
    return encodeSilentPaymentAddress(
      o.spendPubkey,
      o.scanPubkey,
      version,
      network,
    );
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
/** Calculate Input hash tweak
 * input_hash tweak = H_tag(Inputs, outpoint_L || ser_P(A))  -> reduce mod n
 * @param smallestOutpoint - output of (findSmallestOutpoint)
 * @param summedSenderPubkey
 * @returns the input_hash tweak
 */
export function calculateInputHashTweak(smallestOutpoint, summedSenderPubkey) {
  const ihRaw = taggedHash(
    'BIP0352/Inputs',
    tools.concat([smallestOutpoint, summedSenderPubkey]),
  );
  return hashToTweak(ihRaw);
}
/**
 * Calculate the sum of input private keys
 * @param inputPrivKeyTuples - an array of inputs to sum
 * @returns aSum the resulting sum
 */
export function calculateSumA(inputPrivKeyTuples) {
  if (inputPrivKeyTuples.length === 0) return null;
  let aSum = null;
  for (const { priv, isXOnly } of inputPrivKeyTuples) {
    if (!ecc.isPrivate(priv)) continue;
    let k = priv;
    // only normalize when key will be used as x-only (Taproot key-spend).
    if (isXOnly) {
      const P = ecc.pointFromScalar(k, true);
      if (!P) continue; // skip invalid
      if (P[0] === 0x03) {
        const neg = ecc.privateNegate(k);
        if (!neg) return null; // defensive
        k = neg;
      }
    }
    aSum = aSum ? ecc.privateAdd(aSum, k) : k;
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
 * @param summedSenderPrivkey - a_Sum
 * @returns S
 */
export function calculateSharedSecret(
  inputHash,
  scanPubkey,
  summedSenderPrivkey,
) {
  if (!summedSenderPrivkey)
    throw new Error('summedSenderPrivkey was not provided?');
  const Si = ecc.pointMultiply(scanPubkey, inputHash, true);
  if (!Si) throw new Error('pointMultiply(B_scan, ih) failed');
  const S = ecc.pointMultiply(Si, summedSenderPrivkey, true);
  if (!S) throw new Error('pointMultiply(Si, summedSenderPrivkey) failed');
  else return S;
}
/**
 *  Calculate the tweak key
 *  input_hash tweak = H_tag(Inputs, outpoint_L || ser_P(A))  -> reduce mod n
 * @constructor
 * @param S
 * @param k
 * @returns input_hash tweak
 */
export function calculateT_k(S, k) {
  const t_k = taggedHash('BIP0352/SharedSecret', tools.concat([S, ser32BE(k)]));
  return hashToTweak(t_k);
}
/**
 *  Calculate P_k
 *  P_k = B_spend + t_k·G (compressed) -> x-only for P2TR
 * @param spendPubKey
 * @param t_k
 * @returns Pk
 */
export function calculateP_k(spendPubKey, t_k) {
  const Pk = ecc.pointAddScalar(spendPubKey, t_k, true);
  if (!Pk) throw new Error('pointAddScalar failed');
  return Pk;
}
/**
 * derive a silent payment output for a transaction.
 * @param S - shared secret = (inputHash * B_scan) * a_sum   (compressed)
 * @param spendPubkey - B_spend
 * @param k - output number
 * @returns the newly calculated output
 */
export function deriveOutput(S, spendPubkey, k) {
  // t_k = H_tag(SharedSecret, ser_P(S) || ser32BE(k))  -> reduce mod n
  const t_k = calculateT_k(S, k);
  if (!t_k) throw new Error('t_k: failed');
  // P_k = B_spend + t_k·G (compressed) -> x-only for P2TR
  const P_k = calculateP_k(spendPubkey, t_k);
  const P_xOnly = toXOnly(P_k);
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
  receiverScanPrivkey, // b_scan (32B)
  m,
) {
  const raw = taggedHash(
    'BIP0352/Label',
    tools.concat([receiverScanPrivkey, ser32BE(m)]),
  );
  return hashToTweak(raw);
}
/**
 * Generate labeled address Bm
 *
 * @param B_scan
 * @param B_spend
 * @param label
 * @returns {L, Bm} - Label tweak and unencoded labeled address Bm
 */
export function generateLabelAndAddress(B_scan, B_spend, label) {
  // TaggedHash("BIP0352/Label", ser256(b_scan) || ser32BE(m))
  const L = createLabelTweak(B_scan, label);
  // Bm = B_spend + hashBIP0352/Label(ser256(b_scan) || ser32(m))·G
  const Bm = ecc.pointAddScalar(B_spend, L, true);
  if (!Bm) throw new Error('pointAddScalar(B_spend, L) failed');
  return { L, Bm };
}
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
  receiverScanPrivkey,
  receiverSpendPrivkey,
  inputHashTweak,
  summedSenderPubkey,
  outputsToCheck,
  labelNonces = Array.from([]),
) {
  let foundPayments = [];
  // G
  const baseSpendPubkey = ecc.pointFromScalar(receiverSpendPrivkey, true);
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
function performScan(receiverSpendPubkey, S, outputsToCheck, labelScalar) {
  const found = [];
  for (let k = 0; k < outputsToCheck.size; k++) {
    const derivedOutput = deriveOutput(S, receiverSpendPubkey, k);
    if (!derivedOutput.pub_key) break;
    const xonlyHex = toHex(derivedOutput.pub_key).toLowerCase();
    if (outputsToCheck.size === 0 || outputsToCheck.has(xonlyHex)) {
      // priv_key_tweak returned by L + t_k (mod n) for labeled, or t_k for unlabeled
      let spendTweak = derivedOutput.tweak_key;
      if (labelScalar != null && !isZero32(labelScalar)) {
        const sum = ecc.privateAdd(labelScalar, derivedOutput.tweak_key);
        if (!sum) throw new Error('privateAdd(label, t_k) failed');
        spendTweak = sum;
      }
      // TODO chose to return the hex encoded or raw Uint8Array
      found.push({
        priv_key_tweak: spendTweak,
        pub_key: derivedOutput.pub_key,
      });
    }
  }
  return found;
}
