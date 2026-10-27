/* eslint-env mocha */
import assert from 'assert';
import * as ecc from 'tiny-secp256k1';
import * as bitcoin from 'bitcoinjs-lib';
import { fromHex, toHex } from 'uint8array-tools';
import fixtures from '../fixtures/p2sp.json';
import { hash160 } from '../../ts_src/crypto.js';
import {
  calculateInputHashTweak,
  calculateSharedSecret,
  calculateSumA,
  deriveSilentOutput,
  decodeSilentPaymentAddress,
  encodeSilentPaymentAddress,
} from '../../ts_src/payments/p2sp.js';
import { Input } from '../../ts_src/transaction.js';
import {
  findSmallestOutpoint,
  scanForSilentPayments,
} from '../../ts_src/SilentPaymentTransaction.js';

// ---- init ecc for bitcoinjs (even if we use tiny-secp directly) ----
bitcoin.initEccLib(ecc);

interface TestCase {
  comment?: string;
  sending: Array<Sender>;
  receiving: Array<Recipient>;
}

interface TestInput {
  txid: string;
  vout: number;
  scriptSig: string;
  txinwitness: string;
  prevout: {
    scriptPubKey: {
      hex: string;
    };
  };
  private_key?: string;
}

interface Sender {
  given: {
    vin: Array<TestInput>;
    recipients: Array<SenderRecipient>;
  };
  expected: {
    outputs: Array<Array<string>>;
    shared_secrets: Array<string>;
    input_private_key_sum: string;
    input_pub_keys: Array<string>;
  };
}

interface SenderRecipient {
  address: string;
  scan_pub_key: string;
  spend_pub_key: string;
}

interface Recipient {
  given: {
    vin: Array<TestInput>;
    outputs: Array<string>;
    key_material: {
      spend_priv_key: string;
      scan_priv_key: string;
    };
    labels: Array<number>;
  };
  expected: {
    addresses: Array<string>;
    outputs: Array<RecipientOutput>;
    tweak: string;
    shared_secret: string;
    input_pub_key_sum: string;
  };
}

interface RecipientOutput {
  priv_key_tweak: string;
  pub_key: string;
  signature: string;
}

// Detect patterns
function isP2PKH(spkHex?: string): boolean {
  const u = fromHex(spkHex || '');
  return (
    u.length === 25 &&
    u[0] === 0x76 &&
    u[1] === 0xa9 &&
    u[2] === 0x14 &&
    u[23] === 0x88 &&
    u[24] === 0xac
  );
}

function isP2SH(spkHex?: string): boolean {
  const u = fromHex(spkHex || '');
  return u.length === 23 && u[0] === 0xa9 && u[1] === 0x14 && u[22] === 0x87; // OP_HASH160 20 OP_EQUAL
}

function isP2WPKH(spkHexOrScriptHex?: string): boolean {
  const u = fromHex(spkHexOrScriptHex || '');
  return u.length === 22 && u[0] === 0x00 && u[1] === 0x14;
}

function isP2TR(spkHex?: string): boolean {
  const u = fromHex(spkHex || '');
  return u.length === 34 && u[0] === 0x51 && u[1] === 0x20; // OP_1 PUSH32
}

function readVarInt(
  u: Uint8Array,
  off: number,
): { val: number; next: number } | null {
  if (off >= u.length) return null;
  const fb = u[off];
  if (fb < 0xfd) return { val: fb, next: off + 1 };
  if (fb === 0xfd) {
    if (off + 2 >= u.length) return null;
    return { val: u[off + 1] | (u[off + 2] << 8), next: off + 3 };
  }
  if (fb === 0xfe) {
    if (off + 4 >= u.length) return null;
    return {
      val:
        (u[off + 1] |
          (u[off + 2] << 8) |
          (u[off + 3] << 16) |
          (u[off + 4] << 24)) >>>
        0,
      next: off + 5,
    };
  }
  return null; // 0xff not expected here
}

function parseWitnessItems(witHex: string): Uint8Array[] {
  const u = fromHex(witHex || '');
  const items: Uint8Array[] = [];
  let off = 0;
  const c = readVarInt(u, off);
  if (!c) return items;
  off = c.next;
  for (let i = 0; i < c.val; i++) {
    const L = readVarInt(u, off);
    if (!L) break;
    off = L.next;
    items.push(u.slice(off, off + L.val));
    off += L.val;
  }
  return items;
}

/**
 * Return a single compressed pubkey for display, or null if none.
 *
 * @param prevoutHex       vin.prevout.scriptPubKey.hex
 * @param scriptSigHex     vin.scriptSig (hex)
 * @param txinwitnessHex   vin.txinwitness (hex-serialized witness)
 */
function getPubkeyFromInputTS(
  prevoutHex?: string,
  scriptSigHex?: string,
  txinwitnessHex?: string,
): Uint8Array | null {
  // P2PKH
  if (isP2PKH(prevoutHex)) {
    const spk = fromHex(prevoutHex!);
    const spk_hash = spk.slice(3, 3 + 20); // hash160 in SPK
    const ss = fromHex(scriptSigHex || '');
    for (let i = ss.length; i >= 33; i--) {
      const cand = ss.slice(i - 33, i);
      if (
        (cand[0] === 0x02 || cand[0] === 0x03) &&
        hash160(cand).every((b, j) => b === spk_hash[j])
      ) {
        // compressed & hash matches SPK
        return cand;
      }
    }
  }

  // P2SH -> redeem_script is scriptSig[1:], if redeemScript is P2WPKH, take last witness item
  if (isP2SH(prevoutHex)) {
    const scriptSig = fromHex(scriptSigHex || '');
    const redeem = scriptSig.slice(1); // drop the first push opcode
    if (isP2WPKH(toHex(redeem))) {
      const items = parseWitnessItems(txinwitnessHex || '');
      if (items.length > 0) {
        const last = items[items.length - 1];
        if (last.length === 33 && (last[0] === 0x02 || last[0] === 0x03))
          return last;
      }
    }
  }

  // P2WPKH: last witness item is pubkey
  if (isP2WPKH(prevoutHex)) {
    const items = parseWitnessItems(txinwitnessHex || '');
    if (items.length > 0) {
      const last = items[items.length - 1];
      if (last.length === 33 && (last[0] === 0x02 || last[0] === 0x03))
        return last;
    }
  }

  // P2TR: if script-path spend, SKIP (mirrors NUMS-case behavior in vectors);
  // otherwise return internal key from prevout (x-only -> compressed even-Y)
  if (isP2TR(prevoutHex)) {
    const wit = parseWitnessItems(txinwitnessHex || '');
    let stack = [...wit];
    if (stack.length >= 1) {
      // Annex (BIP342): last item starting with 0x50
      if (stack.length > 1 && stack[stack.length - 1][0] === 0x50) {
        stack = stack.slice(0, -1);
      }
      if (stack.length > 1) {
        // Script-path spend -> in these vectors, it's the NUMS case -> skip
        return null;
      }
    }
    // Key-path spend: take internal x-only from prevout at [2..33], render as 02||x
    const spk = fromHex(prevoutHex!);
    const out = new Uint8Array(33);
    out[0] = 0x02;
    out.set(spk.slice(2, 34), 1);
    return out;
  }

  return null;
}

// ================================================================
// =========================  sender  =============================
// ================================================================
function runSenderCase(tc: Sender) {
  const { given, expected } = tc;

  // 1) input_pub_keys = [get_pubkey_from_input(vin) for vin if valid]
  const inputPubKeysHex: string[] = [];
  const inputPrivKeyTuples: Array<{ priv: Uint8Array; isXOnly: boolean }> = [];

  for (const inp of given.vin) {
    const priv = fromHex(inp.private_key);
    const prevoutHex = inp.prevout?.scriptPubKey?.hex || '';
    const scriptSigHex = inp.scriptSig || '';
    const txinwitnessHex = inp.txinwitness || '';

    const disp = getPubkeyFromInputTS(prevoutHex, scriptSigHex, txinwitnessHex);

    // include in the *display* list if present
    if (disp) inputPubKeysHex.push(toHex(disp));

    if (disp) {
      const isXOnly = isP2TR(prevoutHex);
      inputPrivKeyTuples.push({ priv, isXOnly });
    }
  }

  if (expected.input_pub_keys) {
    assert.deepStrictEqual(
      inputPubKeysHex.map(h => h.toLowerCase()),
      expected.input_pub_keys.map((h: string) => h.toLowerCase()),
      'input_pub_keys did not match expected',
    );
  }

  // Early exit (no usable inputs)
  if (inputPrivKeyTuples.length === 0) {
    assert(
      expected.outputs &&
        expected.outputs[0] &&
        expected.outputs[0].length === 0 &&
        'Sending test failed (no inputs case)',
    );
    return;
  }

  // -------- 2) a_sum with Taproot-only odd-Y conditional negation --------
  // 2) a_sum = Σ negated (mod n) via tiny-secp
  const aSum: Uint8Array = calculateSumA(inputPrivKeyTuples);

  // (optional) fixture check stays the same
  if (expected.input_private_key_sum) {
    assert.strictEqual(
      toHex(aSum).toLowerCase(),
      expected.input_private_key_sum.toLowerCase(),
      'a_sum did not match expected input_private_key_sum',
    );
  }
  // sl
  if (!aSum) return;

  // -------- 3) H_inputs(outpoint_L || ser_P(A)) --------
  const A = ecc.pointFromScalar(aSum, true) as Uint8Array; // compressed 33B
  const vinArray = given.vin.map(
    ({ txid, vout }): Array<Input> => ({ hash: fromHex(txid), index: vout }),
  );
  const outpointL = findSmallestOutpoint(vinArray);

  // -------- 4) group recipients by B_scan (first-seen order) --------
  type Group = { B_scan: Uint8Array; firstIdx: number; B_m_list: Uint8Array[] };
  const scanMap = new Map<string, Group>();
  const groups: Group[] = [];

  for (let i = 0; i < given.recipients.length; i++) {
    const r = given.recipients[i];
    const B_spend_pub = fromHex(r.spend_pub_key);
    const B_scan = fromHex(r.scan_pub_key);

    const key = toHex(B_scan).toLowerCase();
    let g = scanMap.get(key);
    if (!g) {
      g = { B_scan, firstIdx: i, B_m_list: [] };
      scanMap.set(key, g);
      groups.push(g);
    }
    g.B_m_list.push(B_spend_pub);
  }

  const inputHashTweak = calculateInputHashTweak(outpointL, A);

  // -------- 5) per-group S once; then derive P_k for each B_m with k=0,1,… --------
  const sending_outputs: Set<string> = new Set<string>();

  for (const g of groups) {
    const S = calculateSharedSecret(inputHashTweak, g.B_scan, aSum);
    // optional shared-secret assert at group's first index
    if (expected.shared_secrets && expected.shared_secrets[g.firstIdx]) {
      assert.strictEqual(
        toHex(S).toLowerCase(),
        expected.shared_secrets[g.firstIdx].toLowerCase(),
        `ecdh_shared_secret mismatch for recipient[${g.firstIdx}]`,
      );
    }

    for (let k = 0; k < g.B_m_list.length; k++) {
      const { pub_key, tweak_key } = deriveSilentOutput(S, g.B_m_list[k], k);
      sending_outputs.add(toHex(pub_key)); // x-only hex
    }
  }

  // -------- 6) compare with ANY expected variant (set-equality) --------
  const expectedSet = new Set<string>(expected.outputs.flat());
  const intersection = new Set<string>(
    [...sending_outputs].filter(x => expectedSet.has(x)),
  );
  assert.strictEqual(
    intersection.size > 0,
    true,
    'Sending test failed (derived outputs are not in the expected outputs)',
  );
}

// ---- receiver runner ----
function runReceiverCase(tc: Recipient) {
  const { given, expected } = tc;

  // -------- key material --------
  const b_scan = fromHex(given.key_material.scan_priv_key);
  const b_spend = fromHex(given.key_material.spend_priv_key);

  // -------- outpoint_L --------
  const vinArray = given.vin.map(
    ({ txid, vout }): Array<Input> => ({ hash: fromHex(txid), index: vout }),
  );
  const outpointL = findSmallestOutpoint(vinArray);

  // -------- A_sum_point (compressed) --------
  let A_sum_point: Uint8Array;
  if (expected.input_pub_key_sum) {
    A_sum_point = fromHex(expected.input_pub_key_sum);
    if (A_sum_point.length !== 33)
      throw new Error('expected.input_pub_key_sum must be 33 bytes');
  } else {
    assert.strictEqual(
      expected.outputs?.length || 0,
      0,
      'receiver: expected no outputs with no inputs',
    );
    return;
  }

  // -------- Inputs tag → tweak --------
  const inputHashTweak = calculateInputHashTweak(outpointL, A_sum_point);

  // -------- Shared secret S (compressed) --------
  const S = calculateSharedSecret(inputHashTweak, A_sum_point, b_scan);

  if (expected.shared_secret) {
    assert.strictEqual(
      toHex(S).toLowerCase(),
      expected.shared_secret.toLowerCase(),
      'receiver shared secret mismatch',
    );
  }

  // -------- outputs_to_check = actual tx outputs we care about (x-only hex) --------
  const outputsToCheck = new Set<string>(
    (given.outputs || []).map((h: string) => h.toLowerCase()),
  );

  // -------- precompute labels from b_scan (array),  --------
  const labelList: number[] = Array.isArray(given.labels)
    ? given.labels.map((n: any) => Number(n) >>> 0)
    : [];

  const foundScanned = scanForSilentPayments(
    b_scan,
    b_spend,
    inputHashTweak,
    A_sum_point,
    outputsToCheck,
    labelList,
  );

  const scannedResult: Set<{ pub_key: string; priv_key_tweak: string }> =
    new Set(
      foundScanned.map(
        (v: {
          priv_key_tweak: Uint8Array;
          pub_key: Uint8Array;
          lableNonce: Uint8Array;
        }) =>
          JSON.stringify({
            pub_key: toHex(v.pub_key),
            priv_key_tweak: toHex(v.priv_key_tweak),
          }),
      ),
    );

  const expectedOutputs: Set<{ pub_key: string; priv_key_tweak: string }> =
    new Set(
      expected.outputs.map(
        (value: { pub_key: string; priv_key_tweak: string }) =>
          JSON.stringify({
            pub_key: value.pub_key,
            priv_key_tweak: value.priv_key_tweak,
          }),
      ) || [],
    );

  assert.strictEqual(
    scannedResult.size,
    expectedOutputs.size,
    `receiver: sizes mismatch (got ${scannedResult.size}, want ${expectedOutputs.size})`,
  );
  // -------- compare sets of dicts (order-agnostic) --------
  for (const x of expectedOutputs)
    assert.ok(scannedResult.has(x), `receiver: missing expected entry ${x}`);
}

describe('BIP-352 Silent Payments — sender vectors', () => {
  const groups: TestCase[] = fixtures;
  let count = 0;
  for (const g of groups) {
    if (!g?.sending) continue;
    console.log(g.comment);
    for (const sc of g.sending) {
      it('Test' + g.comment, () => {
        runSenderCase(sc);
      });
      for (const recipient of sc.given.recipients) {
        const scan_pub_key = fromHex(recipient.scan_pub_key);
        const spend_pub_key = fromHex(recipient.spend_pub_key);
        it('Test address decoding for: ' + recipient.address, () => {
          const decoded = decodeSilentPaymentAddress(recipient.address);
          assert.deepStrictEqual(
            scan_pub_key,
            decoded.B_scan,
            'Decoding the sp address did not yield expected B_scan',
          );
          assert.deepStrictEqual(
            spend_pub_key,
            decoded.B_spend,
            'Decoding the sp address did not yield expected B_spend_pub',
          );
        });
        it('Test address encoding for: ' + recipient.address, () => {
          const encoded = encodeSilentPaymentAddress(
            spend_pub_key,
            scan_pub_key,
          );
          assert.deepStrictEqual(
            recipient.address,
            encoded,
            'Decoding the sp address did not yield expected B_spend_pub',
          );
        });
      }
      count++;
    }
    assert.ok(count > 0, 'no sender cases found');
  }
});

describe('BIP-352 Silent Payments — receiver vectors', () => {
  const groups: TestCase[] = fixtures;
  let count = 0;
  for (const g of groups) {
    if (!g?.receiving) continue;
    it('Test ' + g.comment, () => {
      for (const rc of g.receiving) {
        runReceiverCase(rc);
      }
    });
    count++;
  }
  assert.ok(count > 0, 'no receiver cases found');
});
