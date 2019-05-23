'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const __1 = require('..');
const { describe, it } = require('mocha');
const assert = require('assert');
const u = require('./payments.utils');
['embed', 'p2ms', 'p2pk', 'p2pkh', 'p2sh', 'p2wpkh', 'p2wsh'].forEach(p => {
  describe(p, () => {
    const fn = __1.payments[p];
    const fixtures = require('../ts_test/fixtures/' + p);
    fixtures.valid.forEach((f, i) => {
      it(f.description + ' as expected', () => {
        const args = u.preform(f.arguments);
        const actual = fn(args, f.options);
        u.equate(actual, f.expected, f.arguments);
      });
      it(f.description + ' as expected (no validation)', () => {
        const args = u.preform(f.arguments);
        const actual = fn(
          args,
          // @ts-ignore
          Object.assign({}, f.options, {
            validate: false,
          }),
        );
        u.equate(actual, f.expected, f.arguments);
      });
    });
    fixtures.invalid.forEach(f => {
      it(
        'throws ' + f.exception + (f.description ? 'for ' + f.description : ''),
        () => {
          const args = u.preform(f.arguments);
          assert.throws(() => {
            fn(args, f.options);
          }, new RegExp(f.exception));
        },
      );
    });
    // cross-verify dynamically too
    if (!fixtures.dynamic) return;
    const { depends, details } = fixtures.dynamic;
    details.forEach(f => {
      const detail = u.preform(f);
      const disabled = {};
      if (f.disabled)
        f.disabled.forEach(k => {
          disabled[k] = true;
        });
      for (const key in depends) {
        if (key in disabled) continue;
        const dependencies = depends[key];
        dependencies.forEach(dependency => {
          if (!Array.isArray(dependency)) dependency = [dependency];
          const args = {};
          dependency.forEach(d => {
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
              u.equate(fn(args), expected);
            },
          );
        });
      }
    });
  });
});
