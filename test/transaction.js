"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const mocha_1 = require("mocha");
const __1 = require("..");
const fixtures = require('../ts_test/fixtures/transaction');
const __2 = require("..");
mocha_1.describe('Transaction', () => {
    function fromRaw(raw, noWitness) {
        const tx = new __2.Transaction();
        tx.version = raw.version;
        tx.locktime = raw.locktime;
        raw.ins.forEach((txIn, i) => {
            const txHash = Buffer.from(txIn.hash, 'hex');
            let scriptSig;
            if (txIn.data) {
                scriptSig = Buffer.from(txIn.data, 'hex');
            }
            else if (txIn.script) {
                scriptSig = __1.script.fromASM(txIn.script);
            }
            tx.addInput(txHash, txIn.index, txIn.sequence, scriptSig);
            if (!noWitness && txIn.witness) {
                const witness = txIn.witness.map(x => {
                    return Buffer.from(x, 'hex');
                });
                tx.setWitness(i, witness);
            }
        });
        raw.outs.forEach(txOut => {
            let script;
            if (txOut.data) {
                script = Buffer.from(txOut.data, 'hex');
            }
            else if (txOut.script) {
                script = __1.script.fromASM(txOut.script);
            }
            tx.addOutput(script, txOut.value);
        });
        return tx;
    }
    mocha_1.describe('fromBuffer/fromHex', () => {
        function importExport(f) {
            const id = f.id || f.hash;
            const txHex = f.hex || f.txHex;
            mocha_1.it('imports ' + f.description + ' (' + id + ')', () => {
                const actual = __2.Transaction.fromHex(txHex);
                assert.strictEqual(actual.toHex(), txHex);
            });
            if (f.whex) {
                mocha_1.it('imports ' + f.description + ' (' + id + ') as witness', () => {
                    const actual = __2.Transaction.fromHex(f.whex);
                    assert.strictEqual(actual.toHex(), f.whex);
                });
            }
        }
        fixtures.valid.forEach(importExport);
        fixtures.hashForSignature.forEach(importExport);
        fixtures.hashForWitnessV0.forEach(importExport);
        fixtures.invalid.fromBuffer.forEach(f => {
            mocha_1.it('throws on ' + f.exception, () => {
                assert.throws(() => {
                    __2.Transaction.fromHex(f.hex);
                }, new RegExp(f.exception));
            });
        });
        mocha_1.it('.version should be interpreted as an int32le', () => {
            const txHex = 'ffffffff0000ffffffff';
            const tx = __2.Transaction.fromHex(txHex);
            assert.strictEqual(-1, tx.version);
            assert.strictEqual(0xffffffff, tx.locktime);
        });
    });
    mocha_1.describe('toBuffer/toHex', () => {
        fixtures.valid.forEach(f => {
            mocha_1.it('exports ' + f.description + ' (' + f.id + ')', () => {
                const actual = fromRaw(f.raw, true);
                assert.strictEqual(actual.toHex(), f.hex);
            });
            if (f.whex) {
                mocha_1.it('exports ' + f.description + ' (' + f.id + ') as witness', () => {
                    const wactual = fromRaw(f.raw);
                    assert.strictEqual(wactual.toHex(), f.whex);
                });
            }
        });
        mocha_1.it('accepts target Buffer and offset parameters', () => {
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
    mocha_1.describe('hasWitnesses', () => {
        fixtures.valid.forEach(f => {
            mocha_1.it('detects if the transaction has witnesses: ' +
                (f.whex ? 'true' : 'false'), () => {
                assert.strictEqual(__2.Transaction.fromHex(f.whex ? f.whex : f.hex).hasWitnesses(), !!f.whex);
            });
        });
    });
    mocha_1.describe('weight/virtualSize', () => {
        mocha_1.it('computes virtual size', () => {
            fixtures.valid.forEach(f => {
                const transaction = __2.Transaction.fromHex(f.whex ? f.whex : f.hex);
                assert.strictEqual(transaction.virtualSize(), f.virtualSize);
            });
        });
        mocha_1.it('computes weight', () => {
            fixtures.valid.forEach(f => {
                const transaction = __2.Transaction.fromHex(f.whex ? f.whex : f.hex);
                assert.strictEqual(transaction.weight(), f.weight);
            });
        });
    });
    mocha_1.describe('addInput', () => {
        let prevTxHash;
        mocha_1.beforeEach(() => {
            prevTxHash = Buffer.from('ffffffff00ffff000000000000000000000000000000000000000000101010ff', 'hex');
        });
        mocha_1.it('returns an index', () => {
            const tx = new __2.Transaction();
            assert.strictEqual(tx.addInput(prevTxHash, 0), 0);
            assert.strictEqual(tx.addInput(prevTxHash, 0), 1);
        });
        mocha_1.it('defaults to empty script, witness and 0xffffffff SEQUENCE number', () => {
            const tx = new __2.Transaction();
            tx.addInput(prevTxHash, 0);
            assert.strictEqual(tx.ins[0].script.length, 0);
            assert.strictEqual(tx.ins[0].witness.length, 0);
            assert.strictEqual(tx.ins[0].sequence, 0xffffffff);
        });
        fixtures.invalid.addInput.forEach(f => {
            mocha_1.it('throws on ' + f.exception, () => {
                const tx = new __2.Transaction();
                const hash = Buffer.from(f.hash, 'hex');
                assert.throws(() => {
                    tx.addInput(hash, f.index);
                }, new RegExp(f.exception));
            });
        });
    });
    mocha_1.describe('addOutput', () => {
        mocha_1.it('returns an index', () => {
            const tx = new __2.Transaction();
            assert.strictEqual(tx.addOutput(Buffer.alloc(0), 0), 0);
            assert.strictEqual(tx.addOutput(Buffer.alloc(0), 0), 1);
        });
    });
    mocha_1.describe('clone', () => {
        fixtures.valid.forEach(f => {
            let actual;
            let expected;
            mocha_1.beforeEach(() => {
                expected = __2.Transaction.fromHex(f.hex);
                actual = expected.clone();
            });
            mocha_1.it('should have value equality', () => {
                assert.deepStrictEqual(actual, expected);
            });
            mocha_1.it('should not have reference equality', () => {
                assert.notStrictEqual(actual, expected);
            });
        });
    });
    mocha_1.describe('getHash/getId', () => {
        function verify(f) {
            mocha_1.it('should return the id for ' + f.id + '(' + f.description + ')', () => {
                const tx = __2.Transaction.fromHex(f.whex || f.hex);
                assert.strictEqual(tx.getHash().toString('hex'), f.hash);
                assert.strictEqual(tx.getId(), f.id);
            });
        }
        fixtures.valid.forEach(verify);
    });
    mocha_1.describe('isCoinbase', () => {
        function verify(f) {
            mocha_1.it('should return ' +
                f.coinbase +
                ' for ' +
                f.id +
                '(' +
                f.description +
                ')', () => {
                const tx = __2.Transaction.fromHex(f.hex);
                assert.strictEqual(tx.isCoinbase(), f.coinbase);
            });
        }
        fixtures.valid.forEach(verify);
    });
    mocha_1.describe('hashForSignature', () => {
        mocha_1.it('does not use Witness serialization', () => {
            const randScript = Buffer.from('6a', 'hex');
            const tx = new __2.Transaction();
            tx.addInput(Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex'), 0);
            tx.addOutput(randScript, 5000000000);
            // @ts-ignore
            const original = tx.__toBuffer;
            // @ts-ignore
            tx.__toBuffer = (a, b, c) => {
                if (c !== false)
                    throw new Error('hashForSignature MUST pass false');
                return original.call(this, a, b, c);
            };
            assert.throws(() => {
                // @ts-ignore
                tx.__toBuffer(undefined, undefined, true);
            }, /hashForSignature MUST pass false/);
            // assert hashForSignature does not pass false
            assert.doesNotThrow(() => {
                tx.hashForSignature(0, randScript, 1);
            });
        });
        fixtures.hashForSignature.forEach(f => {
            mocha_1.it('should return ' +
                f.hash +
                ' for ' +
                (f.description ? 'case "' + f.description + '"' : f.script), () => {
                const tx = __2.Transaction.fromHex(f.txHex);
                const script = __1.script.fromASM(f.script);
                assert.strictEqual(tx.hashForSignature(f.inIndex, script, f.type).toString('hex'), f.hash);
            });
        });
    });
    mocha_1.describe('hashForWitnessV0', () => {
        fixtures.hashForWitnessV0.forEach(f => {
            mocha_1.it('should return ' +
                f.hash +
                ' for ' +
                (f.description ? 'case "' + f.description + '"' : ''), () => {
                const tx = __2.Transaction.fromHex(f.txHex);
                const script = __1.script.fromASM(f.script);
                assert.strictEqual(tx
                    .hashForWitnessV0(f.inIndex, script, f.value, f.type)
                    .toString('hex'), f.hash);
            });
        });
    });
    mocha_1.describe('setWitness', () => {
        mocha_1.it('only accepts a a witness stack (Array of Buffers)', () => {
            assert.throws(() => {
                // @ts-ignore
                new __2.Transaction().setWitness(0, 'foobar');
            }, /Expected property "1" of type \[Buffer], got String "foobar"/);
        });
    });
});
