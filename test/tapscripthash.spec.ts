import * as assert from 'assert';
import * as ecc from 'tiny-secp256k1';
import ECPairFactory from 'ecpair';
import { beforeEach, describe, it } from 'mocha';
import { randomBytes } from 'crypto';
import * as tools from 'uint8array-tools';

import {
  initEccLib,
  networks,
  payments,
  Psbt,
  script,
  generateTaprootScriptHashSignature,
  Transaction,
} from 'bitcoinjs-lib';
import {
  LEAF_VERSION_TAPSCRIPT,
  tapleafHash,
} from 'bitcoinjs-lib/src/payments/bip341';
import { toXOnly } from 'bitcoinjs-lib/src/psbt/bip371';
import type { Taptree } from 'bitcoinjs-lib/src/types';

const ECPair = ECPairFactory(ecc);
const rng = (size: number) => randomBytes(size);
const network = networks.regtest;
const AMOUNT = 42e4;

interface Fixture {
  internalPubkey: Uint8Array;
  leafScript: Uint8Array;
  otherLeafScript: Uint8Array;
  leafHash: Uint8Array;
  controlBlock: Uint8Array;
  output: Uint8Array;
}

function buildFixture(keyPair: { publicKey: Uint8Array }): Fixture {
  const internalPubkey = toXOnly(ECPair.makeRandom({ rng }).publicKey);
  const leafScript = script.fromASM(
    `${tools.toHex(toXOnly(keyPair.publicKey))} OP_CHECKSIG`,
  );
  // A sibling leaf, so the control block carries a real merkle path.
  const otherLeafScript = script.fromASM(
    `${tools.toHex(toXOnly(ECPair.makeRandom({ rng }).publicKey))} OP_CHECKSIG`,
  );
  const scriptTree: Taptree = [
    { output: leafScript, version: LEAF_VERSION_TAPSCRIPT },
    { output: otherLeafScript, version: LEAF_VERSION_TAPSCRIPT },
  ];

  const { output, witness } = payments.p2tr({
    internalPubkey,
    scriptTree,
    redeem: { output: leafScript, redeemVersion: LEAF_VERSION_TAPSCRIPT },
    network,
  });

  return {
    internalPubkey,
    leafScript,
    otherLeafScript,
    leafHash: tapleafHash({
      output: leafScript,
      version: LEAF_VERSION_TAPSCRIPT,
    }),
    controlBlock: witness![witness!.length - 1],
    output: output!,
  };
}

function buildPsbt(fixture: Fixture, inputs = 1): Psbt {
  const psbt = new Psbt({ network });
  for (let i = 0; i < inputs; i++) {
    psbt.addInput({
      hash: tools.toHex(new Uint8Array(32).fill(7 + i)),
      index: 0,
      witnessUtxo: { value: BigInt(AMOUNT), script: fixture.output },
    });
  }
  psbt.addOutput({
    value: BigInt(AMOUNT * inputs - 1e4),
    address: payments.p2tr({ internalPubkey: fixture.internalPubkey, network })
      .address!,
  });
  return psbt;
}

const validator = (
  pubkey: Uint8Array,
  msghash: Uint8Array,
  signature: Uint8Array,
): boolean => ecc.verifySchnorr(msghash, pubkey, signature);

/**
 * Recomputes the BIP341 script-path sighash straight from the unsigned
 * transaction and checks the signature against it, without relying on any of
 * the library's own signing plumbing.
 */
function verifyIndependently(
  psbt: Psbt,
  fixture: Fixture,
  leafHash: Uint8Array,
  pubkey: Uint8Array,
  signature: Uint8Array,
  sighashType: number = Transaction.SIGHASH_DEFAULT,
): boolean {
  const tx = Transaction.fromBuffer(psbt.data.globalMap.unsignedTx.toBuffer());
  const hash = tx.hashForWitnessV1(
    0,
    [fixture.output],
    [BigInt(AMOUNT)],
    sighashType,
    leafHash,
  );
  return ecc.verifySchnorr(hash, toXOnly(pubkey), signature.slice(0, 64));
}

/** Attaches a returned signature to a PSBT the way a caller would. */
function attach(
  psbt: Psbt,
  keyPair: { publicKey: Uint8Array },
  leafHash: Uint8Array,
  signature: Uint8Array,
): Psbt {
  return psbt.updateInput(0, {
    tapScriptSig: [
      {
        pubkey: toXOnly(keyPair.publicKey),
        signature,
        leafHash,
      },
    ],
  });
}

describe('generateTaprootScriptHashSignature', () => {
  // Other specs deliberately clear the ECC library, so re-arm it here.
  beforeEach(() => initEccLib(ecc));

  it('produces the same signature as signing with the full leaf script', () => {
    const keyPair = ECPair.makeRandom({ rng });
    const fixture = buildFixture(keyPair);

    const withScript = buildPsbt(fixture);
    withScript.updateInput(0, {
      tapLeafScript: [
        {
          leafVersion: LEAF_VERSION_TAPSCRIPT,
          script: fixture.leafScript,
          controlBlock: fixture.controlBlock,
        },
      ],
    });
    withScript.signInput(0, keyPair);

    const withHash = buildPsbt(fixture);
    const signature = generateTaprootScriptHashSignature(
      withHash,
      0,
      keyPair,
      fixture.leafHash,
    );

    assert.deepStrictEqual(
      signature,
      withScript.data.inputs[0].tapScriptSig![0].signature,
    );
  });

  it('returns the signature and leaves the psbt untouched', () => {
    const keyPair = ECPair.makeRandom({ rng });
    const fixture = buildFixture(keyPair);

    const psbt = buildPsbt(fixture);
    const before = psbt.toBase64();
    const signature = generateTaprootScriptHashSignature(
      psbt,
      0,
      keyPair,
      fixture.leafHash,
    );

    assert.ok(signature instanceof Uint8Array);
    // SIGHASH_DEFAULT: bare 64 byte schnorr signature, no trailing sighash byte.
    assert.strictEqual(signature.length, 64);
    assert.strictEqual(psbt.data.inputs[0].tapScriptSig, undefined);
    assert.strictEqual(psbt.toBase64(), before);
  });

  it('commits to every prevout, not just the one being signed', () => {
    const keyPair = ECPair.makeRandom({ rng });
    const fixture = buildFixture(keyPair);

    const twoIn = generateTaprootScriptHashSignature(
      buildPsbt(fixture, 2),
      0,
      keyPair,
      fixture.leafHash,
    );
    const oneIn = generateTaprootScriptHashSignature(
      buildPsbt(fixture, 1),
      0,
      keyPair,
      fixture.leafHash,
    );

    assert.notDeepStrictEqual(twoIn, oneIn);
  });

  it('signs a leaf whose script does not contain the signing pubkey', () => {
    const keyPair = ECPair.makeRandom({ rng });
    const fixture = buildFixture(keyPair);
    const strangerHash = tapleafHash({
      output: fixture.otherLeafScript,
      version: LEAF_VERSION_TAPSCRIPT,
    });

    const psbt = buildPsbt(fixture);
    const signature = generateTaprootScriptHashSignature(
      psbt,
      0,
      keyPair,
      strangerHash,
    );

    assert.ok(
      verifyIndependently(
        psbt,
        fixture,
        strangerHash,
        keyPair.publicKey,
        signature,
      ),
    );
  });

  it('can be attached to the psbt as a tapScriptSig and serialized', () => {
    const keyPair = ECPair.makeRandom({ rng });
    const fixture = buildFixture(keyPair);

    const psbt = buildPsbt(fixture);
    const signature = generateTaprootScriptHashSignature(
      psbt,
      0,
      keyPair,
      fixture.leafHash,
    );
    attach(psbt, keyPair, fixture.leafHash, signature);

    // tapScriptSig needs no script, so it round trips through the wire format.
    const reloaded = Psbt.fromBase64(psbt.toBase64(), { network });
    assert.deepStrictEqual(
      reloaded.data.inputs[0].tapScriptSig![0].signature,
      signature,
    );
    assert.deepStrictEqual(
      reloaded.data.inputs[0].tapScriptSig![0].leafHash,
      fixture.leafHash,
    );
  });

  it('can not be checked by validateSignaturesOfInput without the script', () => {
    // Documents a real limitation: validation derives its candidate hashes from
    // input.tapLeafScript, so with no script on the input there is nothing to
    // check against, even though tapScriptSig carries the leaf hash.
    const keyPair = ECPair.makeRandom({ rng });
    const fixture = buildFixture(keyPair);

    const psbt = buildPsbt(fixture);
    const signature = generateTaprootScriptHashSignature(
      psbt,
      0,
      keyPair,
      fixture.leafHash,
    );
    attach(psbt, keyPair, fixture.leafHash, signature);

    assert.throws(
      () => psbt.validateSignaturesOfInput(0, validator),
      /No signatures for this pubkey/,
    );

    // Supplying the script afterwards makes it verifiable again.
    psbt.updateInput(0, {
      tapLeafScript: [
        {
          leafVersion: LEAF_VERSION_TAPSCRIPT,
          script: fixture.leafScript,
          controlBlock: fixture.controlBlock,
        },
      ],
    });
    assert.ok(psbt.validateSignaturesOfInput(0, validator));
  });

  it('fails to finalize when only the hash was provided', () => {
    const keyPair = ECPair.makeRandom({ rng });
    const fixture = buildFixture(keyPair);

    const psbt = buildPsbt(fixture);
    const signature = generateTaprootScriptHashSignature(
      psbt,
      0,
      keyPair,
      fixture.leafHash,
    );
    attach(psbt, keyPair, fixture.leafHash, signature);
    // The signature is present; only the script is missing.
    assert.strictEqual(psbt.data.inputs[0].tapScriptSig!.length, 1);

    assert.throws(
      () => psbt.finalizeInput(0),
      /Signature for tapleaf script not found/,
    );
    assert.throws(
      () => psbt.finalizeAllInputs(),
      /Signature for tapleaf script not found/,
    );
    assert.throws(
      () => psbt.finalizeTaprootInput(0),
      /Signature for tapleaf script not found/,
    );

    // A failed finalize must leave the input untouched and unextractable.
    assert.strictEqual(psbt.data.inputs[0].finalScriptWitness, undefined);
    assert.strictEqual(psbt.data.inputs[0].finalScriptSig, undefined);
    assert.throws(() => psbt.extractTransaction(), /Not finalized/);
  });

  it('finalizes once the script is supplied alongside the signature', () => {
    const keyPair = ECPair.makeRandom({ rng });
    const fixture = buildFixture(keyPair);

    const psbt = buildPsbt(fixture);
    const signature = generateTaprootScriptHashSignature(
      psbt,
      0,
      keyPair,
      fixture.leafHash,
    );
    attach(psbt, keyPair, fixture.leafHash, signature);
    psbt.updateInput(0, {
      tapLeafScript: [
        {
          leafVersion: LEAF_VERSION_TAPSCRIPT,
          script: fixture.leafScript,
          controlBlock: fixture.controlBlock,
        },
      ],
    });
    psbt.finalizeInput(0);

    const witness = psbt.data.inputs[0].finalScriptWitness!;
    assert.ok(witness);
    assert.ok(tools.toHex(witness).includes(tools.toHex(fixture.leafScript)));
  });

  it('honours a non-default sighash type', () => {
    const keyPair = ECPair.makeRandom({ rng });
    const fixture = buildFixture(keyPair);

    const psbt = buildPsbt(fixture);
    psbt.updateInput(0, { sighashType: Transaction.SIGHASH_ALL });

    assert.throws(
      () =>
        generateTaprootScriptHashSignature(psbt, 0, keyPair, fixture.leafHash),
      /Sighash type is not allowed/,
    );

    const signature = generateTaprootScriptHashSignature(
      psbt,
      0,
      keyPair,
      fixture.leafHash,
      [Transaction.SIGHASH_ALL],
    );
    // 64 byte schnorr signature plus the explicit sighash byte.
    assert.strictEqual(signature.length, 65);
    assert.strictEqual(signature[64], Transaction.SIGHASH_ALL);
    assert.ok(
      verifyIndependently(
        psbt,
        fixture,
        fixture.leafHash,
        keyPair.publicKey,
        signature,
        Transaction.SIGHASH_ALL,
      ),
    );
  });

  it('rejects bad arguments', () => {
    const keyPair = ECPair.makeRandom({ rng });
    const fixture = buildFixture(keyPair);
    const psbt = buildPsbt(fixture);

    assert.throws(
      () =>
        generateTaprootScriptHashSignature(
          psbt,
          0,
          keyPair,
          new Uint8Array(31),
        ),
      /Need a 32 byte tapleaf hash/,
    );
    assert.throws(
      () =>
        generateTaprootScriptHashSignature(psbt, 5, keyPair, fixture.leafHash),
      /No input #5/,
    );
    assert.throws(
      () =>
        generateTaprootScriptHashSignature(
          psbt,
          0,
          { publicKey: keyPair.publicKey, sign: () => new Uint8Array(64) },
          fixture.leafHash,
        ),
      /Need Schnorr Signer/,
    );
  });

  it('is also available as a Psbt method', () => {
    const keyPair = ECPair.makeRandom({ rng });
    const fixture = buildFixture(keyPair);

    const viaFn = buildPsbt(fixture);
    const viaMethod = buildPsbt(fixture);

    assert.deepStrictEqual(
      viaMethod.generateTaprootScriptHashSignature(
        0,
        keyPair,
        fixture.leafHash,
      ),
      generateTaprootScriptHashSignature(viaFn, 0, keyPair, fixture.leafHash),
    );
  });

  it('rejects a non-taproot input', () => {
    const keyPair = ECPair.makeRandom({ rng });
    const fixture = buildFixture(keyPair);
    const p2wpkh = payments.p2wpkh({
      pubkey: keyPair.publicKey,
      network,
    });

    const psbt = new Psbt({ network });
    psbt.addInput({
      hash: tools.toHex(new Uint8Array(32).fill(7)),
      index: 0,
      witnessUtxo: { value: BigInt(AMOUNT), script: p2wpkh.output! },
    });
    psbt.addOutput({
      value: BigInt(AMOUNT - 1e4),
      address: payments.p2tr({
        internalPubkey: fixture.internalPubkey,
        network,
      }).address!,
    });

    assert.throws(
      () =>
        generateTaprootScriptHashSignature(psbt, 0, keyPair, fixture.leafHash),
      /is not of type Taproot/,
    );
  });
});
