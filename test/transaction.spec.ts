import * as assert from 'assert';
import { beforeEach, describe, it } from 'mocha';
import { Transaction } from '..';
import * as bscript from '../src/script';
import * as fixtures from './fixtures/transaction.json';
import * as fixtures_bigint from './fixtures/transaction_bigint.json';

function runTest<TNumber extends number | bigint>(
  fixture: any,
  amountType: 'number' | 'bigint',
): void {
  if (amountType !== 'number' && amountType !== 'bigint') {
    throw new Error();
  }

  function toTNumber(v: any | undefined): TNumber {
    if (v === undefined) {
      return v;
    }
    if (amountType === 'number') {
      return Number(v) as TNumber;
    }
    if (amountType === 'bigint') {
      return BigInt(v) as TNumber;
    }
    throw new Error();
  }

  function fromRaw(raw: any, noWitness?: boolean): Transaction<TNumber> {
    const tx = new Transaction<TNumber>();
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

      tx.addOutput(script!, toTNumber(txOut.value));
    });

    return tx;
  }

  describe('fromBuffer/fromHex', () => {
    function importExport(f: any): void {
      const id = f.id || f.hash;
      const txHex = f.hex || f.txHex;

      it('imports ' + f.description + ' (' + id + ')', () => {
        const actual = Transaction.fromHex<TNumber>(txHex, amountType);

        assert.strictEqual(actual.toHex(), txHex);
      });

      if (f.whex) {
        it('imports ' + f.description + ' (' + id + ') as witness', () => {
          const actual = Transaction.fromHex<TNumber>(f.whex, amountType);

          assert.strictEqual(actual.toHex(), f.whex);
        });
      }
    }

    fixture.valid.forEach(importExport);
    fixture.hashForSignature.forEach(importExport);
    fixture.hashForWitnessV0.forEach(importExport);

    fixture.invalid.fromBuffer.forEach((f: any) => {
      it('throws on ' + f.exception, () => {
        assert.throws(() => {
          Transaction.fromHex<TNumber>(f.hex, amountType);
        }, new RegExp(f.exception));
      });
    });

    it('.version should be interpreted as an int32le', () => {
      const txHex = 'ffffffff0000ffffffff';
      const tx = Transaction.fromHex<TNumber>(txHex, amountType);
      assert.strictEqual(-1, tx.version);
      assert.strictEqual(0xffffffff, tx.locktime);
    });
  });

  describe('toBuffer/toHex', () => {
    fixture.valid.forEach((f: any) => {
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
      const f = fixture.valid[0];
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
    fixture.valid.forEach((f: any) => {
      it(
        'detects if the transaction has witnesses: ' +
          (f.whex ? 'true' : 'false'),
        () => {
          assert.strictEqual(
            Transaction.fromHex<TNumber>(
              f.whex ? f.whex : f.hex,
              amountType,
            ).hasWitnesses(),
            !!f.whex,
          );
        },
      );
    });
  });

  describe('weight/virtualSize', () => {
    it('computes virtual size', () => {
      fixture.valid.forEach((f: any) => {
        const transaction = Transaction.fromHex<TNumber>(
          f.whex ? f.whex : f.hex,
          amountType,
        );

        assert.strictEqual(transaction.virtualSize(), f.virtualSize);
      });
    });

    it('computes weight', () => {
      fixture.valid.forEach((f: any) => {
        const transaction = Transaction.fromHex<TNumber>(
          f.whex ? f.whex : f.hex,
          amountType,
        );

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
      const tx = new Transaction<TNumber>();
      assert.strictEqual(tx.addInput(prevTxHash, 0), 0);
      assert.strictEqual(tx.addInput(prevTxHash, 0), 1);
    });

    it('defaults to empty script, witness and 0xffffffff SEQUENCE number', () => {
      const tx = new Transaction<TNumber>();
      tx.addInput(prevTxHash, 0);

      assert.strictEqual(tx.ins[0].script.length, 0);
      assert.strictEqual(tx.ins[0].witness.length, 0);
      assert.strictEqual(tx.ins[0].sequence, 0xffffffff);
    });

    fixture.invalid.addInput.forEach((f: any) => {
      it('throws on ' + f.exception, () => {
        const tx = new Transaction<TNumber>();
        const hash = Buffer.from(f.hash, 'hex');

        assert.throws(() => {
          tx.addInput(hash, f.index);
        }, new RegExp(f.exception));
      });
    });
  });

  describe('addOutput', () => {
    it('returns an index', () => {
      const tx = new Transaction<TNumber>();
      assert.strictEqual(tx.addOutput(Buffer.alloc(0), toTNumber(0)), 0);
      assert.strictEqual(tx.addOutput(Buffer.alloc(0), toTNumber(0)), 1);
    });
  });

  describe('clone', () => {
    fixture.valid.forEach((f: any) => {
      let actual: Transaction<TNumber>;
      let expected: Transaction<TNumber>;

      beforeEach(() => {
        expected = Transaction.fromHex<TNumber>(f.hex, amountType);
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
        const tx = Transaction.fromHex<TNumber>(f.whex || f.hex, amountType);

        assert.strictEqual(tx.getHash().toString('hex'), f.hash);
        assert.strictEqual(tx.getId(), f.id);
      });
    }

    fixture.valid.forEach(verify);
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
          const tx = Transaction.fromHex<TNumber>(f.hex, amountType);

          assert.strictEqual(tx.isCoinbase(), f.coinbase);
        },
      );
    }

    fixture.valid.forEach(verify);
  });

  describe('hashForSignature', () => {
    it('does not use Witness serialization', () => {
      const randScript = Buffer.from('6a', 'hex');

      const tx = new Transaction<TNumber>();
      tx.addInput(
        Buffer.from(
          '0000000000000000000000000000000000000000000000000000000000000000',
          'hex',
        ),
        0,
      );
      tx.addOutput(randScript, toTNumber(5000000000));

      const original = (tx as any).__toBuffer;
      (tx as any).__toBuffer = function(
        this: Transaction<TNumber>,
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

    fixture.hashForSignature.forEach((f: any) => {
      it(
        'should return ' +
          f.hash +
          ' for ' +
          (f.description ? 'case "' + f.description + '"' : f.script),
        () => {
          const tx = Transaction.fromHex<TNumber>(f.txHex, amountType);
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
    fixture.hashForWitnessV0.forEach((f: any) => {
      it(
        'should return ' +
          f.hash +
          ' for ' +
          (f.description ? 'case "' + f.description + '"' : ''),
        () => {
          const tx = Transaction.fromHex<TNumber>(f.txHex, amountType);
          const script = bscript.fromASM(f.script);

          assert.strictEqual(
            tx
              .hashForWitnessV0(f.inIndex, script, toTNumber(f.value), f.type)
              .toString('hex'),
            f.hash,
          );
        },
      );
    });
  });

  describe('taprootSigning', () => {
    fixture.taprootSigning.forEach((f: any) => {
      const tx = Transaction.fromHex<TNumber>(f.txHex, amountType);
      const prevOutScripts = f.utxos.map(
        ({ scriptHex }: { scriptHex: string }) => Buffer.from(scriptHex, 'hex'),
      );
      const values = f.utxos.map(({ value }: { value: number | string }) =>
        toTNumber(value),
      );

      f.cases.forEach((c: { vin: number; typeHex: string; hash: string }) => {
        let hash: Buffer;

        it(`should hash to ${c.hash} for ${f.description}:${c.vin}`, () => {
          const hashType = Buffer.from(c.typeHex, 'hex').readUInt8(0);

          hash = tx.hashForWitnessV1(c.vin, prevOutScripts, values, hashType);
          assert.strictEqual(hash.toString('hex'), c.hash);
        });
      });
    });
  });

  describe('setWitness', () => {
    it('only accepts a a witness stack (Array of Buffers)', () => {
      assert.throws(() => {
        (new Transaction<TNumber>().setWitness as any)(0, 'foobar');
      }, /Expected property "1" of type \[Buffer], got String "foobar"/);
    });
  });
}

describe('Transaction amountType === number, testFixture === transaction.json', () => {
  runTest<number>(fixtures, 'number');
});

describe('Transaction amountType === bigint, testFixture === transaction.json', () => {
  runTest<bigint>(fixtures, 'bigint');
});

describe('Transaction amountType === bigint, testFixture === transaction_bigint.json', () => {
  runTest<bigint>(fixtures_bigint, 'bigint');
});
