import * as assert from 'assert';
import { describe, it } from 'mocha';
import * as baddress from '../src/address';
import * as bscript from '../src/script';
import * as fixtures from './fixtures/address.json';

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
          baddress.fromOutputScript(script);
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
      it('throws when ' + f.exception, () => {
        assert.throws(() => {
          baddress.toOutputScript(f.address, f.network as any);
        }, new RegExp(f.address + ' ' + f.exception));
      });
    });
  });
});
