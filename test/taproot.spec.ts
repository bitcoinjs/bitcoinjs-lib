import * as assert from 'assert';
import { describe, it } from 'mocha';
import * as bcrypto from '../src/crypto';
import * as taproot from '../src/taproot';
import { ECPair } from '..';
export const OPS = require('bitcoin-ops') as { [index: string]: number };

describe('taproot utils', () => {
  const internalPubkey = Buffer.from(
    '03af455f4989d122e9185f8c351dbaecd13adca3eef8a9d38ef8ffed6867e342e3',
    'hex',
  );

  it('aggregates pubkeys', () => {
    // example taken from bitcoinops taproot workshop musig exercise
    const key1 = ECPair.fromPrivateKey(bcrypto.sha256(Buffer.from('key0')));
    const key2 = ECPair.fromPrivateKey(bcrypto.sha256(Buffer.from('key1')));
    const key3 = ECPair.fromPrivateKey(bcrypto.sha256(Buffer.from('key2')));

    const aggregatePubkey = taproot.aggregateMuSigPubkeys([
      key1.publicKey,
      key2.publicKey,
      key3.publicKey,
    ]);

    assert.strictEqual(
      taproot.trimFirstByte(aggregatePubkey).toString('hex'),
      'eeeea7d79f3ecde08d2a3c59f40eb3adcac9defb77d3b92053e5df95165139cd',
    );
  });

  it('hashes a tap leaf', () => {
    const pubkey = Buffer.from(
      '3627a049c3dd937b1ef01432a54f2e31642be754764f5a677c174576fb02571e',
      'hex',
    );

    const script = Buffer.concat([
      new Uint8Array([32]), // push 32 byte pub key
      pubkey,
      new Uint8Array([OPS.OP_CHECKSIG]),
    ]);

    const tapLeafHash = taproot.hashTapLeaf(script);

    assert.strictEqual(
      tapLeafHash.toString('hex'),
      '17e20b19dc7e8093c4278d3bf42447a2334546f874ba1693c9d7bc4d81db15c4',
    );
  });

  it('hashes a tap branch', () => {
    const child1 = Buffer.from(
      'f248f2fee0977d141e19e0fddae1cfcdcede1a34a77ebc53c8fe96f346c7f7fc',
      'hex',
    );
    const child2 = Buffer.from(
      '72e4cc6e974cae355cf72476edeff8e9a2877ad67cfa4f12bad6f178c6918b9c',
      'hex',
    );

    const tapBranchHash = taproot.hashTapBranch(child1, child2);

    assert.strictEqual(
      tapBranchHash.toString('hex'),
      '3009565ab85ceb87d3dfdedc469ec205b2ea139a148af1dcbcc1addf8f1b68a4',
    );
  });

  it('taptweaks a pubkey', () => {
    const tapTreeRoot = Buffer.from(
      'dde870346c0f5f1f1c2341041520baa4e252723474c6969f432c2af98251ac01',
      'hex',
    );

    const taprootPubkey = taproot.tapTweakPubkey(internalPubkey, tapTreeRoot);

    assert.strictEqual(
      taprootPubkey.toString('hex'),
      '8634eebf6c81c7df86185eb16415674174dcdceb8e0a5f435eeb7941639fe7b9',
    );
  });

  it('builds a weighted taptree from scripts and tweaks a pubkey with it', () => {
    const scriptA = Buffer.from(
      '2052b319d011c12225b8f9c63349e7b0e78118a1cb7e406fc70e3e08862b49d10aac',
      'hex',
    );
    const scriptB = Buffer.from(
      '20622e61f750f10e597b18a3bb4e5dea88548508b8cb37bfc0fb7af20f7a417d6aac',
      'hex',
    );
    const scriptC = Buffer.from(
      '2092a7d17376802e183fc49fb93d4c9b0a4d1cf845c005debbcc9cd57550a6f617ac',
      'hex',
    );

    const tapTreeRoot = taproot.getHuffmanTaptreeRoot(
      [scriptA, scriptB, scriptC],
      [1, 1, 2],
    );

    const taprootPubkey = taproot.tapTweakPubkey(internalPubkey, tapTreeRoot);

    assert.strictEqual(
      taprootPubkey.toString('hex'),
      'd32c6fd13ddc1544528fd60e5c0d7a1ad0ea914fb0423b05bbb72cdc5e5dd220',
    );
  });
});
