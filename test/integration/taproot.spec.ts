import BIP32Factory from 'bip32';
import ECPairFactory from 'ecpair';
import * as ecc from 'tiny-secp256k1';
import { describe, it } from 'mocha';
import { regtestUtils } from './_regtest';
import * as bitcoin from '../..';
import { Taptree } from '../../src/types';
import { buildTapscriptFinalizer, toXOnly } from '../psbt.utils';

const rng = require('randombytes');
const regtest = regtestUtils.network;
const bip32 = BIP32Factory(ecc);
const ECPair = ECPairFactory(ecc);

describe('bitcoinjs-lib (transaction with taproot)', () => {
  it('can create (and broadcast via 3PBP) a taproot keyspend Transaction', async () => {
    const myKey = bip32.fromSeed(rng(64), regtest);

    const output = createKeySpendOutput(myKey.publicKey);
    const address = bitcoin.address.fromOutputScript(output, regtest, ecc);
    // amount from faucet
    const amount = 42e4;
    // amount to send
    const sendAmount = amount - 1e4;
    // get faucet
    const unspent = await regtestUtils.faucetComplex(output, amount);

    const tx = createSigned(
      myKey,
      unspent.txId,
      unspent.vout,
      sendAmount,
      [output],
      [amount],
    );

    const hex = tx.toHex();
    // console.log('Valid tx sent from:');
    // console.log(address);
    // console.log('tx hex:');
    // console.log(hex);
    await regtestUtils.broadcast(hex);
    await regtestUtils.verify({
      txId: tx.getId(),
      address,
      vout: 0,
      value: sendAmount,
    });
  });

  it('can create (and broadcast via 3PBP) a taproot key-path spend Transaction', async () => {
    const internalKey = bip32.fromSeed(rng(64), regtest);

    const { output, address } = bitcoin.payments.p2tr(
      { internalPubkey: toXOnly(internalKey.publicKey), network: regtest },
      { eccLib: ecc },
    );

    // amount from faucet
    const amount = 42e4;
    // amount to send
    const sendAmount = amount - 1e4;
    // get faucet
    const unspent = await regtestUtils.faucetComplex(output!, amount);

    const psbt = new bitcoin.Psbt({ eccLib: ecc, network: regtest });
    psbt.addInput({
      hash: unspent.txId,
      index: 0,
      witnessUtxo: { value: amount, script: output! },
    });
    psbt.addOutput({ value: sendAmount, address: address! });

    const tweakedSigher = tweakSigner(internalKey!, { network: regtest });
    psbt.signInput(0, tweakedSigher);

    psbt.finalizeAllInputs();
    const tx = psbt.extractTransaction();
    const rawTx = tx.toBuffer();

    const hex = rawTx.toString('hex');

    await regtestUtils.broadcast(hex);
    await regtestUtils.verify({
      txId: tx.getId(),
      address: address!,
      vout: 0,
      value: sendAmount,
    });
  });

  it('can create (and broadcast via 3PBP) a taproot key-path spend Transaction (with unused scriptTree)', async () => {
    const internalKey = bip32.fromSeed(rng(64), regtest);
    const leafKey = bip32.fromSeed(rng(64), regtest);

    const leafScriptAsm = `${toXOnly(leafKey.publicKey).toString(
      'hex',
    )} OP_CHECKSIG`;
    const leafScript = bitcoin.script.fromASM(leafScriptAsm);

    const scriptTree = {
      output: leafScript,
    };

    const { output, address, hash } = bitcoin.payments.p2tr(
      {
        internalPubkey: toXOnly(internalKey.publicKey),
        scriptTree,
        network: regtest,
      },
      { eccLib: ecc },
    );

    // amount from faucet
    const amount = 42e4;
    // amount to send
    const sendAmount = amount - 1e4;
    // get faucet
    const unspent = await regtestUtils.faucetComplex(output!, amount);

    const psbt = new bitcoin.Psbt({ eccLib: ecc, network: regtest });
    psbt.addInput({
      hash: unspent.txId,
      index: 0,
      witnessUtxo: { value: amount, script: output! },
    });
    psbt.addOutput({ value: sendAmount, address: address! });

    const tweakedSigher = tweakSigner(internalKey!, {
      tweakHash: hash,
      network: regtest,
    });
    psbt.signInput(0, tweakedSigher);

    psbt.finalizeAllInputs();
    const tx = psbt.extractTransaction();
    const rawTx = tx.toBuffer();

    const hex = rawTx.toString('hex');

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

    const leafScriptAsm = `${toXOnly(leafKey.publicKey).toString(
      'hex',
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
      redeemVersion: 192,
    };

    const { output, address } = bitcoin.payments.p2tr(
      {
        internalPubkey: toXOnly(internalKey.publicKey),
        scriptTree,
        redeem,
        network: regtest,
      },
      { eccLib: ecc },
    );

    // amount from faucet
    const amount = 42e4;
    // amount to send
    const sendAmount = amount - 1e4;
    // get faucet
    const unspent = await regtestUtils.faucetComplex(output!, amount);

    const psbt = new bitcoin.Psbt({ eccLib: ecc, network: regtest });
    psbt.addInput({
      hash: unspent.txId,
      index: 0,
      witnessUtxo: { value: amount, script: output! },
      witnessScript: redeem.output,
    });
    psbt.addOutput({ value: sendAmount, address: address! });

    psbt.signInput(0, leafKey);

    const tapscriptFinalizer = buildTapscriptFinalizer(
      internalKey.publicKey,
      scriptTree,
      regtest,
    );
    psbt.finalizeInput(0, tapscriptFinalizer);
    const tx = psbt.extractTransaction();
    const rawTx = tx.toBuffer();
    const hex = rawTx.toString('hex');

    await regtestUtils.broadcast(hex);
    await regtestUtils.verify({
      txId: tx.getId(),
      address: address!,
      vout: 0,
      value: sendAmount,
    });
  });

  it('can create (and broadcast via 3PBP) a taproot script-path spend Transaction - OP_CHECKSEQUENCEVERIFY', async () => {
    const internalKey = bip32.fromSeed(rng(64), regtest);
    const leafKey = bip32.fromSeed(rng(64), regtest);
    const leafPubkey = toXOnly(leafKey.publicKey).toString('hex');

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
      redeemVersion: 192,
    };

    const { output, address } = bitcoin.payments.p2tr(
      {
        internalPubkey: toXOnly(internalKey.publicKey),
        scriptTree,
        redeem,
        network: regtest,
      },
      { eccLib: ecc },
    );

    // amount from faucet
    const amount = 42e4;
    // amount to send
    const sendAmount = amount - 1e4;
    // get faucet
    const unspent = await regtestUtils.faucetComplex(output!, amount);

    const psbt = new bitcoin.Psbt({ eccLib: ecc, network: regtest });
    psbt.addInput({
      hash: unspent.txId,
      index: 0,
      sequence: 10,
      witnessUtxo: { value: amount, script: output! },
      witnessScript: redeem.output,
    });
    psbt.addOutput({ value: sendAmount, address: address! });

    psbt.signInput(0, leafKey);

    const tapscriptFinalizer = buildTapscriptFinalizer(
      internalKey.publicKey,
      scriptTree,
      regtest,
    );
    psbt.finalizeInput(0, tapscriptFinalizer);
    const tx = psbt.extractTransaction();
    const rawTx = tx.toBuffer();
    const hex = rawTx.toString('hex');

    try {
      // broadcast before the confirmation period has expired
      await regtestUtils.broadcast(hex);
      throw new Error('Broadcast should fail.');
    } catch (err) {
      if ((err as any).message !== 'non-BIP68-final')
        throw new Error(
          'Expected OP_CHECKSEQUENCEVERIFY validation to fail. But it faild with: ' +
            err,
        );
    }
    await regtestUtils.mine(10);
    await regtestUtils.broadcast(hex);
    await regtestUtils.verify({
      txId: tx.getId(),
      address: address!,
      vout: 0,
      value: sendAmount,
    });
  });

  it('can create (and broadcast via 3PBP) a taproot script-path spend Transaction - OP_CHECKSIGADD (3-of-3)', async () => {
    const internalKey = bip32.fromSeed(rng(64), regtest);

    const leafKeys = [];
    const leafPubkeys = [];
    for (let i = 0; i < 3; i++) {
      const leafKey = bip32.fromSeed(rng(64), regtest);
      leafKeys.push(leafKey);
      leafPubkeys.push(toXOnly(leafKey.publicKey).toString('hex'));
    }

    const leafScriptAsm = `${leafPubkeys[2]} OP_CHECKSIG ${
      leafPubkeys[1]
    } OP_CHECKSIGADD ${leafPubkeys[0]} OP_CHECKSIGADD OP_3 OP_NUMEQUAL`;

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
      redeemVersion: 192,
    };

    const { output, address } = bitcoin.payments.p2tr(
      {
        internalPubkey: toXOnly(internalKey.publicKey),
        scriptTree,
        redeem,
        network: regtest,
      },
      { eccLib: ecc },
    );

    // amount from faucet
    const amount = 42e4;
    // amount to send
    const sendAmount = amount - 1e4;
    // get faucet
    const unspent = await regtestUtils.faucetComplex(output!, amount);

    const psbt = new bitcoin.Psbt({ eccLib: ecc, network: regtest });
    psbt.addInput({
      hash: unspent.txId,
      index: 0,
      witnessUtxo: { value: amount, script: output! },
      witnessScript: redeem.output,
    });
    psbt.addOutput({ value: sendAmount, address: address! });

    psbt.signInput(0, leafKeys[0]);
    psbt.signInput(0, leafKeys[1]);
    psbt.signInput(0, leafKeys[2]);

    const tapscriptFinalizer = buildTapscriptFinalizer(
      internalKey.publicKey,
      scriptTree,
      regtest,
    );
    psbt.finalizeInput(0, tapscriptFinalizer);
    const tx = psbt.extractTransaction();
    const rawTx = tx.toBuffer();
    const hex = rawTx.toString('hex');

    await regtestUtils.broadcast(hex);
    await regtestUtils.verify({
      txId: tx.getId(),
      address: address!,
      vout: 0,
      value: sendAmount,
    });
  });
});

// Order of the curve (N) - 1
const N_LESS_1 = Buffer.from(
  'fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364140',
  'hex',
);
// 1 represented as 32 bytes BE
const ONE = Buffer.from(
  '0000000000000000000000000000000000000000000000000000000000000001',
  'hex',
);

// Function for creating a tweaked p2tr key-spend only address
// (This is recommended by BIP341)
function createKeySpendOutput(publicKey: Buffer): Buffer {
  // x-only pubkey (remove 1 byte y parity)
  const myXOnlyPubkey = toXOnly(publicKey);
  const commitHash = bitcoin.crypto.taggedHash('TapTweak', myXOnlyPubkey);
  const tweakResult = ecc.xOnlyPointAddTweak(myXOnlyPubkey, commitHash);
  if (tweakResult === null) throw new Error('Invalid Tweak');
  const { xOnlyPubkey: tweaked } = tweakResult;
  // scriptPubkey
  return Buffer.concat([
    // witness v1, PUSH_DATA 32 bytes
    Buffer.from([0x51, 0x20]),
    // x-only tweaked pubkey
    tweaked,
  ]);
}

// Function for signing for a tweaked p2tr key-spend only address
// (Required for the above address)
interface KeyPair {
  publicKey: Buffer;
  privateKey?: Buffer;
}
function signTweaked(messageHash: Buffer, key: KeyPair): Uint8Array {
  const privateKey =
    key.publicKey[0] === 2
      ? key.privateKey
      : ecc.privateAdd(ecc.privateSub(N_LESS_1, key.privateKey!)!, ONE)!;
  const tweakHash = bitcoin.crypto.taggedHash(
    'TapTweak',
    toXOnly(key.publicKey),
  );
  const newPrivateKey = ecc.privateAdd(privateKey!, tweakHash);
  if (newPrivateKey === null) throw new Error('Invalid Tweak');
  return ecc.signSchnorr(messageHash, newPrivateKey, Buffer.alloc(32));
}

// Function for creating signed tx
function createSigned(
  key: KeyPair,
  txid: string,
  vout: number,
  amountToSend: number,
  scriptPubkeys: Buffer[],
  values: number[],
): bitcoin.Transaction {
  const tx = new bitcoin.Transaction();
  tx.version = 2;
  // Add input
  tx.addInput(Buffer.from(txid, 'hex').reverse(), vout);
  // Add output
  tx.addOutput(scriptPubkeys[0], amountToSend);
  const sighash = tx.hashForWitnessV1(
    0, // which input
    scriptPubkeys, // All previous outputs of all inputs
    values, // All previous values of all inputs
    bitcoin.Transaction.SIGHASH_DEFAULT, // sighash flag, DEFAULT is schnorr-only (DEFAULT == ALL)
  );
  const signature = Buffer.from(signTweaked(sighash, key));
  // witness stack for keypath spend is just the signature.
  // If sighash is not SIGHASH_DEFAULT (ALL) then you must add 1 byte with sighash value
  tx.ins[0].witness = [signature];
  return tx;
}

// This logic will be extracted to ecpair
function tweakSigner(signer: bitcoin.Signer, opts: any = {}): bitcoin.Signer {
  // @ts-ignore
  let privateKey: Uint8Array | undefined = signer.privateKey!;
  if (!privateKey) {
    throw new Error('Private key is required for tweaking signer!');
  }
  if (signer.publicKey[0] === 3) {
    privateKey = ecc.privateNegate(privateKey);
  }

  const tweakedPrivateKey = ecc.privateAdd(
    privateKey,
    tapTweakHash(toXOnly(signer.publicKey), opts.tweakHash),
  );
  if (!tweakedPrivateKey) {
    throw new Error('Invalid tweaked private key!');
  }

  return ECPair.fromPrivateKey(Buffer.from(tweakedPrivateKey), {
    network: opts.network,
  });
}

function tapTweakHash(pubKey: Buffer, h: Buffer | undefined): Buffer {
  return bitcoin.crypto.taggedHash(
    'TapTweak',
    Buffer.concat(h ? [pubKey, h] : [pubKey]),
  );
}
