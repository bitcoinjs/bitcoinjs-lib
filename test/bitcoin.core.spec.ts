import * as assert from 'assert';
import base58 from 'bs58';
import { describe, it } from 'mocha';
import * as bitcoin from 'bitcoinjs-lib';
import base58EncodeDecode from './fixtures/core/base58_encode_decode.json';
import base58KeysInvalid from './fixtures/core/base58_keys_invalid.json';
import base58KeysValid from './fixtures/core/base58_keys_valid.json';
import blocksValid from './fixtures/core/blocks.json';
import sigCanonical from './fixtures/core/sig_canonical.json';
import sigNoncanonical from './fixtures/core/sig_noncanonical.json';
import sigHash from './fixtures/core/sighash.json';
import txValid from './fixtures/core/tx_valid.json';
import * as tools from 'uint8array-tools';

describe('Bitcoin-core', () => {
  // base58EncodeDecode
  describe('base58', () => {
    base58EncodeDecode.forEach(f => {
      const fhex = f[0];
      const fb58 = f[1];

      it('can decode ' + fb58, () => {
        const buffer = base58.decode(fb58);
        const actual = tools.toHex(buffer);

        assert.strictEqual(actual, fhex);
      });

      it('can encode ' + fhex, () => {
        const buffer = Buffer.from(fhex, 'hex');
        const actual = base58.encode(buffer);

        assert.strictEqual(actual, fb58);
      });
    });
  });

  // base58KeysValid
  describe('address.toBase58Check', () => {
    const typeMap: any = {
      pubkey: 'pubKeyHash',
      script: 'scriptHash',
    };

    base58KeysValid.forEach(f => {
      const expected = f[0];
      const hash = Buffer.from(f[1] as any, 'hex');
      const params = f[2] as any;

      if (params.isPrivkey) return;

      const network: any = params.isTestnet
        ? bitcoin.networks.testnet
        : bitcoin.networks.bitcoin;
      const version = network[typeMap[params.addrType]];

      it('can export ' + expected, () => {
        assert.strictEqual(
          bitcoin.address.toBase58Check(hash, version),
          expected,
        );
      });
    });
  });

  // base58KeysInvalid
  describe('address.fromBase58Check', () => {
    const allowedNetworks = [
      bitcoin.networks.bitcoin.pubKeyHash,
      bitcoin.networks.bitcoin.scriptHash,
      bitcoin.networks.testnet.pubKeyHash,
      bitcoin.networks.testnet.scriptHash,
    ];

    base58KeysInvalid.forEach(f => {
      const strng = f[0];

      it('throws on ' + strng, () => {
        assert.throws(() => {
          const address = bitcoin.address.fromBase58Check(strng);

          assert.notStrictEqual(
            allowedNetworks.indexOf(address.version),
            -1,
            'Invalid network',
          );
        }, /(Invalid (checksum|network))|(too (short|long))/);
      });
    });
  });

  describe('Block.fromHex', () => {
    blocksValid.forEach(f => {
      it('can parse ' + f.id, () => {
        const block = bitcoin.Block.fromHex(f.hex);

        assert.strictEqual(block.getId(), f.id);
        assert.strictEqual(block.transactions!.length, f.transactions);
      });
    });
  });

  // txValid
  describe('Transaction.fromHex', () => {
    txValid.forEach(f => {
      // Objects that are only a single string are ignored
      if (f.length === 1) return;

      const inputs = f[0];
      const fhex = f[1];
      //      const verifyFlags = f[2] // TODO: do we need to test this?

      it('can decode ' + fhex, () => {
        const transaction = bitcoin.Transaction.fromHex(fhex as string);

        transaction.ins.forEach((txIn, i) => {
          const input = inputs[i];

          // reverse because test data is reversed
          const prevOutHash = Buffer.from(input[0] as string, 'hex').reverse();
          const prevOutIndex = input[1];

          assert.deepStrictEqual(Buffer.from(txIn.hash), prevOutHash);

          // we read UInt32, not Int32
          assert.strictEqual(txIn.index & 0xffffffff, prevOutIndex);
        });
      });
    });
  });

  // sighash
  describe('Transaction', () => {
    sigHash.forEach(f => {
      // Objects that are only a single string are ignored
      if (f.length === 1) return;

      const txHex = f[0] as string;
      const scriptHex = f[1] as string;
      const inIndex = f[2] as number;
      const hashType = f[3] as number;
      const expectedHash = f[4];

      const hashTypes: string[] = [];
      if ((hashType & 0x1f) === bitcoin.Transaction.SIGHASH_NONE)
        hashTypes.push('SIGHASH_NONE');
      else if ((hashType & 0x1f) === bitcoin.Transaction.SIGHASH_SINGLE)
        hashTypes.push('SIGHASH_SINGLE');
      else hashTypes.push('SIGHASH_ALL');
      if (hashType & bitcoin.Transaction.SIGHASH_ANYONECANPAY)
        hashTypes.push('SIGHASH_ANYONECANPAY');

      const hashTypeName = hashTypes.join(' | ');

      it(
        'should hash ' + txHex.slice(0, 40) + '... (' + hashTypeName + ')',
        () => {
          const transaction = bitcoin.Transaction.fromHex(txHex);
          assert.strictEqual(transaction.toHex(), txHex);

          const script = Buffer.from(scriptHex, 'hex');
          const scriptChunks = bitcoin.script.decompile(script);
          assert.strictEqual(
            tools.toHex(bitcoin.script.compile(scriptChunks!)),
            scriptHex,
          );

          const hash = transaction.hashForSignature(inIndex, script, hashType);

          // reverse because test data is reversed
          assert.strictEqual(
            tools.toHex(hash.reverse() as Buffer),
            expectedHash,
          );

          assert.doesNotThrow(() =>
            transaction.hashForWitnessV0(
              inIndex,
              script,
              BigInt(0),
              // convert to UInt32
              hashType < 0 ? 0x100000000 + hashType : hashType,
            ),
          );
        },
      );
    });
  });

  describe('script.signature.decode', () => {
    sigCanonical.forEach(hex => {
      const buffer = Buffer.from(hex, 'hex');

      it('can parse ' + hex, () => {
        const parsed = bitcoin.script.signature.decode(buffer);
        const actual = bitcoin.script.signature.encode(
          parsed.signature,
          parsed.hashType,
        );

        assert.strictEqual(tools.toHex(actual), hex);
      });
    });

    sigNoncanonical.forEach((hex, i) => {
      if (i === 0) return;
      if (i % 2 !== 0) return;

      const description = sigNoncanonical[i - 1].slice(0, -1);
      const buffer = Buffer.from(hex, 'hex');

      it('throws on ' + description, () => {
        const reg = new RegExp(
          'Expected DER (integer|sequence)|(R|S) value (excessively ' +
            'padded|is negative)|(R|S|DER sequence) length is (zero|too ' +
            'short|too long|invalid)|Invalid hashType',
        );
        assert.throws(() => {
          bitcoin.script.signature.decode(buffer);
        }, reg);
      });
    });
  });
});
