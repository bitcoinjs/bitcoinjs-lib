import * as assert from 'assert';
import BIP32Factory, { BIP32Interface } from 'bip32';
import * as bip39 from 'bip39';
import * as ecc from 'tiny-secp256k1';
import { describe, it } from 'mocha';
import { PsbtInput, TapLeaf, TapLeafScript } from 'bip174';
import { regtestUtils } from './_regtest.js';
import * as bitcoin from 'bitcoinjs-lib';
import { Taptree } from 'bitcoinjs-lib/src/types';
import {
  LEAF_VERSION_TAPSCRIPT,
  tapleafHash,
} from 'bitcoinjs-lib/src/payments/bip341';
import {
  toXOnly,
  tapTreeToList,
  tapTreeFromList,
} from 'bitcoinjs-lib/src/psbt/bip371';
import { witnessStackToScriptWitness } from 'bitcoinjs-lib/src/psbt/psbtutils';
import * as tools from 'uint8array-tools';
import { sha256 } from '@noble/hashes/sha256';
import { randomBytes } from 'crypto';

const regtest = regtestUtils.network;
bitcoin.initEccLib(ecc);
const bip32 = BIP32Factory(ecc);
const rng = (size: number) => randomBytes(size);

describe('bitcoinjs-lib (transaction with taproot)', () => {
  it('can verify the BIP86 HD wallet vectors for taproot single sig (& sending example)', async () => {
    // Values taken from BIP86 document
    const mnemonic =
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
    const xprv =
      'xprv9s21ZrQH143K3GJpoapnV8SFfukcVBSfeCficPSGfubmSFDxo1kuHnLisriDvSnRRuL2Qrg5ggqHKNVpxR86QEC8w35uxmGoggxtQTPvfUu';
    const path = `m/86'/0'/0'/0/0`; // Path to first child of receiving wallet on first account
    const internalPubkey = Buffer.from(
      'cc8a4bc64d897bddc5fbc2f670f7a8ba0b386779106cf1223c6fc5d7cd6fc115',
      'hex',
    );
    const expectedAddress =
      'bc1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqkedrcr';

    // Verify the above (Below is no different than other HD wallets)
    const seed = await bip39.mnemonicToSeed(mnemonic);
    const rootKey = bip32.fromSeed(seed);
    assert.strictEqual(rootKey.toBase58(), xprv);
    const childNode = rootKey.derivePath(path);
    // Since internalKey is an xOnly pubkey, we drop the DER header byte
    const childNodeXOnlyPubkey = toXOnly(childNode.publicKey);
    assert.deepEqual(childNodeXOnlyPubkey, internalPubkey);

    // This is new for taproot
    // Note: we are using mainnet here to get the correct address
    // The output is the same no matter what the network is.
    const { address, output } = bitcoin.payments.p2tr({
      internalPubkey,
    });
    assert.ok(!!output);
    assert.strictEqual(address, expectedAddress);
    // Used for signing, since the output and address are using a tweaked key
    // We must tweak the signer in the same way.
    const tweakedChildNode = childNode.tweak(
      bitcoin.crypto.taggedHash('TapTweak', childNodeXOnlyPubkey),
    );

    // amount from faucet
    const amount = 42e4;
    // amount to send
    const sendAmount = amount - 1e4;
    // Send some sats to the address via faucet. Get the hash and index. (txid/vout)
    const { txId: hash, vout: index } = await regtestUtils.faucetComplex(
      Buffer.from(output),
      amount,
    );
    // Sent 420000 sats to taproot address

    const psbt = new bitcoin.Psbt({ network: regtest })
      .addInput({
        hash,
        index,
        witnessUtxo: { value: BigInt(amount), script: output },
        tapInternalKey: childNodeXOnlyPubkey,
      })
      .addOutput({
        value: BigInt(sendAmount),
        address: regtestUtils.RANDOM_ADDRESS,
      })
      .signInput(0, tweakedChildNode)
      .finalizeAllInputs();

    const tx = psbt.extractTransaction();
    await regtestUtils.broadcast(tx.toHex());
    await regtestUtils.verify({
      txId: tx.getId(),
      address: regtestUtils.RANDOM_ADDRESS,
      vout: 0,
      value: sendAmount,
    });
  });

  it('can create (and broadcast via 3PBP) a taproot key-path spend Transaction', async () => {
    const internalKey = bip32.fromSeed(rng(64), regtest);
    const p2pkhKey = bip32.fromSeed(rng(64), regtest);

    const { output } = bitcoin.payments.p2tr({
      internalPubkey: toXOnly(internalKey.publicKey),
      network: regtest,
    });

    const { output: p2pkhOutput } = bitcoin.payments.p2pkh({
      pubkey: p2pkhKey.publicKey,
      network: regtest,
    });

    // amount from faucet
    const amount = 42e4;
    // amount to send
    const sendAmount = amount - 1e4;
    // get faucet
    const unspent = await regtestUtils.faucetComplex(
      Buffer.from(output!),
      amount,
    );

    // non segwit utxo
    const p2pkhUnspent = await regtestUtils.faucetComplex(
      Buffer.from(p2pkhOutput!),
      amount,
    );
    const utx = await regtestUtils.fetch(p2pkhUnspent.txId);
    const nonWitnessUtxo = Buffer.from(utx.txHex, 'hex');

    const psbt = new bitcoin.Psbt({ network: regtest });
    psbt.addInput({
      hash: unspent.txId,
      index: 0,
      witnessUtxo: { value: BigInt(amount), script: output! },
      tapInternalKey: toXOnly(internalKey.publicKey),
    });
    psbt.addInput({ index: 0, hash: p2pkhUnspent.txId, nonWitnessUtxo });

    const sendInternalKey = bip32.fromSeed(rng(64), regtest);
    const sendPubKey = toXOnly(sendInternalKey.publicKey);
    const { address: sendAddress } = bitcoin.payments.p2tr({
      internalPubkey: sendPubKey,
      network: regtest,
    });

    psbt.addOutput({
      value: BigInt(sendAmount),
      address: sendAddress!,
      tapInternalKey: sendPubKey,
    });

    const tweakedSigner = internalKey.tweak(
      bitcoin.crypto.taggedHash('TapTweak', toXOnly(internalKey.publicKey)),
    );
    await psbt.signInputAsync(0, tweakedSigner);
    await psbt.signInputAsync(1, p2pkhKey);

    psbt.finalizeAllInputs();
    const tx = psbt.extractTransaction();
    const rawTx = tx.toBuffer();

    const hex = tools.toHex(rawTx);

    await regtestUtils.broadcast(hex);
    await regtestUtils.verify({
      txId: tx.getId(),
      address: sendAddress!,
      vout: 0,
      value: sendAmount,
    });
  });

  it('can create (and broadcast via 3PBP) a taproot key-path spend Transaction (with unused scriptTree)', async () => {
    const internalKey = bip32.fromSeed(rng(64), regtest);
    const leafKey = bip32.fromSeed(rng(64), regtest);

    const leafScriptAsm = `${tools.toHex(
      toXOnly(leafKey.publicKey),
    )} OP_CHECKSIG`;
    const leafScript = bitcoin.script.fromASM(leafScriptAsm);

    const scriptTree = {
      output: leafScript,
    };

    const { output, address, hash } = bitcoin.payments.p2tr({
      internalPubkey: toXOnly(internalKey.publicKey),
      scriptTree,
      network: regtest,
    });

    // amount from faucet
    const amount = 42e4;
    // amount to send
    const sendAmount = amount - 1e4;
    // get faucet
    const unspent = await regtestUtils.faucetComplex(
      Buffer.from(output!),
      amount,
    );

    const psbt = new bitcoin.Psbt({ network: regtest });
    psbt.addInput({
      hash: unspent.txId,
      index: 0,
      witnessUtxo: { value: BigInt(amount), script: output! },
      tapInternalKey: toXOnly(internalKey.publicKey),
      tapMerkleRoot: hash,
    });
    psbt.addOutput({ value: BigInt(sendAmount), address: address! });

    const tweakedSigner = internalKey.tweak(
      bitcoin.crypto.taggedHash(
        'TapTweak',
        Buffer.concat([toXOnly(internalKey.publicKey), hash!]),
      ),
    );
    psbt.signInput(0, tweakedSigner);

    psbt.finalizeAllInputs();
    const tx = psbt.extractTransaction();
    const rawTx = tx.toBuffer();

    const hex = tools.toHex(rawTx);

    await regtestUtils.broadcast(hex);
    await regtestUtils.verify({
      txId: tx.getId(),
      address: address!,
      vout: 0,
      value: sendAmount,
    });
  });

  it('can create (and broadcast via 3PBP) a taproot script-path spend Transaction - OP_CHECKSIG', async () => {
    const internalKey = bip32.fromSeed(rng(64), regtest);
    const leafKey = bip32.fromSeed(rng(64), regtest);

    const leafScriptAsm = `${tools.toHex(
      toXOnly(leafKey.publicKey),
    )} OP_CHECKSIG`;
    const leafScript = bitcoin.script.fromASM(leafScriptAsm);

    const scriptTree: Taptree = [
      [
        {
          output: bitcoin.script.fromASM(
            '50929b74c1a04954b78b4b6035e97a5e078a5a0f28ec96d547bfee9ace803ac0 OP_CHECKSIG',
          ),
        },
        [
          {
            output: bitcoin.script.fromASM(
              '50929b74c1a04954b78b4b6035e97a5e078a5a0f28ec96d547bfee9ace803ac1 OP_CHECKSIG',
            ),
          },
          {
            output: bitcoin.script.fromASM(
              '2258b1c3160be0864a541854eec9164a572f094f7562628281a8073bb89173a7 OP_CHECKSIG',
            ),
          },
        ],
      ],
      [
        {
          output: bitcoin.script.fromASM(
            '50929b74c1a04954b78b4b6035e97a5e078a5a0f28ec96d547bfee9ace803ac2 OP_CHECKSIG',
          ),
        },
        [
          {
            output: bitcoin.script.fromASM(
              '50929b74c1a04954b78b4b6035e97a5e078a5a0f28ec96d547bfee9ace803ac3 OP_CHECKSIG',
            ),
          },
          [
            {
              output: bitcoin.script.fromASM(
                '50929b74c1a04954b78b4b6035e97a5e078a5a0f28ec96d547bfee9ace803ac4 OP_CHECKSIG',
              ),
            },
            {
              output: leafScript,
            },
          ],
        ],
      ],
    ];
    const redeem = {
      output: leafScript,
      redeemVersion: LEAF_VERSION_TAPSCRIPT,
    };

    const { output, witness } = bitcoin.payments.p2tr({
      internalPubkey: toXOnly(internalKey.publicKey),
      scriptTree,
      redeem,
      network: regtest,
    });

    // amount from faucet
    const amount = 42e4;
    // amount to send
    const sendAmount = amount - 1e4;
    // get faucet
    const unspent = await regtestUtils.faucetComplex(
      Buffer.from(output!),
      amount,
    );

    const psbt = new bitcoin.Psbt({ network: regtest });
    psbt.addInput({
      hash: unspent.txId,
      index: 0,
      witnessUtxo: { value: BigInt(amount), script: output! },
    });
    psbt.updateInput(0, {
      tapLeafScript: [
        {
          leafVersion: redeem.redeemVersion,
          script: redeem.output,
          controlBlock: witness![witness!.length - 1],
        },
      ],
    });

    const sendInternalKey = bip32.fromSeed(rng(64), regtest);
    const sendPubKey = toXOnly(sendInternalKey.publicKey);
    const { address: sendAddress } = bitcoin.payments.p2tr({
      internalPubkey: sendPubKey,
      scriptTree,
      network: regtest,
    });

    psbt.addOutput({
      value: BigInt(sendAmount),
      address: sendAddress!,
      tapInternalKey: sendPubKey,
      tapTree: { leaves: tapTreeToList(scriptTree) },
    });

    psbt.signInput(0, leafKey);
    psbt.finalizeInput(0);
    const tx = psbt.extractTransaction();
    const rawTx = tx.toBuffer();
    const hex = tools.toHex(rawTx);

    await regtestUtils.broadcast(hex);
    await regtestUtils.verify({
      txId: tx.getId(),
      address: sendAddress!,
      vout: 0,
      value: sendAmount,
    });
  });

  it('can create (and broadcast via 3PBP) a taproot script-path spend Transaction - OP_CHECKSEQUENCEVERIFY', async () => {
    const internalKey = bip32.fromSeed(rng(64), regtest);
    const leafKey = bip32.fromSeed(rng(64), regtest);
    const leafPubkey = tools.toHex(toXOnly(leafKey.publicKey));

    const leafScriptAsm = `OP_10 OP_CHECKSEQUENCEVERIFY OP_DROP ${leafPubkey} OP_CHECKSIG`;
    const leafScript = bitcoin.script.fromASM(leafScriptAsm);

    const scriptTree: Taptree = [
      {
        output: bitcoin.script.fromASM(
          '50929b74c1a04954b78b4b6035e97a5e078a5a0f28ec96d547bfee9ace803ac0 OP_CHECKSIG',
        ),
      },
      [
        {
          output: bitcoin.script.fromASM(
            '50929b74c1a04954b78b4b6035e97a5e078a5a0f28ec96d547bfee9ace803ac0 OP_CHECKSIG',
          ),
        },
        {
          output: leafScript,
        },
      ],
    ];
    const redeem = {
      output: leafScript,
      redeemVersion: LEAF_VERSION_TAPSCRIPT,
    };

    const { output, witness } = bitcoin.payments.p2tr({
      internalPubkey: toXOnly(internalKey.publicKey),
      scriptTree,
      redeem,
      network: regtest,
    });

    // amount from faucet
    const amount = 42e4;
    // amount to send
    const sendAmount = amount - 1e4;
    // get faucet
    const unspent = await regtestUtils.faucetComplex(
      Buffer.from(output!),
      amount,
    );

    const psbt = new bitcoin.Psbt({ network: regtest });
    psbt.addInput({
      hash: unspent.txId,
      index: 0,
      sequence: 10,
      witnessUtxo: { value: BigInt(amount), script: output! },
    });
    psbt.updateInput(0, {
      tapLeafScript: [
        {
          leafVersion: redeem.redeemVersion,
          script: redeem.output,
          controlBlock: witness![witness!.length - 1],
        },
      ],
    });

    const sendInternalKey = bip32.fromSeed(rng(64), regtest);
    const sendPubKey = toXOnly(sendInternalKey.publicKey);
    const { address: sendAddress } = bitcoin.payments.p2tr({
      internalPubkey: sendPubKey,
      scriptTree,
      network: regtest,
    });

    psbt.addOutput({ value: BigInt(sendAmount), address: sendAddress! });
    // just to test that updateOutput works as expected
    psbt.updateOutput(0, {
      tapInternalKey: sendPubKey,
      tapTree: { leaves: tapTreeToList(scriptTree) },
    });

    await psbt.signInputAsync(0, leafKey);

    psbt.finalizeInput(0);
    const tx = psbt.extractTransaction();
    const rawTx = tx.toBuffer();
    const hex = tools.toHex(rawTx);

    try {
      // broadcast before the confirmation period has expired
      await regtestUtils.broadcast(hex);
      throw new Error('Broadcast should fail.');
    } catch (err) {
      if ((err as any).message !== 'non-BIP68-final')
        throw new Error(
          'Expected OP_CHECKSEQUENCEVERIFY validation to fail. But it failed with: ' +
            err,
        );
    }
    await regtestUtils.mine(10);
    await regtestUtils.broadcast(hex);
    await regtestUtils.verify({
      txId: tx.getId(),
      address: sendAddress!,
      vout: 0,
      value: sendAmount,
    });
  });

  it('can create (and broadcast via 3PBP) a taproot script-path spend Transaction - OP_CHECKSIGADD (3-of-3)', async () => {
    const internalKey = bip32.fromSeed(rng(64), regtest);

    const leafKeys: BIP32Interface[] = [];
    const leafPubkeys: string[] = [];
    for (let i = 0; i < 3; i++) {
      const leafKey = bip32.fromSeed(rng(64), regtest);
      leafKeys.push(leafKey);
      leafPubkeys.push(tools.toHex(toXOnly(leafKey.publicKey)));
    }

    const leafScriptAsm = `${leafPubkeys[2]} OP_CHECKSIG ${leafPubkeys[1]} OP_CHECKSIGADD ${leafPubkeys[0]} OP_CHECKSIGADD OP_3 OP_NUMEQUAL`;

    const leafScript = bitcoin.script.fromASM(leafScriptAsm);

    const scriptTree: Taptree = [
      {
        output: bitcoin.script.fromASM(
          '50929b74c1a04954b78b4b6035e97a5e078a5a0f28ec96d547bfee9ace803ac0 OP_CHECKSIG',
        ),
      },
      [
        {
          output: bitcoin.script.fromASM(
            '50929b74c1a04954b78b4b6035e97a5e078a5a0f28ec96d547bfee9ace803ac0 OP_CHECKSIG',
          ),
        },
        {
          output: leafScript,
        },
      ],
    ];
    const redeem = {
      output: leafScript,
      redeemVersion: LEAF_VERSION_TAPSCRIPT,
    };

    const { output, address, witness } = bitcoin.payments.p2tr({
      internalPubkey: toXOnly(internalKey.publicKey),
      scriptTree,
      redeem,
      network: regtest,
    });

    // amount from faucet
    const amount = 42e4;
    // amount to send
    const sendAmount = amount - 1e4;
    // get faucet
    const unspent = await regtestUtils.faucetComplex(
      Buffer.from(output!),
      amount,
    );

    const psbt = new bitcoin.Psbt({ network: regtest });
    psbt.addInput({
      hash: unspent.txId,
      index: 0,
      witnessUtxo: { value: BigInt(amount), script: output! },
    });
    psbt.updateInput(0, {
      tapLeafScript: [
        {
          leafVersion: redeem.redeemVersion,
          script: redeem.output,
          controlBlock: witness![witness!.length - 1],
        },
      ],
    });

    psbt.addOutput({ value: BigInt(sendAmount), address: address! });

    // random order for signers
    psbt.signInput(0, leafKeys[1]);
    psbt.signInput(0, leafKeys[2]);
    psbt.signInput(0, leafKeys[0]);

    psbt.finalizeInput(0);
    const tx = psbt.extractTransaction();
    const rawTx = tx.toBuffer();
    const hex = tools.toHex(rawTx);

    await regtestUtils.broadcast(hex);
    await regtestUtils.verify({
      txId: tx.getId(),
      address: address!,
      vout: 0,
      value: sendAmount,
    });
  });

  it('can create (and broadcast via 3PBP) a taproot script-path spend Transaction - OP_CHECKSIGADD (2-of-3) and verify unspendable internalKey', async () => {
    const leafKeys: BIP32Interface[] = [];
    const leafPubkeys: Uint8Array[] = [];
    for (let i = 0; i < 3; i++) {
      const leafKey = bip32.fromSeed(rng(64), regtest);
      leafKeys.push(leafKey);
      leafPubkeys.push(toXOnly(leafKey.publicKey));
    }

    // The only thing that differs between the wallets is the private key.
    // So we will use the first wallet for all the Psbt stuff.
    const [wallet, wallet2, wallet3] = leafKeys.map(key =>
      new TaprootMultisigWallet(
        leafPubkeys,
        2, // Number of required signatures
        key.privateKey!,
        LEAF_VERSION_TAPSCRIPT,
      ).setNetwork(regtest),
    );

    // amount from faucet
    const amount = 42e4;
    // amount to send
    const sendAmount = amount - 1e4;
    // get faucet
    const unspent = await regtestUtils.faucetComplex(
      Buffer.from(wallet.output),
      amount,
    );

    const psbt = new bitcoin.Psbt({ network: regtest });

    // Adding an input is a bit special in this case,
    // So we contain it in the wallet class
    // Any wallet can do this, wallet2 or wallet3 could be used.
    wallet.addInput(psbt, unspent.txId, unspent.vout, BigInt(unspent.value));

    psbt.addOutput({ value: BigInt(sendAmount), address: wallet.address });

    // Sign with at least 2 of the 3 wallets.
    // Verify that there is a matching leaf script
    // (which includes the unspendable internalPubkey,
    // so we verify that no one can key-spend it)
    wallet3.verifyInputScript(psbt, 0);
    wallet2.verifyInputScript(psbt, 0);
    psbt.signInput(0, wallet3);
    psbt.signInput(0, wallet2);

    // Before finalizing, we need to add dummy signatures for all that did not sign.
    // Any wallet can do this, wallet2 or wallet3 could be used.
    wallet.addDummySigs(psbt);

    psbt.finalizeAllInputs();
    const tx = psbt.extractTransaction();
    const rawTx = tx.toBuffer();
    const hex = tools.toHex(rawTx);

    await regtestUtils.broadcast(hex);
    await regtestUtils.verify({
      txId: tx.getId(),
      // Any wallet can do this, wallet2 or wallet3 could be used.
      address: wallet.address,
      vout: 0,
      value: sendAmount,
    });
  });

  it('can create (and broadcast via 3PBP) a taproot script-path spend Transaction - custom finalizer', async () => {
    const leafCount = 8;
    const leaves = Array.from({ length: leafCount }).map(
      (_, index) =>
        ({
          depth: 3,
          leafVersion: LEAF_VERSION_TAPSCRIPT,
          script: bitcoin.script.fromASM(`OP_ADD OP_${index * 2} OP_EQUAL`),
        }) as TapLeaf,
    );
    const scriptTree = tapTreeFromList(leaves);

    for (let leafIndex = 1; leafIndex < leafCount; leafIndex++) {
      const redeem = {
        output: bitcoin.script.fromASM(`OP_ADD OP_${leafIndex * 2} OP_EQUAL`),
        redeemVersion: LEAF_VERSION_TAPSCRIPT,
      };

      const internalKey = bip32.fromSeed(rng(64), regtest);
      const { output, witness } = bitcoin.payments.p2tr({
        internalPubkey: toXOnly(internalKey.publicKey),
        scriptTree,
        redeem,
        network: regtest,
      });

      // amount from faucet
      const amount = 42e4;
      // amount to send
      const sendAmount = amount - 1e4;
      // get faucet
      const unspent = await regtestUtils.faucetComplex(
        Buffer.from(output!),
        amount,
      );

      const psbt = new bitcoin.Psbt({ network: regtest });
      psbt.addInput({
        hash: unspent.txId,
        index: 0,
        witnessUtxo: { value: BigInt(amount), script: output! },
      });

      const tapLeafScript: TapLeafScript = {
        leafVersion: redeem.redeemVersion,
        script: redeem.output,
        controlBlock: witness![witness!.length - 1],
      };
      psbt.updateInput(0, { tapLeafScript: [tapLeafScript] });

      const sendAddress =
        'bcrt1pqknex3jwpsaatu5e5dcjw70nac3fr5k5y3hcxr4hgg6rljzp59nqs6a0vh';
      psbt.addOutput({
        value: BigInt(sendAmount),
        address: sendAddress,
      });

      const leafIndexFinalizerFn = buildLeafIndexFinalizer(
        tapLeafScript,
        leafIndex,
      );
      psbt.finalizeInput(0, leafIndexFinalizerFn);
      const tx = psbt.extractTransaction();
      const rawTx = tx.toBuffer();
      const hex = tools.toHex(rawTx);

      await regtestUtils.broadcast(hex);
      await regtestUtils.verify({
        txId: tx.getId(),
        address: sendAddress!,
        vout: 0,
        value: sendAmount,
      });
    }
  });

  it('should fail validating invalid signatures for taproot (See issue #1931)', () => {
    const schnorrValidator = (
      pubkey: Uint8Array,
      msghash: Uint8Array,
      signature: Uint8Array,
    ) => {
      return ecc.verifySchnorr(msghash, pubkey, signature);
    };

    const psbtBase64 =
      `cHNidP8BAFICAAAAAe1h73A6zedruNERV6JU7Ty1IlYZh2KO1cBklZqCMEy8AAAAAAD/////ARA
      nAAAAAAAAFgAUS0GlfqWSeEWIpwPwrvRIjBbJQroAAAAAAAEA/TgBAQAAAAABAnGJ6st1FIvYLEV
      bJMQaZ3HSOJnkw5C+ViCuJYiFEYosAAAAAAD9////xuZd0xArNSaBuElLX3nzjwtZW95O7L/wbz9
      4v+v0vuYAAAAAAP3///8CECcAAAAAAAAiUSAVbMSHgwYVdyBgfNy0syr6TMaFOGhFjXJYuQcRLlp
      DS8hgBwAAAAAAIlEgthWGz3o2R7WpgjIK52ODoEaA/0HcImSUjVk6agZgghwBQIP9WWErMfeBBYy
      uHuSZS7MdXVICtlFgNveDrvuXeQGSZl1gGG6/r3Aw7h9TifGtoA+7JwYBjLMcEG6hbeyQGXIBQNS
      qKH1p/NFzO9bxe9vpvBZQIaX5Qa9SY2NfNCgSRNabmX5EiaihWcLC+ALgchm7DUfYrAmi1r4uSI/
      YaQ1lq8gAAAAAAQErECcAAAAAAAAiUSAVbMSHgwYVdyBgfNy0syr6TMaFOGhFjXJYuQcRLlpDSwE
      DBIMAAAABCEMBQZUpv6e1Hwfpi/PpglkkK/Rx40vZIIHwtJ7dXWFZ5TcZUEelCnfKOAWZ4xWjauY
      M2y+JcgFcVsuPzPuiM+z5AH+DARNBlSm/p7UfB+mL8+mCWSQr9HHjS9kggfC0nt1dYVnlNxlQR6U
      Kd8o4BZnjFaNq5gzbL4lyAVxWy4/M+6Iz7PkAf4MBFyC6ZCT2zZVrEbkw/T1fyS8eLKQaP2MH6rz
      dlMauGvQzLQAA`.replace(/\s+/g, '');

    const psbt = bitcoin.Psbt.fromBase64(psbtBase64);

    assert.ok(
      !psbt.validateSignaturesOfAllInputs(schnorrValidator),
      'Should fail validation',
    );
  });

  it('should succeed validating valid signatures for taproot (See issue #1934)', () => {
    const schnorrValidator = (
      pubkey: Uint8Array,
      msghash: Uint8Array,
      signature: Uint8Array,
    ) => {
      return ecc.verifySchnorr(msghash, pubkey, signature);
    };

    const psbtBase64 =
      `cHNidP8BAF4CAAAAAU6UzYPa7tES0HoS+obnRJuXX41Ob64Zs59qDEyKsu1ZAAAAAAD/////AYA
      zAjsAAAAAIlEgIlIzfR+flIWYTyewD9v+1N84IubZ/7qg6oHlYLzv1aYAAAAAAAEAXgEAAAAB8f+
      afEJBun7sRQLFE1Olc/gK9LBaduUpz3vB4fjXVF0AAAAAAP3///8BECcAAAAAAAAiUSAiUjN9H5+
      UhZhPJ7AP2/7U3zgi5tn/uqDqgeVgvO/VpgAAAAABASsQJwAAAAAAACJRICJSM30fn5SFmE8nsA/
      b/tTfOCLm2f+6oOqB5WC879WmAQMEgwAAAAETQWQwNOao3RMOBWPuAQ9Iph7Qzk47MvroTHbJR49
      MxKJmQ6hfhZa5wVVrdKYea5BW/loqa7al2pYYZMlGvdS06wODARcgjuYXxIpyOMVTYEvl35gDidC
      m/vUICZyuNNZKaPz9dxAAAQUgjuYXxIpyOMVTYEvl35gDidCm/vUICZyuNNZKaPz9dxAA`.replace(
        /\s+/g,
        '',
      );

    const psbt = bitcoin.Psbt.fromBase64(psbtBase64);

    assert.ok(
      psbt.validateSignaturesOfAllInputs(schnorrValidator),
      'Should succeed validation',
    );
  });
});

function buildLeafIndexFinalizer(
  tapLeafScript: TapLeafScript,
  leafIndex: number,
): (
  inputIndex: number,
  _input: PsbtInput,
  _tapLeafHashToFinalize?: Uint8Array,
) => {
  finalScriptWitness: Uint8Array | undefined;
} {
  return (
    inputIndex: number,
    _input: PsbtInput,
    _tapLeafHashToFinalize?: Uint8Array,
  ): {
    finalScriptWitness: Uint8Array | undefined;
  } => {
    try {
      const scriptSolution = [
        Uint8Array.from([leafIndex]),
        Uint8Array.from([leafIndex]),
      ];
      const witness = scriptSolution
        .concat(tapLeafScript.script)
        .concat(tapLeafScript.controlBlock);
      return { finalScriptWitness: witnessStackToScriptWitness(witness) };
    } catch (err) {
      throw new Error(`Can not finalize taproot input #${inputIndex}: ${err}`);
    }
  };
}

function makeUnspendableInternalKey(provableNonce?: Uint8Array): Uint8Array {
  // This is the generator point of secp256k1. Private key is known (equal to 1)
  const G = Buffer.from(
    '0479be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8',
    'hex',
  );
  // This is the hash of the uncompressed generator point.
  // It is also a valid X value on the curve, but we don't know what the private key is.
  // Since we know this X value (a fake "public key") is made from a hash of a well known value,
  // We can prove that the internalKey is unspendable.
  const Hx = sha256(G);

  // This "Nothing Up My Sleeve" value is mentioned in BIP341 so we verify it here:
  assert.strictEqual(
    tools.toHex(Hx),
    '50929b74c1a04954b78b4b6035e97a5e078a5a0f28ec96d547bfee9ace803ac0',
  );

  if (provableNonce) {
    if (provableNonce.length !== 32) {
      throw new Error(
        'provableNonce must be a 32 byte random value shared between script holders',
      );
    }
    // Using a shared random value, we create an unspendable internalKey
    // P = H + int(hash_taptweak(provableNonce))*G
    // Since we don't know H's private key (see explanation above), we can't know P's private key
    const tapHash = bitcoin.crypto.taggedHash('TapTweak', provableNonce);
    const ret = ecc.xOnlyPointAddTweak(Hx, tapHash);
    if (!ret) {
      throw new Error(
        'provableNonce produced an invalid key when tweaking the G hash',
      );
    }
    return Buffer.from(ret.xOnlyPubkey);
  } else {
    // The downside to using no shared provable nonce is that anyone viewing a spend
    // on the blockchain can KNOW that you CAN'T use key spend.
    // Most people would be ok with this being public, but some wallets (exchanges etc)
    // might not want ANY details about how their wallet works public.
    return Hx;
  }
}

class TaprootMultisigWallet {
  private leafScriptCache: Uint8Array | null = null;
  private internalPubkeyCache: Uint8Array | null = null;
  private paymentCache: bitcoin.Payment | null = null;
  private readonly publicKeyCache: Uint8Array;
  network: bitcoin.Network;

  constructor(
    /**
     * A list of all the (x-only) pubkeys in the multisig
     */
    private readonly pubkeys: Uint8Array[],
    /**
     * The number of required signatures
     */
    private readonly requiredSigs: number,
    /**
     * The private key you hold.
     */
    private readonly privateKey: Uint8Array,
    /**
     * leaf version (0xc0 currently)
     */
    readonly leafVersion: number,
    /**
     * Optional shared nonce. This should be used in wallets where
     * the fact that key-spend is unspendable should not be public,
     * BUT each signer must verify that it is unspendable to be safe.
     */
    private readonly sharedNonce?: Uint8Array,
  ) {
    this.network = bitcoin.networks.bitcoin;
    assert.ok(pubkeys.length > 0, 'Need pubkeys');
    assert.ok(
      pubkeys.every(p => p.length === 32),
      'Pubkeys must be 32 bytes (x-only)',
    );
    assert.ok(
      requiredSigs > 0 && requiredSigs <= pubkeys.length,
      'Invalid requiredSigs',
    );

    assert.ok(
      leafVersion <= 0xff && (leafVersion & 1) === 0,
      'Invalid leafVersion',
    );

    if (sharedNonce) {
      assert.ok(
        sharedNonce.length === 32 && ecc.isPrivate(sharedNonce),
        'Invalid sharedNonce',
      );
    }

    const pubkey = ecc.pointFromScalar(privateKey);
    assert.ok(pubkey, 'Invalid pubkey');

    this.publicKeyCache = Buffer.from(pubkey);
    assert.ok(
      pubkeys.some(p => tools.compare(p, toXOnly(this.publicKeyCache))),
      'At least one pubkey must match your private key',
    );

    // IMPORTANT: Make sure the pubkeys are sorted (To prevent ordering issues between wallet signers)
    this.pubkeys.sort((a, b) => tools.compare(a, b));
  }

  setNetwork(network: bitcoin.Network): this {
    this.network = network;
    return this;
  }

  // Required for Signer interface.
  // Prevent setting by using a getter.
  get publicKey(): Uint8Array {
    return this.publicKeyCache;
  }

  /**
   * Lazily build the leafScript. A 2 of 3 would look like:
   * key1 OP_CHECKSIG key2 OP_CHECKSIGADD key3 OP_CHECKSIGADD OP_2 OP_GREATERTHANOREQUAL
   */
  get leafScript(): Uint8Array {
    if (this.leafScriptCache) {
      return this.leafScriptCache;
    }
    const ops: bitcoin.Stack = [];
    this.pubkeys.forEach(pubkey => {
      if (ops.length === 0) {
        ops.push(pubkey);
        ops.push(bitcoin.opcodes.OP_CHECKSIG);
      } else {
        ops.push(pubkey);
        ops.push(bitcoin.opcodes.OP_CHECKSIGADD);
      }
    });
    if (this.requiredSigs > 16) {
      ops.push(bitcoin.script.number.encode(this.requiredSigs));
    } else {
      ops.push(bitcoin.opcodes.OP_1 - 1 + this.requiredSigs);
    }
    ops.push(bitcoin.opcodes.OP_GREATERTHANOREQUAL);

    this.leafScriptCache = bitcoin.script.compile(ops);
    return this.leafScriptCache;
  }

  get internalPubkey(): Uint8Array {
    if (this.internalPubkeyCache) {
      return this.internalPubkeyCache;
    }
    // See the helper function for explanation
    this.internalPubkeyCache = makeUnspendableInternalKey(this.sharedNonce);
    return this.internalPubkeyCache;
  }

  get scriptTree(): Taptree {
    // If more complicated, maybe it should be cached.
    // (ie. if other scripts are created only to create the tree
    // and will only be stored in the tree.)
    return {
      output: this.leafScript,
    };
  }

  get redeem(): {
    output: Uint8Array;
    redeemVersion: number;
  } {
    return {
      output: this.leafScript,
      redeemVersion: this.leafVersion,
    };
  }

  private get payment(): bitcoin.Payment {
    if (this.paymentCache) {
      return this.paymentCache;
    }
    this.paymentCache = bitcoin.payments.p2tr({
      internalPubkey: this.internalPubkey,
      scriptTree: this.scriptTree,
      redeem: this.redeem,
      network: this.network,
    });
    return this.paymentCache;
  }

  get output(): Uint8Array {
    return this.payment.output!;
  }

  get address(): string {
    return this.payment.address!;
  }

  get controlBlock(): Uint8Array {
    const witness = this.payment.witness!;
    return witness[witness.length - 1];
  }

  verifyInputScript(psbt: bitcoin.Psbt, index: number) {
    if (index >= psbt.data.inputs.length)
      throw new Error('Invalid input index');
    const input = psbt.data.inputs[index];
    if (!input.tapLeafScript) throw new Error('Input has no tapLeafScripts');
    const hasMatch =
      input.tapLeafScript.length === 1 &&
      input.tapLeafScript[0].leafVersion === this.leafVersion &&
      tools.compare(input.tapLeafScript[0].script, this.leafScript) === 0 &&
      tools.compare(input.tapLeafScript[0].controlBlock, this.controlBlock) ===
        0;
    if (!hasMatch)
      throw new Error(
        'No matching leafScript, or extra leaf script. Refusing to sign.',
      );
  }

  addInput(
    psbt: bitcoin.Psbt,
    hash: string | Buffer,
    index: number,
    value: bigint,
  ) {
    psbt.addInput({
      hash,
      index,
      witnessUtxo: { value, script: this.output },
    });
    psbt.updateInput(psbt.inputCount - 1, {
      tapLeafScript: [
        {
          leafVersion: this.leafVersion,
          script: this.leafScript,
          controlBlock: this.controlBlock,
        },
      ],
    });
  }

  addDummySigs(psbt: bitcoin.Psbt) {
    const leafHash = tapleafHash({
      output: this.leafScript,
      version: this.leafVersion,
    });
    for (const input of psbt.data.inputs) {
      if (!input.tapScriptSig) continue;
      const signedPubkeys = input.tapScriptSig
        .filter(ts => tools.compare(ts.leafHash, leafHash) === 0)
        .map(ts => ts.pubkey);
      for (const pubkey of this.pubkeys) {
        if (signedPubkeys.some(sPub => tools.compare(sPub, pubkey) === 0))
          continue;
        // Before finalizing, every key that did not sign must have an empty signature
        // in place where their signature would be.
        // In order to do this currently we need to construct a dummy signature manually.
        input.tapScriptSig.push({
          // This can be reused for each dummy signature
          leafHash,
          // This is the pubkey that didn't sign
          pubkey,
          // This must be an empty Buffer.
          signature: Buffer.from([]),
        });
      }
    }
  }

  // required for Signer interface
  sign(hash: Uint8Array, _lowR?: boolean): Uint8Array {
    return ecc.sign(hash, this.privateKey);
  }

  // required for Signer interface
  signSchnorr(hash: Uint8Array): Uint8Array {
    return ecc.signSchnorr(hash, this.privateKey);
  }
}
