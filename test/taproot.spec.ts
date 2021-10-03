import * as assert from 'assert';
import { ECPair } from '..';
import * as taproot from '../src/taproot';

describe('taproot utils', () => {
  describe('musig key aggregation', () => {
    // Expected values for the test cases assertions below are derived from the
    // MuSig2 implementation example code in secp256k1-zkp.
    // https://github.com/jonasnick/secp256k1-zkp/blob/musig2/src/modules/musig/example.c

    it('aggregates 2 pubkeys', () => {
      const aggregatePubkey = taproot.aggregateMuSigPubkeys([
        Buffer.from(
          '02b2eea3c2431bdda9003b30e385f6a59a74fddb39f4aa927f95ad7a6c147c9f6c',
          'hex',
        ),
        Buffer.from(
          '02d37c98a14d3a749e45a15bcc6836552a7458632f5bc46dca197011e031d6014f',
          'hex',
        ),
      ]);

      assert.strictEqual(
        taproot.trimFirstByte(aggregatePubkey).toString('hex'),
        '0ae195f849375eb836fa9f11dd8a44643f424e2671df6e63a2ad9becb853a9fe',
      );
    });

    it('aggregates 3 unsorted pubkeys', () => {
      const aggregatePubkey = taproot.aggregateMuSigPubkeys([
        Buffer.from(
          '02c03b14ebd188344d78ed45a0e4857fc65c7e25f50e0c0d84938220ef37da63d6',
          'hex',
        ),
        Buffer.from(
          '028f3bb821cf276d78199fc26f5b7d912e30326a2d21f856ee1c653a896f4e5334',
          'hex',
        ),
        Buffer.from(
          '0295f6fd0d52f4be09a076a99b77e34dc005eec62bb7cec50ade968dd2f597fc52',
          'hex',
        ),
      ]);

      assert.strictEqual(
        taproot.trimFirstByte(aggregatePubkey).toString('hex'),
        '349740502d79dd7a1253235da3b203de6e7717f487a8d1807e683bdfe7bd17ec',
      );
    });

    it('throws an error if no keys are provided', () => {
      assert.throws(() => taproot.aggregateMuSigPubkeys([]));
    });

    it('throws an error if a single key is provided', () => {
      assert.throws(() =>
        taproot.aggregateMuSigPubkeys([ECPair.makeRandom().publicKey]),
      );
    });
  });

  describe('taptree construction', () => {
    // Expected values for test case assertions below are derived from code and
    // examples provided by the Bitcoin Optech taproot workshop exercises:
    // https://github.com/bitcoinops/taproot-workshop

    const internalPubkey = Buffer.from(
      '03af455f4989d122e9185f8c351dbaecd13adca3eef8a9d38ef8ffed6867e342e3',
      'hex',
    );

    it('serializes script size', () => {
      const u8 = Buffer.allocUnsafe(0x01);
      const u16 = Buffer.allocUnsafe(0x0101);
      const u32 = Buffer.allocUnsafe(0x010101);

      const u8SerSize = taproot.serializeScriptSize(u8);
      const u16SerSize = taproot.serializeScriptSize(u16);
      const u32SerSize = taproot.serializeScriptSize(u32);

      assert.strictEqual(u8SerSize.toString('hex'), '01');
      assert.strictEqual(u16SerSize.toString('hex'), 'fd0101');
      assert.strictEqual(u32SerSize.toString('hex'), 'fe01010100');
    });

    it('hashes a tap leaf', () => {
      const pubkey = Buffer.from(
        '3627a049c3dd937b1ef01432a54f2e31642be754764f5a677c174576fb02571e',
        'hex',
      );

      const script = Buffer.concat([
        new Uint8Array([32]), // push 32 byte pub key
        pubkey,
        new Uint8Array([0xac]), // OP_CHECKSIG
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
});
