import * as assert from 'assert';
import { beforeEach, describe, it } from 'mocha';
import { Transaction } from '..';
import * as bscript from '../src/script';
import * as fixtures from './fixtures/transaction.json';

describe('Transaction', () => {
  function fromRaw(raw: any, noWitness?: boolean): Transaction {
    const tx = new Transaction();
    tx.version = raw.version;
    tx.locktime = raw.locktime;

    raw.ins.forEach((txIn: any, i: number) => {
      const txHash = Buffer.from(txIn.hash, 'hex');
      let scriptSig;

      if (txIn.data) {
        scriptSig = Buffer.from(txIn.data, 'hex');
      } else if (txIn.script) {
        scriptSig = bscript.fromASM(txIn.script);
      }

      tx.addInput(txHash, txIn.index, txIn.sequence, scriptSig);

      if (!noWitness && txIn.witness) {
        const witness = txIn.witness.map((x: string) => {
          return Buffer.from(x, 'hex');
        });

        tx.setWitness(i, witness);
      }
    });

    raw.outs.forEach((txOut: any) => {
      let script: Buffer;

      if (txOut.data) {
        script = Buffer.from(txOut.data, 'hex');
      } else if (txOut.script) {
        script = bscript.fromASM(txOut.script);
      }

      tx.addOutput(script!, txOut.value);
    });

    return tx;
  }

  describe('fromBuffer/fromHex', () => {
    function importExport(f: any): void {
      const id = f.id || f.hash;
      const txHex = f.hex || f.txHex;

      it('imports ' + f.description + ' (' + id + ')', () => {
        const actual = Transaction.fromHex(txHex);

        assert.strictEqual(actual.toHex(), txHex);
      });

      if (f.whex) {
        it('imports ' + f.description + ' (' + id + ') as witness', () => {
          const actual = Transaction.fromHex(f.whex);

          assert.strictEqual(actual.toHex(), f.whex);
        });
      }
    }

    fixtures.valid.forEach(importExport);
    fixtures.hashForSignature.forEach(importExport);
    fixtures.hashForWitnessV0.forEach(importExport);

    fixtures.invalid.fromBuffer.forEach(f => {
      it('throws on ' + f.exception, () => {
        assert.throws(() => {
          Transaction.fromHex(f.hex);
        }, new RegExp(f.exception));
      });
    });

    it('.version should be interpreted as an int32le', () => {
      const txHex = 'ffffffff0000ffffffff';
      const tx = Transaction.fromHex(txHex);
      assert.strictEqual(-1, tx.version);
      assert.strictEqual(0xffffffff, tx.locktime);
    });
  });

  describe('toBuffer/toHex', () => {
    fixtures.valid.forEach(f => {
      it('exports ' + f.description + ' (' + f.id + ')', () => {
        const actual = fromRaw(f.raw, true);
        assert.strictEqual(actual.toHex(), f.hex);
      });

      if (f.whex) {
        it('exports ' + f.description + ' (' + f.id + ') as witness', () => {
          const wactual = fromRaw(f.raw);
          assert.strictEqual(wactual.toHex(), f.whex);
        });
      }
    });

    it('accepts target Buffer and offset parameters', () => {
      const f = fixtures.valid[0];
      const actual = fromRaw(f.raw);
      const byteLength = actual.byteLength();

      const target = Buffer.alloc(byteLength * 2);
      const a = actual.toBuffer(target, 0);
      const b = actual.toBuffer(target, byteLength);

      assert.strictEqual(a.length, byteLength);
      assert.strictEqual(b.length, byteLength);
      assert.strictEqual(a.toString('hex'), f.hex);
      assert.strictEqual(b.toString('hex'), f.hex);
      assert.deepStrictEqual(a, b);
      assert.deepStrictEqual(a, target.slice(0, byteLength));
      assert.deepStrictEqual(b, target.slice(byteLength));
    });
  });

  describe('hasWitnesses', () => {
    fixtures.valid.forEach(f => {
      it(
        'detects if the transaction has witnesses: ' +
          (f.whex ? 'true' : 'false'),
        () => {
          assert.strictEqual(
            Transaction.fromHex(f.whex ? f.whex : f.hex).hasWitnesses(),
            !!f.whex,
          );
        },
      );
    });
  });

  describe('weight/virtualSize', () => {
    it('computes virtual size', () => {
      fixtures.valid.forEach(f => {
        const transaction = Transaction.fromHex(f.whex ? f.whex : f.hex);

        assert.strictEqual(transaction.virtualSize(), f.virtualSize);
      });
    });

    it('computes weight', () => {
      fixtures.valid.forEach(f => {
        const transaction = Transaction.fromHex(f.whex ? f.whex : f.hex);

        assert.strictEqual(transaction.weight(), f.weight);
      });
    });
  });

  describe('addInput', () => {
    let prevTxHash: Buffer;
    beforeEach(() => {
      prevTxHash = Buffer.from(
        'ffffffff00ffff000000000000000000000000000000000000000000101010ff',
        'hex',
      );
    });

    it('returns an index', () => {
      const tx = new Transaction();
      assert.strictEqual(tx.addInput(prevTxHash, 0), 0);
      assert.strictEqual(tx.addInput(prevTxHash, 0), 1);
    });

    it('defaults to empty script, witness and 0xffffffff SEQUENCE number', () => {
      const tx = new Transaction();
      tx.addInput(prevTxHash, 0);

      assert.strictEqual(tx.ins[0].script.length, 0);
      assert.strictEqual(tx.ins[0].witness.length, 0);
      assert.strictEqual(tx.ins[0].sequence, 0xffffffff);
    });

    fixtures.invalid.addInput.forEach(f => {
      it('throws on ' + f.exception, () => {
        const tx = new Transaction();
        const hash = Buffer.from(f.hash, 'hex');

        assert.throws(() => {
          tx.addInput(hash, f.index);
        }, new RegExp(f.exception));
      });
    });
  });

  describe('addOutput', () => {
    it('returns an index', () => {
      const tx = new Transaction();
      assert.strictEqual(tx.addOutput(Buffer.alloc(0), 0), 0);
      assert.strictEqual(tx.addOutput(Buffer.alloc(0), 0), 1);
    });
  });

  describe('clone', () => {
    fixtures.valid.forEach(f => {
      let actual: Transaction;
      let expected: Transaction;

      beforeEach(() => {
        expected = Transaction.fromHex(f.hex);
        actual = expected.clone();
      });

      it('should have value equality', () => {
        assert.deepStrictEqual(actual, expected);
      });

      it('should not have reference equality', () => {
        assert.notStrictEqual(actual, expected);
      });
    });
  });

  describe('getHash/getId', () => {
    function verify(f: any): void {
      it('should return the id for ' + f.id + '(' + f.description + ')', () => {
        const tx = Transaction.fromHex(f.whex || f.hex);

        assert.strictEqual(tx.getHash().toString('hex'), f.hash);
        assert.strictEqual(tx.getId(), f.id);
      });
    }

    fixtures.valid.forEach(verify);
  });

  describe('isCoinbase', () => {
    function verify(f: any): void {
      it(
        'should return ' +
          f.coinbase +
          ' for ' +
          f.id +
          '(' +
          f.description +
          ')',
        () => {
          const tx = Transaction.fromHex(f.hex);

          assert.strictEqual(tx.isCoinbase(), f.coinbase);
        },
      );
    }

    fixtures.valid.forEach(verify);
  });

  describe('hashForSignature', () => {
    it('does not use Witness serialization', () => {
      const randScript = Buffer.from('6a', 'hex');

      const tx = new Transaction();
      tx.addInput(
        Buffer.from(
          '0000000000000000000000000000000000000000000000000000000000000000',
          'hex',
        ),
        0,
      );
      tx.addOutput(randScript, 5000000000);

      const original = (tx as any).__toBuffer;
      (tx as any).__toBuffer = function(
        this: Transaction,
        a: any,
        b: any,
        c: any,
      ): any {
        if (c !== false) throw new Error('hashForSignature MUST pass false');

        return original.call(this, a, b, c);
      };

      assert.throws(() => {
        (tx as any).__toBuffer(undefined, undefined, true);
      }, /hashForSignature MUST pass false/);

      // assert hashForSignature does not pass false
      assert.doesNotThrow(() => {
        tx.hashForSignature(0, randScript, 1);
      });
    });

    fixtures.hashForSignature.forEach(f => {
      it(
        'should return ' +
          f.hash +
          ' for ' +
          (f.description ? 'case "' + f.description + '"' : f.script),
        () => {
          const tx = Transaction.fromHex(f.txHex);
          const script = bscript.fromASM(f.script);

          assert.strictEqual(
            tx.hashForSignature(f.inIndex, script, f.type).toString('hex'),
            f.hash,
          );
        },
      );
    });
  });

  describe('hashForWitnessV0', () => {
    fixtures.hashForWitnessV0.forEach(f => {
      it(
        'should return ' +
          f.hash +
          ' for ' +
          (f.description ? 'case "' + f.description + '"' : ''),
        () => {
          const tx = Transaction.fromHex(f.txHex);
          const script = bscript.fromASM(f.script);

          assert.strictEqual(
            tx
              .hashForWitnessV0(f.inIndex, script, f.value, f.type)
              .toString('hex'),
            f.hash,
          );
        },
      );
    });
  });

  describe('setWitness', () => {
    it('only accepts a a witness stack (Array of Buffers)', () => {
      assert.throws(() => {
        (new Transaction().setWitness as any)(0, 'foobar');
      }, /Expected property "1" of type \[Buffer], got String "foobar"/);
    });
  });
});
