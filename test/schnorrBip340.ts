import * as assert from 'assert';
import * as schnorr from '../ts_src/schnorrBip340';
const fixtures = require('./fixtures/schnorr.json');

type Fixture = {
  d?: Buffer;
  e: Buffer;
  Q: Buffer;
  m: Buffer;
  s: Buffer;
  v?: boolean;
  exception?: string;
  comment: string;
};

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

describe('Schnorr', function() {
  it('isPoint', function() {
    getFixtures().forEach(f => {
      let expectedIsPoint = true;
      if (f.exception === 'Expected Point') {
        expectedIsPoint = false;
      }
      assert.strictEqual(schnorr.isXOnlyPoint(f.Q), expectedIsPoint);
    });
  });

  it('verifySchnorr', function() {
    getFixtures().forEach(f => {
      try {
        schnorr.verifySchnorr(f.m, f.Q, f.s);
      } catch (e) {
        assert.strictEqual(undefined, f.v);

        if (f.exception === 'Expected Point') {
          return;
        }

        if (f.exception === 'Expected Signature') {
          return;
        }

        throw e;
      }
    });
  });

  it('signSchnorr', function() {
    getFixtures().forEach(f => {
      if (!f.d) {
        return;
      }
      try {
        const sig = schnorr.signSchnorr(f.m, f.d, f.e);
        assert.strictEqual(sig.toString('hex'), f.s.toString('hex'));
      } catch (e) {
        if (f.exception === 'Expected Private') {
          return;
        }

        throw e;
      }
    });
  });
});
