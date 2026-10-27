import * as assert from 'assert';
import BIP32Factory from 'bip32';
import * as ecc from 'tiny-secp256k1';
import { describe, it } from 'mocha';
import * as bitcoin from 'bitcoinjs-lib';
import { Taptree } from 'bitcoinjs-lib/src/types';
import { LEAF_VERSION_TAPSCRIPT } from 'bitcoinjs-lib/src/payments/bip341';
import { toXOnly } from 'bitcoinjs-lib/src/psbt/bip371';
import * as tools from 'uint8array-tools';
import { randomBytes } from 'crypto';

bitcoin.initEccLib(ecc);
const bip32 = BIP32Factory(ecc);
const rng = (size: number) => randomBytes(size);
const regtest = bitcoin.networks.regtest;

describe('bitcoinjs-lib (Pay-to-Merkle-Root - BIP 360)', () => {
  it('can generate a P2MR mainnet address (bc1z prefix) from BIP360 test vector', () => {
    const scriptTree: Taptree = {
      output: bitcoin.script.fromASM(
        'b617298552a72ade070667e86ca63b8f5789a9fe8731ef91202a91c9f3459007 OP_CHECKSIG',
      ),
    };

    const { address, output, hash } = bitcoin.payments.p2mr({ scriptTree });

    assert.ok(address);
    assert.ok(address.startsWith('bc1z'));
    assert.strictEqual(
      address,
      'bc1zc5jhzjnlf8pg4mdmhfuvqpvnr2quyd9j7mye5uly6psg9twghu4ssr0v9k',
    );
    assert.ok(output);
    assert.strictEqual(output.length, 34);
    assert.strictEqual(output[0], bitcoin.opcodes.OP_2); // SegWit version 2
    assert.ok(hash);
    assert.strictEqual(
      tools.toHex(hash),
      'c525714a7f49c28aedbbba78c005931a81c234b2f6c99a73e4d06082adc8bf2b',
    );
  });

  it('can generate a P2MR regtest address (bcrt1z prefix)', () => {
    const leafKey = bip32.fromSeed(rng(64), regtest);
    const leafPubkey = toXOnly(leafKey.publicKey);

    const scriptTree: Taptree = {
      output: bitcoin.script.fromASM(`${tools.toHex(leafPubkey)} OP_CHECKSIG`),
    };

    const { address, output } = bitcoin.payments.p2mr({
      scriptTree,
      network: regtest,
    });

    assert.ok(address);
    assert.ok(address.startsWith('bcrt1z'));
    assert.ok(output);
    assert.strictEqual(output.length, 34);
    assert.strictEqual(output[0], bitcoin.opcodes.OP_2);
  });

  it('can roundtrip P2MR address ↔ output via bitcoin.address', () => {
    const { address } = bitcoin.payments.p2mr({
      scriptTree: {
        output: bitcoin.script.fromASM(
          'b617298552a72ade070667e86ca63b8f5789a9fe8731ef91202a91c9f3459007 OP_CHECKSIG',
        ),
      },
    });
    assert.ok(address);

    const outputScript = bitcoin.address.toOutputScript(address);
    const recoveredAddress = bitcoin.address.fromOutputScript(outputScript);
    assert.strictEqual(recoveredAddress, address);
  });

  it('can create and sign a P2MR single-leaf script-path spend (OP_CHECKSIG)', () => {
    const leafKey = bip32.fromSeed(rng(64), regtest);
    const leafPubkey = toXOnly(leafKey.publicKey);

    const leafScript = bitcoin.script.fromASM(
      `${tools.toHex(leafPubkey)} OP_CHECKSIG`,
    );

    const scriptTree: Taptree = { output: leafScript };
    const redeem = {
      output: leafScript,
      redeemVersion: LEAF_VERSION_TAPSCRIPT,
    };

    const { output, witness, address } = bitcoin.payments.p2mr({
      scriptTree,
      redeem,
      network: regtest,
    });

    assert.ok(output && witness && address);
    assert.strictEqual(witness.length, 2); // [script, controlBlock]

    const controlBlock = witness[witness.length - 1];
    // Single leaf: control block is just 1 byte (no Merkle path)
    assert.strictEqual(controlBlock.length, 1);
    assert.strictEqual(controlBlock[0] & 0xfe, LEAF_VERSION_TAPSCRIPT);
    assert.strictEqual(controlBlock[0] & 1, 1); // parity bit always 1 for P2MR

    // Build PSBT
    const amount = 42e4;
    const sendAmount = amount - 1e4;

    const psbt = new bitcoin.Psbt({ network: regtest });
    psbt.addInput({
      hash: Buffer.alloc(32, 1), // mock txid
      index: 0,
      witnessUtxo: { value: BigInt(amount), script: output },
    });
    psbt.updateInput(0, {
      tapLeafScript: [
        {
          leafVersion: redeem.redeemVersion,
          script: redeem.output,
          controlBlock,
        },
      ],
    });
    psbt.addOutput({ value: BigInt(sendAmount), address });

    // Sign → Finalize → Extract
    psbt.signInput(0, leafKey);
    psbt.finalizeInput(0);
    const tx = psbt.extractTransaction();

    // Verify witness: [schnorr_sig, script, controlBlock]
    const wit = tx.ins[0].witness;
    assert.strictEqual(wit.length, 3);
    assert.strictEqual(wit[0].length, 64); // Schnorr signature
    assert.ok(tools.compare(wit[1], leafScript) === 0);
    assert.ok(tools.compare(wit[2], controlBlock) === 0);
  });

  it('can create and sign a P2MR two-leaf tree, spending each leaf independently', () => {
    const keys = [
      bip32.fromSeed(rng(64), regtest),
      bip32.fromSeed(rng(64), regtest),
    ];
    const leafScripts = keys.map(k =>
      bitcoin.script.fromASM(
        `${tools.toHex(toXOnly(k.publicKey))} OP_CHECKSIG`,
      ),
    );

    const scriptTree: Taptree = [
      { output: leafScripts[0] },
      { output: leafScripts[1] },
    ];

    for (let i = 0; i < 2; i++) {
      const redeem = {
        output: leafScripts[i],
        redeemVersion: LEAF_VERSION_TAPSCRIPT,
      };

      const { output, witness, address } = bitcoin.payments.p2mr({
        scriptTree,
        redeem,
        network: regtest,
      });
      assert.ok(output && witness && address);

      const controlBlock = witness[witness.length - 1];
      // Two-leaf tree: controlByte(1) + sibling_hash(32) = 33 bytes
      assert.strictEqual(controlBlock.length, 33);

      const amount = 42e4;
      const sendAmount = amount - 1e4;

      const psbt = new bitcoin.Psbt({ network: regtest });
      psbt.addInput({
        hash: Buffer.alloc(32, i + 2),
        index: 0,
        witnessUtxo: { value: BigInt(amount), script: output },
      });
      psbt.updateInput(0, {
        tapLeafScript: [
          {
            leafVersion: redeem.redeemVersion,
            script: redeem.output,
            controlBlock,
          },
        ],
      });
      psbt.addOutput({ value: BigInt(sendAmount), address });

      // Correct key signs successfully
      psbt.signInput(0, keys[i]);
      psbt.finalizeInput(0);

      const tx = psbt.extractTransaction();
      const wit = tx.ins[0].witness;
      assert.strictEqual(wit.length, 3);
      assert.strictEqual(wit[0].length, 64);
      assert.ok(tools.compare(wit[1], leafScripts[i]) === 0);
      assert.ok(tools.compare(wit[2], controlBlock) === 0);

      // Wrong key should fail to sign
      const wrongKey = keys[(i + 1) % 2];
      const psbt2 = new bitcoin.Psbt({ network: regtest });
      psbt2.addInput({
        hash: Buffer.alloc(32, i + 2),
        index: 0,
        witnessUtxo: { value: BigInt(amount), script: output },
      });
      psbt2.updateInput(0, {
        tapLeafScript: [
          {
            leafVersion: redeem.redeemVersion,
            script: redeem.output,
            controlBlock,
          },
        ],
      });
      psbt2.addOutput({ value: BigInt(sendAmount), address });

      assert.throws(() => {
        psbt2.signInput(0, wrongKey);
      }, /Can not sign for input/);
    }
  });

  it('can create and sign a P2MR three-leaf tree (spend depth-2 leaf)', () => {
    const keys = [
      bip32.fromSeed(rng(64), regtest),
      bip32.fromSeed(rng(64), regtest),
      bip32.fromSeed(rng(64), regtest),
    ];
    const leafScripts = keys.map(k =>
      bitcoin.script.fromASM(
        `${tools.toHex(toXOnly(k.publicKey))} OP_CHECKSIG`,
      ),
    );

    // Tree structure: [leaf0, [leaf1, leaf2]]
    const scriptTree: Taptree = [
      { output: leafScripts[0] },
      [{ output: leafScripts[1] }, { output: leafScripts[2] }],
    ];

    // Spend leaf 2 (deepest right)
    const redeem = {
      output: leafScripts[2],
      redeemVersion: LEAF_VERSION_TAPSCRIPT,
    };

    const { output, witness, address } = bitcoin.payments.p2mr({
      scriptTree,
      redeem,
      network: regtest,
    });
    assert.ok(output && witness && address);

    const controlBlock = witness[witness.length - 1];
    // Depth-2 leaf: controlByte(1) + 2 * 32 = 65 bytes
    assert.strictEqual(controlBlock.length, 65);

    const amount = 42e4;
    const sendAmount = amount - 1e4;

    const psbt = new bitcoin.Psbt({ network: regtest });
    psbt.addInput({
      hash: Buffer.alloc(32, 5),
      index: 0,
      witnessUtxo: { value: BigInt(amount), script: output },
    });
    psbt.updateInput(0, {
      tapLeafScript: [
        {
          leafVersion: redeem.redeemVersion,
          script: redeem.output,
          controlBlock,
        },
      ],
    });
    psbt.addOutput({ value: BigInt(sendAmount), address });

    psbt.signInput(0, keys[2]);
    psbt.finalizeInput(0);

    const tx = psbt.extractTransaction();
    const wit = tx.ins[0].witness;
    assert.strictEqual(wit.length, 3);
    assert.strictEqual(wit[0].length, 64);
    assert.ok(tools.compare(wit[1], leafScripts[2]) === 0);
    assert.ok(tools.compare(wit[2], controlBlock) === 0);
  });

  it('can serialize and deserialize a P2MR PSBT', () => {
    const leafKey = bip32.fromSeed(rng(64), regtest);
    const leafPubkey = toXOnly(leafKey.publicKey);
    const leafScript = bitcoin.script.fromASM(
      `${tools.toHex(leafPubkey)} OP_CHECKSIG`,
    );

    const scriptTree: Taptree = { output: leafScript };
    const redeem = {
      output: leafScript,
      redeemVersion: LEAF_VERSION_TAPSCRIPT,
    };

    const { output, witness, address } = bitcoin.payments.p2mr({
      scriptTree,
      redeem,
      network: regtest,
    });
    assert.ok(output && witness && address);

    const controlBlock = witness[witness.length - 1];
    const amount = 42e4;
    const sendAmount = amount - 1e4;

    // Build and sign the PSBT
    const psbt = new bitcoin.Psbt({ network: regtest });
    psbt.addInput({
      hash: Buffer.alloc(32, 6),
      index: 0,
      witnessUtxo: { value: BigInt(amount), script: output },
    });
    psbt.updateInput(0, {
      tapLeafScript: [
        {
          leafVersion: redeem.redeemVersion,
          script: redeem.output,
          controlBlock,
        },
      ],
    });
    psbt.addOutput({ value: BigInt(sendAmount), address });

    psbt.signInput(0, leafKey);

    // Serialize → Deserialize roundtrip
    const psbtHex = psbt.toHex();
    const psbt2 = bitcoin.Psbt.fromHex(psbtHex, { network: regtest });

    // Finalize from the deserialized PSBT
    psbt2.finalizeInput(0);
    const tx = psbt2.extractTransaction();

    const wit = tx.ins[0].witness;
    assert.strictEqual(wit.length, 3);
    assert.strictEqual(wit[0].length, 64);
    assert.ok(tools.compare(wit[1], leafScript) === 0);
    assert.ok(tools.compare(wit[2], controlBlock) === 0);
  });

  it('rejects key-path spending for P2MR', () => {
    const leafKey = bip32.fromSeed(rng(64), regtest);
    const leafScript = bitcoin.script.fromASM(
      `${tools.toHex(toXOnly(leafKey.publicKey))} OP_CHECKSIG`,
    );

    const { output } = bitcoin.payments.p2mr({
      scriptTree: { output: leafScript },
      network: regtest,
    });
    assert.ok(output);

    // A single-element witness means key-path spend attempt → must fail
    assert.throws(() => {
      bitcoin.payments.p2mr({
        output,
        witness: [Buffer.alloc(64)],
        network: regtest,
      });
    }, /P2MR does not support key-path spending/);
  });

  it('P2MR has no internalPubkey (unlike P2TR)', () => {
    const leafKey = bip32.fromSeed(rng(64), regtest);
    const leafScript = bitcoin.script.fromASM(
      `${tools.toHex(toXOnly(leafKey.publicKey))} OP_CHECKSIG`,
    );

    const scriptTree: Taptree = { output: leafScript };

    const p2mr = bitcoin.payments.p2mr({ scriptTree, network: regtest });
    const p2tr = bitcoin.payments.p2tr({
      internalPubkey: toXOnly(leafKey.publicKey),
      scriptTree,
      network: regtest,
    });

    // P2MR has no internalPubkey / pubkey
    assert.strictEqual(p2mr.pubkey, undefined);
    // P2TR has a pubkey (tweaked output key)
    assert.ok(p2tr.pubkey);

    // Both have output and address, but they differ
    assert.ok(p2mr.output);
    assert.ok(p2tr.output);
    assert.ok(tools.compare(p2mr.output, p2tr.output!) !== 0);

    // P2MR address starts with bc1z (witness v2), P2TR with bc1p (witness v1)
    assert.ok(p2mr.address!.startsWith('bcrt1z'));
    assert.ok(p2tr.address!.startsWith('bcrt1p'));
  });
});
