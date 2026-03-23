/**
 * PsbtV2 adapter tests — test/psbtv2.spec.ts in bitcoinjs-lib
 *
 * Reuses the same fixtures, helpers and key patterns as psbt.spec.ts to prove
 * API parity between Psbt (BIP-174) and PsbtV2 (BIP-370).
 */

import * as assert from 'assert';
import * as ecc from 'tiny-secp256k1';
import { describe, it, before } from 'mocha';
import ECPairFactory from 'ecpair';
import { toHex, concat } from 'uint8array-tools';
import {
  initEccLib,
  payments,
  script as bscript,
  Transaction,
  networks,
  Psbt,
} from '../src/esm/index.js';
import { serializeTaprootSignature, toXOnly } from '../src/esm/psbt/bip371.js';
import { OPS } from '../src/esm/ops.js';
import {
  findScriptPath,
  LEAF_VERSION_TAPSCRIPT,
  rootHashFromPath,
  tapleafHash,
  toHashTree,
  tweakKey,
} from '../src/esm/payments/bip341.js';
import { PsbtV2 } from '../src/esm/psbtv2.js';

const ECPair = ECPairFactory(ecc);

// ─── Helpers (mirrors psbt.spec.ts) ──────────────────────────────────────────

const validator = (
  pubkey: Uint8Array,
  msghash: Uint8Array,
  signature: Uint8Array,
): boolean => ECPair.fromPublicKey(pubkey).verify(msghash, signature);

const schnorrValidator = (
  pubkey: Uint8Array,
  msghash: Uint8Array,
  signature: Uint8Array,
): boolean => {
  return ecc.verifySchnorr(msghash, pubkey, signature);
};

const NETWORK = networks.regtest;

function makeKey() {
  return ECPair.makeRandom({ network: NETWORK });
}

function makeP2wpkh(pubkey: Uint8Array) {
  return payments.p2wpkh({ pubkey, network: NETWORK });
}

function buildPrevTx(outputScript: Uint8Array, value: bigint): Transaction {
  const tx = new Transaction();
  tx.addInput(new Uint8Array(32), 0);
  tx.addOutput(outputScript, value);
  return tx;
}

function makeP2trScript(xOnlyOutputKey: Uint8Array): Uint8Array {
  return concat([new Uint8Array([OPS.OP_1, 0x20]), xOnlyOutputKey]);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PsbtV2 adapter', () => {
  before(() => initEccLib(ecc));

  // ─── Construction ────────────────────────────────────────────────────────────

  describe('construction', () => {
    it('defaults to mainnet like Psbt', () => {
      assert.strictEqual(new PsbtV2().network.bech32, networks.bitcoin.bech32);
    });

    it('accepts network option like Psbt', () => {
      assert.strictEqual(new PsbtV2({ network: NETWORK }).network, NETWORK);
    });

    it('starts empty', () => {
      const psbt = new PsbtV2({ network: NETWORK });
      assert.strictEqual(psbt.inputCount, 0);
      assert.strictEqual(psbt.outputCount, 0);
    });
  });

  // ─── addInputExtended ────────────────────────────────────────────────────────

  describe('addInputExtended', () => {
    it('accepts same witnessUtxo fields as Psbt.addInput', () => {
      const alice = makeKey();
      const p2wpkh = makeP2wpkh(alice.publicKey);

      const inputData = {
        hash: new Uint8Array(32).fill(1),
        index: 0,
        witnessUtxo: { script: p2wpkh.output!, value: 100_000n },
      };

      const psbt0 = new Psbt({ network: NETWORK });
      psbt0.addInput(inputData);

      const psbt2 = new PsbtV2({ network: NETWORK });
      psbt2.addInputExtended(inputData);

      assert.strictEqual(psbt2.inputCount, psbt0.inputCount);
    });

    it('accepts hash as hex string like Psbt.addInput', () => {
      const psbt = new PsbtV2({ network: NETWORK });
      psbt.addInputExtended({
        hash: toHex(new Uint8Array(32).fill(3)),
        index: 0,
      });
      assert.strictEqual(psbt.inputCount, 1);
    });

    it('PSBTv2-only: requiredTimeLockTime', () => {
      const psbt = new PsbtV2({ network: NETWORK });
      assert.doesNotThrow(() =>
        psbt.addInputExtended({
          hash: new Uint8Array(32),
          index: 0,
          requiredTimeLockTime: 500_000_000,
        }),
      );
    });

    it('PSBTv2-only: requiredHeightLockTime', () => {
      const psbt = new PsbtV2({ network: NETWORK });
      assert.doesNotThrow(() =>
        psbt.addInputExtended({
          hash: new Uint8Array(32),
          index: 0,
          requiredHeightLockTime: 840_000,
        }),
      );
    });
  });

  // ─── addOutput ───────────────────────────────────────────────────────────────

  describe('addOutput', () => {
    it('accepts script + value like Psbt.addOutput', () => {
      const p2wpkh = makeP2wpkh(makeKey().publicKey);

      const psbt0 = new Psbt({ network: NETWORK });
      psbt0.addOutput({ script: p2wpkh.output!, value: 50_000n });

      const psbt2 = new PsbtV2({ network: NETWORK });
      psbt2.addOutput({ script: p2wpkh.output!, value: 50_000n });

      assert.strictEqual(psbt2.outputCount, psbt0.data.outputs.length);
    });

    it('accepts address + value like Psbt.addOutput', () => {
      const p2wpkh = makeP2wpkh(makeKey().publicKey);

      const psbt0 = new Psbt({ network: NETWORK });
      psbt0.addOutput({ address: p2wpkh.address!, value: 50_000n });

      const psbt2 = new PsbtV2({ network: NETWORK });
      psbt2.addOutput({ address: p2wpkh.address!, value: 50_000n });

      assert.strictEqual(psbt2.outputCount, psbt0.data.outputs.length);
    });

    it('returns incrementing output index', () => {
      const psbt = new PsbtV2({ network: NETWORK });
      const script = makeP2wpkh(makeKey().publicKey).output!;
      assert.strictEqual(psbt.addOutput({ script, value: 1000n }), 0);
      assert.strictEqual(psbt.addOutput({ script, value: 2000n }), 1);
    });

    it('throws on invalid address', () => {
      const psbt = new PsbtV2({ network: NETWORK });
      assert.throws(() =>
        psbt.addOutput({ address: 'not_valid', value: 1000n }),
      );
    });
  });

  // ─── P2WPKH: sign → validate → finalize → extract ───────────────────────────

  describe('P2WPKH full round-trip', () => {
    it('produces valid witness data matching Psbt behaviour', () => {
      const alice = makeKey();
      const bob = makeKey();
      const alicePay = makeP2wpkh(alice.publicKey);
      const bobPay = makeP2wpkh(bob.publicKey);
      const prevTx = buildPrevTx(alicePay.output!, 100_000n);

      const psbt = new PsbtV2({ network: NETWORK });
      psbt.addInputExtended({
        hash: prevTx.getHash(),
        index: 0,
        witnessUtxo: { script: alicePay.output!, value: 100_000n },
      });
      psbt.addOutput({ address: bobPay.address!, value: 90_000n });

      psbt.signInput(0, alice);
      assert.strictEqual(
        psbt.validateSignaturesOfInput(0, validator),
        true,
        'sig should validate',
      );

      psbt.finalizeAllInputs();
      const tx = psbt.toTransaction();

      assert.strictEqual(tx.ins.length, 1);
      assert.strictEqual(tx.outs.length, 1);
      assert.ok(tx.ins[0].witness.length > 0, 'witness should be populated');
    });

    it('validateSignaturesOfInput returns false for tampered sig', () => {
      const alice = makeKey();
      const alicePay = makeP2wpkh(alice.publicKey);
      const bobPay = makeP2wpkh(makeKey().publicKey);

      const psbt = new PsbtV2({ network: NETWORK });
      psbt.addInputExtended({
        hash: new Uint8Array(32).fill(1),
        index: 0,
        witnessUtxo: { script: alicePay.output!, value: 100_000n },
      });
      psbt.addOutput({ script: bobPay.output!, value: 90_000n });
      psbt.signInput(0, alice);

      // Tamper with signature
      const sigs = psbt.getPartialSigs(0);
      sigs[0].signature[10] ^= 0xff;

      assert.strictEqual(psbt.validateSignaturesOfInput(0, validator), false);
    });

    it('signInputAsync produces same result as signInput', async () => {
      const alice = makeKey();
      const alicePay = makeP2wpkh(alice.publicKey);
      const bobPay = makeP2wpkh(makeKey().publicKey);

      const asyncAlice = {
        publicKey: alice.publicKey,
        sign: async (hash: Uint8Array) => alice.sign(hash),
      };

      const psbt = new PsbtV2({ network: NETWORK });
      psbt.addInputExtended({
        hash: new Uint8Array(32).fill(1),
        index: 0,
        witnessUtxo: { script: alicePay.output!, value: 100_000n },
      });
      psbt.addOutput({ script: bobPay.output!, value: 90_000n });

      await psbt.signInputAsync(0, asyncAlice);
      assert.strictEqual(psbt.validateSignaturesOfInput(0, validator), true);
    });
  });

  // ─── P2TR key-path ───────────────────────────────────────────────────────────
  describe('P2TR script-path', () => {
    it('signs and validates script-path spend', () => {
      const internalKeyPair = makeKey();
      const internalKey = toXOnly(internalKeyPair.publicKey);

      const leafKey = makeKey();
      const leafXOnly = toXOnly(leafKey.publicKey);

      const leafScript = bscript.compile([leafXOnly, OPS.OP_CHECKSIG]);
      const scriptTree = { output: leafScript };

      const tree = toHashTree(scriptTree);
      const leafHash = tapleafHash({
        output: leafScript,
        version: LEAF_VERSION_TAPSCRIPT,
      });
      const path = findScriptPath(tree, leafHash);
      if (!path) throw new Error('Leaf not found in script tree');

      const merkleRoot = path.length
        ? rootHashFromPath(
            concat([
              new Uint8Array([LEAF_VERSION_TAPSCRIPT]),
              internalKey,
              ...path,
            ]),
            leafHash,
          )
        : leafHash;

      const tweaked = tweakKey(internalKey, merkleRoot);
      if (!tweaked) throw new Error('Failed to tweak taproot output key');

      const p2trScript = makeP2trScript(tweaked.x);

      const controlBlock = concat([
        new Uint8Array([LEAF_VERSION_TAPSCRIPT | tweaked.parity]),
        internalKey,
        ...path,
      ]);

      const dest = makeP2wpkh(makeKey().publicKey);

      const schnorrLeaf = {
        publicKey: leafKey.publicKey,
        sign: (hash: Uint8Array) => leafKey.sign(hash),
        signSchnorr: (hash: Uint8Array) =>
          ecc.signSchnorr(hash, leafKey.privateKey!),
      };

      const psbt = new PsbtV2({ network: NETWORK });
      psbt.addInputExtended({
        hash: new Uint8Array(32).fill(1),
        index: 0,
        witnessUtxo: { script: p2trScript, value: 100_000n },
        tapLeafScript: [
          {
            leafVersion: LEAF_VERSION_TAPSCRIPT,
            script: leafScript,
            controlBlock,
          },
        ],
      });
      psbt.addOutput({ script: dest.output!, value: 90_000n });

      psbt.signInput(0, schnorrLeaf);
      assert.strictEqual(
        psbt.validateSignaturesOfInput(0, schnorrValidator),
        true,
      );
    });
  });

  // ─── verifyNonWitnessUtxo ────────────────────────────────────────────────────

  describe('verifyNonWitnessUtxo', () => {
    it('returns true when txid matches', () => {
      const alice = makeKey();
      const alicePay = makeP2wpkh(alice.publicKey);
      const prevTx = buildPrevTx(alicePay.output!, 100_000n);

      const psbt = new PsbtV2({ network: NETWORK });
      psbt.addInputExtended({
        hash: prevTx.getHash(),
        index: 0,
        nonWitnessUtxo: prevTx.toBuffer() as Uint8Array,
      });

      assert.strictEqual(psbt.verifyNonWitnessUtxo(0), true);
    });

    it('returns false with wrong txid', () => {
      const alice = makeKey();
      const alicePay = makeP2wpkh(alice.publicKey);
      const prevTx = buildPrevTx(alicePay.output!, 100_000n);

      const psbt = new PsbtV2({ network: NETWORK });
      psbt.addInputExtended({
        hash: new Uint8Array(32).fill(0xff),
        index: 0,
        nonWitnessUtxo: prevTx.toBuffer() as Uint8Array,
      });

      assert.strictEqual(psbt.verifyNonWitnessUtxo(0), false);
    });

    it('returns false when no nonWitnessUtxo present', () => {
      const psbt = new PsbtV2({ network: NETWORK });
      psbt.addInputExtended({
        hash: new Uint8Array(32).fill(1),
        index: 0,
        witnessUtxo: {
          script: makeP2wpkh(makeKey().publicKey).output!,
          value: 100_000n,
        },
      });
      assert.strictEqual(psbt.verifyNonWitnessUtxo(0), false);
    });
  });

  // ─── toTransaction ───────────────────────────────────────────────────────────

  describe('toTransaction', () => {
    it('throws if not finalized', () => {
      const alice = makeKey();
      const alicePay = makeP2wpkh(alice.publicKey);
      const bobPay = makeP2wpkh(makeKey().publicKey);

      const psbt = new PsbtV2({ network: NETWORK });
      psbt.addInputExtended({
        hash: new Uint8Array(32).fill(1),
        index: 0,
        witnessUtxo: { script: alicePay.output!, value: 100_000n },
      });
      psbt.addOutput({ script: bobPay.output!, value: 90_000n });
      psbt.signInput(0, alice);
      // not finalized

      assert.throws(() => psbt.toTransaction(), /finalized/i);
    });

    it('throws when fee rate exceeds maximumFeeRate', () => {
      const alice = makeKey();
      const alicePay = makeP2wpkh(alice.publicKey);
      const bobPay = makeP2wpkh(makeKey().publicKey);

      const psbt = new PsbtV2({ network: NETWORK, maximumFeeRate: 1 });
      psbt.addInputExtended({
        hash: new Uint8Array(32).fill(1),
        index: 0,
        witnessUtxo: { script: alicePay.output!, value: 100_000n },
      });
      psbt.addOutput({ script: bobPay.output!, value: 1_000n }); // huge fee
      psbt.signInput(0, alice);
      psbt.finalizeAllInputs();

      assert.throws(() => psbt.toTransaction(), /fee rate/i);
    });

    it('skips fee check with disableFeeCheck=true', () => {
      const alice = makeKey();
      const alicePay = makeP2wpkh(alice.publicKey);
      const bobPay = makeP2wpkh(makeKey().publicKey);

      const psbt = new PsbtV2({ network: NETWORK, maximumFeeRate: 1 });
      psbt.addInputExtended({
        hash: new Uint8Array(32).fill(1),
        index: 0,
        witnessUtxo: { script: alicePay.output!, value: 100_000n },
      });
      psbt.addOutput({ script: bobPay.output!, value: 1_000n });
      psbt.signInput(0, alice);
      psbt.finalizeAllInputs();

      assert.doesNotThrow(() => psbt.toTransaction(true));
    });

    it('preserves version and locktime', () => {
      const alice = makeKey();
      const alicePay = makeP2wpkh(alice.publicKey);
      const bobPay = makeP2wpkh(makeKey().publicKey);

      const psbt = new PsbtV2({ network: NETWORK });
      psbt.txVersion = 1;
      psbt.fallbackLockTime = 500_000;
      psbt.addInputExtended({
        hash: new Uint8Array(32).fill(1),
        index: 0,
        witnessUtxo: { script: alicePay.output!, value: 100_000n },
      });
      psbt.addOutput({ script: bobPay.output!, value: 99_000n });
      psbt.signInput(0, alice);
      psbt.finalizeAllInputs();

      const tx = psbt.toTransaction();
      assert.strictEqual(tx.version, 1);
      assert.strictEqual(tx.locktime, 500_000);
    });
  });

  // ─── validateSignaturesOfInput — negative cases ─────────────────────────────

  describe('validateSignaturesOfInput — signature correctness', () => {
    function makePsbt() {
      const alice = makeKey();
      const bob = makeKey();
      const alicePay = makeP2wpkh(alice.publicKey);
      const bobPay = makeP2wpkh(bob.publicKey);
      const psbt = new PsbtV2({ network: NETWORK });
      psbt.addInputExtended({
        hash: new Uint8Array(32).fill(1),
        index: 0,
        witnessUtxo: { script: alicePay.output!, value: 100_000n },
      });
      psbt.addOutput({ script: bobPay.output!, value: 90_000n });
      return { psbt, alice, bob };
    }

    it('returns true for valid signature with correct key', () => {
      const { psbt, alice } = makePsbt();
      psbt.signInput(0, alice);
      assert.strictEqual(psbt.validateSignaturesOfInput(0, validator), true);
    });

    it('returns false for valid signature verified against wrong key', () => {
      const { psbt, alice, bob } = makePsbt();
      psbt.signInput(0, alice);
      // Manually inject the same signature but attributed to bob's pubkey
      const sigs = psbt.getPartialSigs(0);
      const aliceSig = sigs[0].signature;
      // Clear alice's sig and add same bytes attributed to bob
      psbt.addPartialSig(0, { pubkey: bob.publicKey, signature: aliceSig });
      // Validate only bob's sig — wrong key for this hash → false
      assert.strictEqual(
        psbt.validateSignaturesOfInput(0, validator, bob.publicKey),
        false,
      );
    });

    it('returns false for tampered (invalid) signature', () => {
      const { psbt, alice } = makePsbt();
      psbt.signInput(0, alice);
      const sigs = psbt.getPartialSigs(0);
      // Flip bytes deep in the signature body (after DER header)
      sigs[0].signature[10] ^= 0xff;
      assert.strictEqual(psbt.validateSignaturesOfInput(0, validator), false);
    });

    it('throws when validating with pubkey that has no matching sig', () => {
      const { psbt, alice, bob } = makePsbt();
      psbt.signInput(0, alice);
      assert.throws(
        () => psbt.validateSignaturesOfInput(0, validator, bob.publicKey),
        /No signatures/,
      );
    });

    it('returns false for tampered schnorr (tap key) sig', () => {
      const key = makeKey();
      const internalKey = toXOnly(key.publicKey);
      const p2trScript = concat([
        new Uint8Array([OPS.OP_1, 0x20]),
        internalKey,
      ]);

      const schnorrKey = {
        publicKey: key.publicKey,
        sign: (h: Uint8Array) => key.sign(h),
        signSchnorr: (h: Uint8Array) => ecc.signSchnorr(h, key.privateKey!),
      };

      const psbt = new PsbtV2({ network: NETWORK });
      psbt.addInputExtended({
        hash: new Uint8Array(32).fill(1),
        index: 0,
        witnessUtxo: { script: p2trScript, value: 100_000n },
        tapInternalKey: internalKey,
      });
      psbt.addOutput({ script: p2trScript, value: 90_000n });
      psbt.signInput(0, schnorrKey);

      // Overwrite with a clearly invalid 64-byte tap key sig
      const tamperedSig = new Uint8Array(64).fill(0xff);
      psbt.addTapKeySig(0, tamperedSig);

      assert.strictEqual(
        psbt.validateSignaturesOfInput(0, schnorrValidator),
        false,
      );
    });
  });

  // ─── validateSignaturesOfAllInputs ───────────────────────────────────────────

  describe('validateSignaturesOfAllInputs', () => {
    it('validates multiple inputs signed by different keys', () => {
      const alice = makeKey();
      const bob = makeKey();
      const dest = makeP2wpkh(makeKey().publicKey);

      const psbt = new PsbtV2({ network: NETWORK });
      psbt.addInputExtended({
        hash: new Uint8Array(32).fill(1),
        index: 0,
        witnessUtxo: {
          script: makeP2wpkh(alice.publicKey).output!,
          value: 100_000n,
        },
      });
      psbt.addInputExtended({
        hash: new Uint8Array(32).fill(2),
        index: 0,
        witnessUtxo: {
          script: makeP2wpkh(bob.publicKey).output!,
          value: 50_000n,
        },
      });
      psbt.addOutput({ script: dest.output!, value: 140_000n });

      psbt.signInput(0, alice);
      psbt.signInput(1, bob);

      assert.strictEqual(psbt.validateSignaturesOfAllInputs(validator), true);
    });

    it('throws when no inputs', () => {
      const psbt = new PsbtV2({ network: NETWORK });
      assert.throws(() => psbt.validateSignaturesOfAllInputs(validator));
    });
  });

  // ─── External signer support ────────────────────────────────────────────────

  describe('getInputHashForSig', () => {
    it('returns hash and sighashType for non-taproot input', () => {
      const alice = makeKey();
      const alicePay = makeP2wpkh(alice.publicKey);
      const bobPay = makeP2wpkh(makeKey().publicKey);

      const psbt = new PsbtV2({ network: NETWORK });
      psbt.addInputExtended({
        hash: new Uint8Array(32).fill(1),
        index: 0,
        witnessUtxo: { script: alicePay.output!, value: 100_000n },
      });
      psbt.addOutput({ script: bobPay.output!, value: 90_000n });

      const { hash, sighashType } = psbt.getInputHashForSig(0);
      assert.strictEqual(hash.length, 32);
      assert.strictEqual(sighashType, Transaction.SIGHASH_ALL);
    });

    it('full external sign round-trip: getInputHashForSig → addPartialSig → toHex → fromHex → validate', () => {
      const alice = makeKey();
      const alicePay = makeP2wpkh(alice.publicKey);
      const bobPay = makeP2wpkh(makeKey().publicKey);

      const psbt = new PsbtV2({ network: NETWORK });
      psbt.addInputExtended({
        hash: new Uint8Array(32).fill(1),
        index: 0,
        witnessUtxo: { script: alicePay.output!, value: 100_000n },
      });
      psbt.addOutput({ script: bobPay.output!, value: 90_000n });

      // Serialize unsigned PSBT — pass to external signer
      const unsignedHex = psbt.toHex();

      // External signer: deserialize, get hash, sign, inject, re-serialize
      const signerPsbt = PsbtV2.fromHex(unsignedHex);
      const { hash, sighashType } = signerPsbt.getInputHashForSig(0);
      const sig = alice.sign(hash);
      signerPsbt.addPartialSig(0, {
        pubkey: alice.publicKey,
        signature: bscript.signature.encode(sig, sighashType),
      });
      const signedHex = signerPsbt.toHex();

      // Finalizer: deserialize, validate, finalize, extract
      const finalizerPsbt = PsbtV2.fromHex(signedHex);
      assert.strictEqual(
        finalizerPsbt.validateSignaturesOfInput(0, validator),
        true,
      );
      finalizerPsbt.finalizeAllInputs();
      const tx = finalizerPsbt.toTransaction();
      assert.ok(tx.ins[0].witness.length > 0);
    });

    it('full external sign round-trip using bscript directly', () => {
      const alice = makeKey();
      const alicePay = makeP2wpkh(alice.publicKey);
      const bobPay = makeP2wpkh(makeKey().publicKey);

      const psbt = new PsbtV2({ network: NETWORK });
      psbt.addInputExtended({
        hash: new Uint8Array(32).fill(1),
        index: 0,
        witnessUtxo: { script: alicePay.output!, value: 100_000n },
      });
      psbt.addOutput({ script: bobPay.output!, value: 90_000n });

      const { hash, sighashType } = psbt.getInputHashForSig(0);
      const sig = alice.sign(hash);
      psbt.addPartialSig(0, {
        pubkey: alice.publicKey,
        signature: bscript.signature.encode(sig, sighashType),
      });

      assert.strictEqual(psbt.validateSignaturesOfInput(0, validator), true);
      psbt.finalizeAllInputs();
      const tx = psbt.toTransaction();
      assert.ok(tx.ins[0].witness.length > 0);
    });
  });

  describe('getTaprootHashesForSig', () => {
    it('returns hash for taproot key-path', () => {
      const key = makeKey();
      const internalKey = toXOnly(key.publicKey);
      const p2trScript = concat([
        new Uint8Array([OPS.OP_1, 0x20]),
        internalKey,
      ]);
      const dest = makeP2wpkh(makeKey().publicKey);

      const psbt = new PsbtV2({ network: NETWORK });
      psbt.addInputExtended({
        hash: new Uint8Array(32).fill(1),
        index: 0,
        witnessUtxo: { script: p2trScript, value: 100_000n },
        tapInternalKey: internalKey,
      });
      psbt.addOutput({ script: dest.output!, value: 90_000n });

      // Pass x-only pubkey — _getTaprootHashes compares toXOnly(pubkey) with script output key
      const hashes = psbt.getTaprootHashesForSig(0, internalKey);
      assert.strictEqual(hashes.length, 1);
      assert.strictEqual(hashes[0].hash.length, 32);
      assert.strictEqual(hashes[0].leafHash, undefined);
    });

    it('full external taproot key-path round-trip: getTaprootHashesForSig → addTapKeySig → toHex → fromHex → validate', () => {
      const key = makeKey();
      const internalKey = toXOnly(key.publicKey);
      const p2trScript = concat([
        new Uint8Array([OPS.OP_1, 0x20]),
        internalKey,
      ]);
      const dest = makeP2wpkh(makeKey().publicKey);

      const psbt = new PsbtV2({ network: NETWORK });
      psbt.addInputExtended({
        hash: new Uint8Array(32).fill(1),
        index: 0,
        witnessUtxo: { script: p2trScript, value: 100_000n },
        tapInternalKey: internalKey,
      });
      psbt.addOutput({ script: dest.output!, value: 90_000n });

      // Serialize unsigned PSBT — pass to external signer
      const unsignedHex = psbt.toHex();

      // External Schnorr signer
      const signerPsbt = PsbtV2.fromHex(unsignedHex);
      const [{ hash }] = signerPsbt.getTaprootHashesForSig(0, internalKey);
      const sig = ecc.signSchnorr(hash, key.privateKey!);
      signerPsbt.addTapKeySig(0, serializeTaprootSignature(sig));
      const signedHex = signerPsbt.toHex();

      // Validate and finalize
      const finalizerPsbt = PsbtV2.fromHex(signedHex);
      assert.strictEqual(
        finalizerPsbt.validateSignaturesOfInput(0, schnorrValidator),
        true,
      );
    });
  });

  // ─── serialize / deserialize round-trip ──────────────────────────────────────

  describe('serialize / deserialize round-trip', () => {
    it('preserves signatures', () => {
      const alice = makeKey();
      const alicePay = makeP2wpkh(alice.publicKey);
      const bobPay = makeP2wpkh(makeKey().publicKey);

      const psbt = new PsbtV2({ network: NETWORK });
      psbt.addInputExtended({
        hash: new Uint8Array(32).fill(1),
        index: 0,
        witnessUtxo: { script: alicePay.output!, value: 100_000n },
      });
      psbt.addOutput({ script: bobPay.output!, value: 90_000n });
      psbt.signInput(0, alice);

      const hex = psbt.toHex();
      const psbt2 = PsbtV2.fromHex(hex);

      assert.strictEqual(psbt2.validateSignaturesOfInput(0, validator), true);
    });

    it('PSBTv2 hex differs from PSBTv0 hex (different version in global map)', () => {
      const alicePay = makeP2wpkh(makeKey().publicKey);
      const bobPay = makeP2wpkh(makeKey().publicKey);
      const hash = new Uint8Array(32).fill(1);

      const psbt0 = new Psbt({ network: NETWORK });
      psbt0.addInput({
        hash,
        index: 0,
        witnessUtxo: { script: alicePay.output!, value: 100_000n },
      });
      psbt0.addOutput({ script: bobPay.output!, value: 90_000n });

      const psbt2 = new PsbtV2({ network: NETWORK });
      psbt2.addInputExtended({
        hash,
        index: 0,
        witnessUtxo: { script: alicePay.output!, value: 100_000n },
      });
      psbt2.addOutput({ script: bobPay.output!, value: 90_000n });

      assert.notStrictEqual(psbt2.toHex(), psbt0.toHex());
    });
  });
});
