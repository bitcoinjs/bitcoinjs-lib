import * as assert from 'assert';
import { describe, it } from 'mocha';
import * as ecc from 'tiny-secp256k1';
import * as baddress from '../src/address';
import * as bscript from '../src/script';
import * as fixtures from './fixtures/address.json';

import { initEccLib } from '../src';

const NETWORKS = Object.assign(
  {
    litecoin: {
      messagePrefix: '\x19Litecoin Signed Message:\n',
      bip32: {
        public: 0x019da462,
        private: 0x019d9cfe,
      },
      pubKeyHash: 0x30,
      scriptHash: 0x32,
      wif: 0xb0,
    },
  },
  require('../src/networks'),
);

describe('address', () => {
  describe('fromBase58Check', () => {
    fixtures.standard.forEach(f => {
      if (!f.base58check) return;

      it('decodes ' + f.base58check, () => {
        const decode = baddress.fromBase58Check(f.base58check);

        assert.strictEqual(decode.version, f.version);
        assert.strictEqual(decode.hash.toString('hex'), f.hash);
      });
    });

    fixtures.invalid.fromBase58Check.forEach(f => {
      it('throws on ' + f.exception, () => {
        assert.throws(() => {
          baddress.fromBase58Check(f.address);
        }, new RegExp(f.address + ' ' + f.exception));
      });
    });
  });

  describe('fromBech32', () => {
    fixtures.standard.forEach(f => {
      if (!f.bech32) return;

      it('decodes ' + f.bech32, () => {
        const actual = baddress.fromBech32(f.bech32);

        assert.strictEqual(actual.version, f.version);
        assert.strictEqual(actual.prefix, NETWORKS[f.network].bech32);
        assert.strictEqual(actual.data.toString('hex'), f.data);
      });
    });

    fixtures.invalid.bech32.forEach(f => {
      it('decode fails for ' + f.address + '(' + f.exception + ')', () => {
        assert.throws(() => {
          baddress.fromBech32(f.address);
        }, new RegExp(f.exception));
      });
    });
  });

  describe('fromOutputScript', () => {
    initEccLib(ecc);
    fixtures.standard.forEach(f => {
      it('encodes ' + f.script.slice(0, 30) + '... (' + f.network + ')', () => {
        const script = bscript.fromASM(f.script);
        const address = baddress.fromOutputScript(script, NETWORKS[f.network]);

        assert.strictEqual(address, f.base58check || f.bech32!.toLowerCase());
      });
    });

    fixtures.invalid.fromOutputScript.forEach(f => {
      it('throws when ' + f.script.slice(0, 30) + '... ' + f.exception, () => {
        const script = bscript.fromASM(f.script);

        assert.throws(() => {
          baddress.fromOutputScript(script, undefined);
        }, new RegExp(f.exception));
      });
    });
  });

  describe('toBase58Check', () => {
    fixtures.standard.forEach(f => {
      if (!f.base58check) return;

      it('encodes ' + f.hash + ' (' + f.network + ')', () => {
        const address = baddress.toBase58Check(
          Buffer.from(f.hash, 'hex'),
          f.version,
        );

        assert.strictEqual(address, f.base58check);
      });
    });
  });

  describe('toBech32', () => {
    fixtures.bech32.forEach(f => {
      if (!f.address) return;
      const data = Buffer.from(f.data, 'hex');

      it('encode ' + f.address, () => {
        assert.deepStrictEqual(
          baddress.toBech32(data, f.version, f.prefix),
          f.address.toLowerCase(),
        );
      });
    });

    // TODO: These fixtures (according to TypeScript) have none of the data used below
    fixtures.invalid.bech32.forEach((f: any) => {
      if (!f.prefix || f.version === undefined || f.data === undefined) return;

      it('encode fails (' + f.exception, () => {
        assert.throws(() => {
          baddress.toBech32(Buffer.from(f.data, 'hex'), f.version, f.prefix);
        }, new RegExp(f.exception));
      });
    });
  });

  describe('toOutputScript', () => {
    fixtures.standard.forEach(f => {
      it('decodes ' + f.script.slice(0, 30) + '... (' + f.network + ')', () => {
        const script = baddress.toOutputScript(
          (f.base58check || f.bech32)!,
          NETWORKS[f.network],
        );

        assert.strictEqual(bscript.toASM(script), f.script);
      });
    });

    fixtures.invalid.toOutputScript.forEach(f => {
      it('throws when ' + (f.exception || f.paymentException), () => {
        const exception = f.paymentException || `${f.address} ${f.exception}`;
        assert.throws(() => {
          baddress.toOutputScript(f.address, f.network as any);
        }, new RegExp(exception));
      });
    });
  });

  describe('dustAmountFromOutputScript', () => {
    it('gets correct values', () => {
      const vectors = [
        // OP_RETURN is always 0 regardless of size
        [Buffer.from('6a04deadbeef', 'hex'), 1, 0],
        [Buffer.from('6a08deadbeefdeadbeef', 'hex'), 1, 0],
        // 3 byte non-segwit output is 3 + 1 + 8 + 148 = 160 * 3 = 480
        [Buffer.from('020102', 'hex'), 1, 480],
        // * 2 the feerate, * 2 the result
        [Buffer.from('020102', 'hex'), 2, 960],
        // P2PKH is 546 (well known)
        [
          Buffer.from(
            '76a914b6211d1f14f26ea4aed0e4a55e56e82656c7233d88ac',
            'hex',
          ),
          1,
          546,
        ],
        // P2WPKH is 294 (mentioned in Core comments)
        [
          Buffer.from('00145f72106b919817aa740fc655cce1a59f2d804e16', 'hex'),
          1,
          294,
        ],
        // P2TR (and P2WSH) is 330
        [
          Buffer.from(
            '51208215bbb39e58fc799515d72a76a29400c146f7044dcf44925877ed3219782963',
            'hex',
          ),
          1,
          330,
        ],
        // P2TR (and P2WSH) with OP_16 for some reason is still 330
        [
          Buffer.from(
            '60208215bbb39e58fc799515d72a76a29400c146f7044dcf44925877ed3219782963',
            'hex',
          ),
          1,
          330,
        ],
        // P2TR (and P2WSH) with 0x61 instead of OP number for some reason is now 573
        [
          Buffer.from(
            '61208215bbb39e58fc799515d72a76a29400c146f7044dcf44925877ed3219782963',
            'hex',
          ),
          1,
          573,
        ],
        // P2TR (and P2WSH) with 0x50 instead of OP 1-16 for some reason is now 573
        [
          Buffer.from(
            '50208215bbb39e58fc799515d72a76a29400c146f7044dcf44925877ed3219782963',
            'hex',
          ),
          1,
          573,
        ],
      ] as const;

      for (const [script, feeRatekvB, expected] of vectors) {
        assert.strictEqual(
          baddress.dustAmountFromOutputScript(script, feeRatekvB),
          expected,
        );
      }
    });
  });
});
