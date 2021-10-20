import * as assert from 'assert';
import * as schnorr from '../src/schnorrBip340';
const fixtures = require('./fixtures/schnorr.json');

interface Fixture {
  d?: Buffer;
  e: Buffer;
  Q: Buffer;
  m: Buffer;
  s: Buffer;
  v?: boolean;
  exception?: string;
  comment: string;
}

function getFixtures(): Fixture[] {
  return fixtures.bip340testvectors.map((f: Record<string, unknown>) =>
    Object.entries(f).reduce((obj, [key, value]) => {
      switch (key) {
        case 'v':
          if (value !== true && value !== false) {
            throw new Error(`invalid value for 'v'`);
          }
          break;
        case 'exception':
        case 'comment':
          if (typeof value !== 'string') {
            throw new Error(`invalid value for 'comment'`);
          }
          break;
        default:
          value = Buffer.from(value as string, 'hex');
      }

      return Object.assign(obj, { [key]: value });
    }, {}),
  );
}

describe('Schnorr', () => {
  function testFixtures(
    callback: (f: Fixture) => void,
    ignoreExceptions: string[],
  ): void {
    getFixtures().forEach(f => {
      try {
        callback(f);
      } catch (e) {
        if (
          f.exception !== undefined &&
          ignoreExceptions.includes(f.exception)
        ) {
          return;
        }
        throw e;
      }
    });
  }
  it('isPoint', () => {
    testFixtures(f => assert.strictEqual(schnorr.isXOnlyPoint(f.Q), true), [
      'Expected Point',
    ]);
  });

  it('verifySchnorr', () => {
    testFixtures(
      f => assert.strictEqual(schnorr.verifySchnorr(f.m, f.Q, f.s), f.v),
      ['Expected Point', 'Expected Signature'],
    );
  });

  it('signSchnorr', () => {
    testFixtures(
      f => {
        if (!f.d) {
          return;
        }
        const sig = schnorr.signSchnorr(f.m, f.d, f.e);
        assert.strictEqual(sig.toString('hex'), f.s.toString('hex'));
        assert.strictEqual(schnorr.verifySchnorr(f.m, f.Q, sig), true);
      },
      ['Expected Private'],
    );
  });

  it('signSchnorrWithoutExtraData', () => {
    testFixtures(
      f => {
        if (!f.d) {
          return;
        }
        assert.strictEqual(
          schnorr.verifySchnorr(
            f.m,
            f.Q,
            schnorr.signSchnorrWithoutExtraData(f.m, f.d),
          ),
          true,
        );
      },
      ['Expected Private'],
    );
  });
});
