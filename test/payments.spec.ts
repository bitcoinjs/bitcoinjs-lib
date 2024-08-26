import * as assert from 'assert';
import * as ecc from 'tiny-secp256k1';
import { describe, it, before, beforeEach } from 'mocha';
import { PaymentCreator } from '..';
import * as u from './payments.utils';
import { initEccLib } from '../src/esm/ecc_lib';
import { p2data } from '../src/esm/payments/embed.js';
import { p2ms } from '../src/esm/payments/p2ms.js';
import { p2pk } from '../src/esm/payments/p2pk.js';
import { p2pkh } from '../src/esm/payments/p2pkh.js';
import { p2sh } from '../src/esm/payments/p2sh.js';
import { p2wpkh } from '../src/esm/payments/p2wpkh.js';
import { p2wsh } from '../src/esm/payments/p2wsh.js';
import { p2tr } from '../src/esm/payments/p2tr.js';

import embedFixtures from './fixtures/embed.json';
import p2msFixtures from './fixtures/p2ms.json';
import p2pkFixtures from './fixtures/p2pk.json';
import p2pkhFixtures from './fixtures/p2pkh.json';
import p2shFixtures from './fixtures/p2sh.json';
import p2wpkhFixtures from './fixtures/p2wpkh.json';
import p2wshFixtures from './fixtures/p2wsh.json';
import p2trFixtures from './fixtures/p2tr.json';

let testSuite: {
  paymentName: string;
  fixtures: { valid: any[]; invalid: any[]; dynamic?: any };
  payment: PaymentCreator;
}[] = [
  {
    paymentName: 'embed',
    fixtures: embedFixtures,
    payment: p2data,
  },
  {
    paymentName: 'p2ms',
    fixtures: p2msFixtures,
    payment: p2ms,
  },
  {
    paymentName: 'p2pk',
    fixtures: p2pkFixtures,
    payment: p2pk,
  },
  {
    paymentName: 'p2pkh',
    fixtures: p2pkhFixtures,
    payment: p2pkh,
  },
  {
    paymentName: 'p2sh',
    fixtures: p2shFixtures,
    payment: p2sh,
  },
  {
    paymentName: 'p2wpkh',
    fixtures: p2wpkhFixtures,
    payment: p2wpkh,
  },
  {
    paymentName: 'p2wsh',
    fixtures: p2wshFixtures,
    payment: p2wsh,
  },
  {
    paymentName: 'p2tr',
    fixtures: p2trFixtures,
    payment: p2tr,
  },
];

testSuite.forEach(p => {
  describe(p.paymentName, () => {
    beforeEach(async () => {
      initEccLib(p.paymentName === 'p2tr' ? ecc : undefined);
    });

    p.fixtures.valid.forEach((f: any) => {
      it(f.description + ' as expected', () => {
        const args = u.preform(f.arguments);
        const actual = p.payment(args, f.options);

        u.equate(actual, f.expected, f.arguments);
      });

      it(f.description + ' as expected (no validation)', () => {
        const args = u.preform(f.arguments);
        const actual = p.payment(
          args,
          Object.assign({}, f.options, {
            validate: false,
          }),
        );

        u.equate(actual, f.expected, f.arguments);
      });
    });

    p.fixtures.invalid.forEach((f: any) => {
      it(
        'throws ' + f.exception + (f.description ? 'for ' + f.description : ''),
        () => {
          const args = u.preform(f.arguments);
          assert.throws(() => {
            p.payment(args, f.options);
          }, new RegExp(f.exception));
        },
      );
    });

    if (p.paymentName === 'p2sh') {
      it('properly assembles nested p2wsh with names', () => {
        const actual = p.payment({
          redeem: p2wsh({
            redeem: p2pk({
              pubkey: Buffer.from(
                '03e15819590382a9dd878f01e2f0cbce541564eb415e43b440472d883ecd283058',
                'hex',
              ),
            }),
          }),
        });
        assert.strictEqual(
          actual.address,
          '3MGbrbye4ttNUXM8WAvBFRKry4fkS9fjuw',
        );
        assert.strictEqual(actual.name, 'p2sh-p2wsh-p2pk');
        assert.strictEqual(actual.redeem!.name, 'p2wsh-p2pk');
        assert.strictEqual(actual.redeem!.redeem!.name, 'p2pk');
      });
    }

    // cross-verify dynamically too
    if (!p.fixtures!.dynamic) return;
    const { depends, details } = p.fixtures.dynamic;

    details.forEach((f: any) => {
      const detail = u.preform(f);
      const disabled: any = {};
      if (f.disabled)
        f.disabled.forEach((k: string) => {
          disabled[k] = true;
        });

      for (const key in depends) {
        if (key in disabled) continue;
        const dependencies = depends[key];

        dependencies.forEach((dependency: any) => {
          if (!Array.isArray(dependency)) dependency = [dependency];

          const args = {};
          dependency.forEach((d: any) => {
            u.from(d, detail, args);
          });
          const expected = u.from(key, detail);

          it(
            f.description +
              ', ' +
              key +
              ' derives from ' +
              JSON.stringify(dependency),
            () => {
              u.equate(p.payment(args), expected);
            },
          );
        });
      }
    });
  });
});
