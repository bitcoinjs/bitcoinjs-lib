const { describe, it } = require('mocha')
const assert = require('assert')

const ECPair = require('../src/ecpair')
const Psbt = require('..').Psbt
const NETWORKS = require('../src/networks')

const initBuffers = object => JSON.parse(JSON.stringify(object), (key, value) => {
  const regex = new RegExp(/^Buffer.from\(['"](.*)['"], ['"](.*)['"]\)$/)
  const result = regex.exec(value)
  if (!result) return value

  const data = result[1]
  const encoding = result[2]

  return Buffer.from(data, encoding)
})

const fixtures = initBuffers(require('./fixtures/psbt'))

const upperCaseFirstLetter = str => str.replace(/^./, s => s.toUpperCase())

const b = hex => Buffer.from(hex, 'hex');

describe(`Psbt`, () => {
  describe('BIP174 Test Vectors', () => {
    fixtures.bip174.invalid.forEach(f => {
      it(`Invalid: ${f.description}`, () => {
        assert.throws(() => {
          Psbt.fromBase64(f.psbt)
        }, {message: f.errorMessage})
      })
    })

    fixtures.bip174.valid.forEach(f => {
      it(`Valid: ${f.description}`, () => {
        assert.doesNotThrow(() => {
          Psbt.fromBase64(f.psbt)
        })
      })
    })

    fixtures.bip174.failSignChecks.forEach(f => {
      const keyPair = ECPair.makeRandom()
      it(`Fails Signer checks: ${f.description}`, () => {
        const psbt =  Psbt.fromBase64(f.psbt)
        assert.throws(() => {
          psbt.signInput(f.inputToCheck, keyPair)
        }, {message: f.errorMessage})
      })
    })

    fixtures.bip174.creator.forEach(f => {
      it('Creates expected PSBT', () => {
        const psbt = new Psbt()
        for (const input of f.inputs) {
          psbt.addInput(input)
        }
        for (const output of f.outputs) {
          const script = Buffer.from(output.script, 'hex');
          psbt.addOutput({...output, script})
        }
        assert.strictEqual(psbt.toBase64(), f.result)
      })
    })

    fixtures.bip174.updater.forEach(f => {
      it('Updates PSBT to the expected result', () => {
        const psbt = Psbt.fromBase64(f.psbt)

        for (const inputOrOutput of ['input', 'output']) {
          const fixtureData = f[`${inputOrOutput}Data`]
          if (fixtureData) {
            for (const [i, data] of fixtureData.entries()) {
              const attrs = Object.keys(data)
              for (const attr of attrs) {
                const upperAttr = upperCaseFirstLetter(attr)
                let adder = psbt[`add${upperAttr}To${upperCaseFirstLetter(inputOrOutput)}`]
                if (adder !== undefined) {
                  adder = adder.bind(psbt)
                  const arg = data[attr]
                  if (Array.isArray(arg)) {
                    arg.forEach(a => adder(i, a))
                  } else {
                    adder(i, arg)
                  }
                }
              }
            }
          }
        }

        assert.strictEqual(psbt.toBase64(), f.result)
      })
    })
  })

  fixtures.bip174.signer.forEach(f => {
    it('Signs PSBT to the expected result', () => {
      const psbt =  Psbt.fromBase64(f.psbt)

      f.keys.forEach(({inputToSign, WIF}) => {
        const keyPair = ECPair.fromWIF(WIF, NETWORKS.testnet);
        psbt.signInput(inputToSign, keyPair);
      })

      assert.strictEqual(psbt.toBase64(), f.result)
    })
  })

  fixtures.bip174.combiner.forEach(f => {
    it('Combines two PSBTs to the expected result', () => {
      const psbts =  f.psbts.map(psbt => Psbt.fromBase64(psbt))

      psbts[0].combine(psbts[1])

      // Produces a different Base64 string due to implemetation specific key-value ordering.
      // That means this test will fail:
      // assert.strictEqual(psbts[0].toBase64(), f.result)
      // However, if we compare the actual PSBT properties we can see they are logically identical:
      assert.deepStrictEqual(psbts[0], Psbt.fromBase64(f.result))
    })
  })

  fixtures.bip174.finalizer.forEach(f => {
    it('Finalizes inputs and gives the expected PSBT', () => {
      const psbt =  Psbt.fromBase64(f.psbt)

      assert.throws(() => {
        psbt.getFeeRate()
      }, new RegExp('PSBT must be finalized to calculate fee rate'))

      const pubkey = Buffer.from(
        '029583bf39ae0a609747ad199addd634fa6108559d6c5cd39b4c2183f1ab96e07f',
        'hex',
      )
      assert.strictEqual(psbt.validateSignatures(0), true)
      assert.strictEqual(psbt.validateSignatures(0, pubkey), true)
      assert.throws(() => {
        pubkey[32] = 42
        psbt.validateSignatures(0, pubkey)
      }, new RegExp('No signatures for this pubkey'))
      assert.throws(() => {
        psbt.validateSignatures(42)
      }, new RegExp('No signatures to validate'))

      psbt.finalizeAllInputs()

      assert.strictEqual(psbt.toBase64(), f.result)
    })
  })

  fixtures.bip174.extractor.forEach(f => {
    it('Extracts the expected transaction from a PSBT', () => {
      const psbt1 =  Psbt.fromBase64(f.psbt)
      const transaction1 = psbt1.extractTransaction(true).toHex()

      const psbt2 =  Psbt.fromBase64(f.psbt)
      const transaction2 = psbt2.extractTransaction().toHex()

      assert.strictEqual(transaction1, transaction2)
      assert.strictEqual(transaction1, f.transaction)

      const psbt3 =  Psbt.fromBase64(f.psbt)
      delete psbt3.inputs[0].finalScriptSig
      delete psbt3.inputs[0].finalScriptWitness
      assert.throws(() => {
        psbt3.extractTransaction()
      }, new RegExp('Not finalized'))

      const psbt4 =  Psbt.fromBase64(f.psbt)
      psbt4.setMaximumFeeRate(1)
      assert.throws(() => {
        psbt4.extractTransaction()
      }, new RegExp('Warning: You are paying around [\\d.]+ in fees'))

      const psbt5 =  Psbt.fromBase64(f.psbt)
      psbt5.extractTransaction(true)
      const fr1 = psbt5.getFeeRate()
      const fr2 = psbt5.getFeeRate()
      assert.strictEqual(fr1, fr2)
    })
  })

  describe('signInputAsync', () => {
    fixtures.signInput.checks.forEach(f => {
      it(f.description, async () => {
        const psbtThatShouldsign = Psbt.fromBase64(f.shouldSign.psbt)
        assert.doesNotReject(async () => {
          await psbtThatShouldsign.signInputAsync(
            f.shouldSign.inputToCheck,
            ECPair.fromWIF(f.shouldSign.WIF),
          )
        })

        const psbtThatShouldThrow = Psbt.fromBase64(f.shouldThrow.psbt)
        assert.rejects(async () => {
          await psbtThatShouldThrow.signInputAsync(
            f.shouldThrow.inputToCheck,
            ECPair.fromWIF(f.shouldThrow.WIF),
          )
        }, {message: f.shouldThrow.errorMessage})
        assert.rejects(async () => {
          await psbtThatShouldThrow.signInputAsync(
            f.shouldThrow.inputToCheck,
          )
        }, new RegExp('Need Signer to sign input'))
      })
    })
  })

  describe('signInput', () => {
    fixtures.signInput.checks.forEach(f => {
      it(f.description, () => {
        const psbtThatShouldsign = Psbt.fromBase64(f.shouldSign.psbt)
        assert.doesNotThrow(() => {
          psbtThatShouldsign.signInput(
            f.shouldSign.inputToCheck,
            ECPair.fromWIF(f.shouldSign.WIF),
          )
        })

        const psbtThatShouldThrow = Psbt.fromBase64(f.shouldThrow.psbt)
        assert.throws(() => {
          psbtThatShouldThrow.signInput(
            f.shouldThrow.inputToCheck,
            ECPair.fromWIF(f.shouldThrow.WIF),
          )
        }, {message: f.shouldThrow.errorMessage})
        assert.throws(() => {
          psbtThatShouldThrow.signInput(
            f.shouldThrow.inputToCheck,
          )
        }, new RegExp('Need Signer to sign input'))
      })
    })
  })

  describe('signAsync', () => {
    fixtures.signInput.checks.forEach(f => {
      if (f.description === 'checks the input exists') return
      it(f.description, async () => {
        const psbtThatShouldsign = Psbt.fromBase64(f.shouldSign.psbt)
        assert.doesNotReject(async () => {
          await psbtThatShouldsign.signAsync(
            ECPair.fromWIF(f.shouldSign.WIF),
          )
        })

        const psbtThatShouldThrow = Psbt.fromBase64(f.shouldThrow.psbt)
        assert.rejects(async () => {
          await psbtThatShouldThrow.signAsync(
            ECPair.fromWIF(f.shouldThrow.WIF),
          )
        }, new RegExp('No inputs were signed'))
        assert.rejects(async () => {
          await psbtThatShouldThrow.signAsync()
        }, new RegExp('Need Signer to sign input'))
      })
    })
  })

  describe('sign', () => {
    fixtures.signInput.checks.forEach(f => {
      if (f.description === 'checks the input exists') return
      it(f.description, () => {
        const psbtThatShouldsign = Psbt.fromBase64(f.shouldSign.psbt)
        assert.doesNotThrow(() => {
          psbtThatShouldsign.sign(
            ECPair.fromWIF(f.shouldSign.WIF),
          )
        })

        const psbtThatShouldThrow = Psbt.fromBase64(f.shouldThrow.psbt)
        assert.throws(() => {
          psbtThatShouldThrow.sign(
            ECPair.fromWIF(f.shouldThrow.WIF),
          )
        }, new RegExp('No inputs were signed'))
        assert.throws(() => {
          psbtThatShouldThrow.sign()
        }, new RegExp('Need Signer to sign input'))
      })
    })
  })

  describe('fromTransaction', () => {
    fixtures.fromTransaction.forEach(f => {
      it('Creates the expected PSBT from a transaction buffer', () => {
        const psbt = Psbt.fromTransaction(Buffer.from(f.transaction, 'hex'))
        assert.strictEqual(psbt.toBase64(), f.result)
      })
    })
  })

  describe('addInput', () => {
    fixtures.addInput.checks.forEach(f => {
      for (const attr of Object.keys(f.inputData)) {
        f.inputData[attr] = f.inputData[attr]
      }
      it(f.description, () => {
        const psbt = new Psbt()

        if (f.exception) {
          assert.throws(() => {
            psbt.addInput(f.inputData)
          }, new RegExp(f.exception))
        } else {
          assert.doesNotThrow(() => {
            psbt.addInput(f.inputData)
            if (f.equals) {
              assert.strictEqual(psbt.toBase64(), f.equals)
            } else {
              console.log(psbt.toBase64())
            }
          })
          assert.throws(() => {
            psbt.addInput(f.inputData)
          }, new RegExp('Duplicate input detected.'))
        }
      })
    })
  })

  describe('addOutput', () => {
    fixtures.addOutput.checks.forEach(f => {
      for (const attr of Object.keys(f.outputData)) {
        f.outputData[attr] = f.outputData[attr]
      }
      it(f.description, () => {
        const psbt = new Psbt()

        if (f.exception) {
          assert.throws(() => {
            psbt.addOutput(f.outputData)
          }, new RegExp(f.exception))
        } else {
          assert.doesNotThrow(() => {
            psbt.addOutput(f.outputData)
            console.log(psbt.toBase64())
          })
        }
      })
    })
  })

  describe('setVersion', () => {
    it('Sets the version value of the unsigned transaction', () => {
      const psbt = new Psbt()

      assert.strictEqual(psbt.extractTransaction().version, 2)
      psbt.setVersion(1)
      assert.strictEqual(psbt.extractTransaction().version, 1)
    })
  })

  describe('setLocktime', () => {
    it('Sets the nLockTime value of the unsigned transaction', () => {
      const psbt = new Psbt()

      assert.strictEqual(psbt.extractTransaction().locktime, 0)
      psbt.setLocktime(1)
      assert.strictEqual(psbt.extractTransaction().locktime, 1)
    })
  })

  describe('setSequence', () => {
    it('Sets the sequence number for a given input', () => {
      const psbt = new Psbt()
      psbt.addInput({
        hash: '0000000000000000000000000000000000000000000000000000000000000000',
        index: 0
      });

      assert.strictEqual(psbt.inputCount, 1)
      assert.strictEqual(psbt.__CACHE.__TX.ins[0].sequence, 0xffffffff)
      psbt.setSequence(0, 0)
      assert.strictEqual(psbt.__CACHE.__TX.ins[0].sequence, 0)
    })

    it('throws if input index is too high', () => {
      const psbt = new Psbt()
      psbt.addInput({
        hash: '0000000000000000000000000000000000000000000000000000000000000000',
        index: 0
      });

      assert.throws(() => {
        psbt.setSequence(1, 0)
      }, {message: 'Input index too high'})
    })
  })

  describe('setMaximumFeeRate', () => {
    it('Sets the maximumFeeRate value', () => {
      const psbt = new Psbt()

      assert.strictEqual(psbt.opts.maximumFeeRate, 5000)
      psbt.setMaximumFeeRate(6000)
      assert.strictEqual(psbt.opts.maximumFeeRate, 6000)
    })
  })

  describe('create 1-to-1 transaction', () => {
    const alice = ECPair.fromWIF('L2uPYXe17xSTqbCjZvL2DsyXPCbXspvcu5mHLDYUgzdUbZGSKrSr')
    const psbt = new Psbt()
    psbt.addInput({
      hash: '7d067b4a697a09d2c3cff7d4d9506c9955e93bff41bf82d439da7d030382bc3e',
      index: 0,
      nonWitnessUtxo: Buffer.from(
        '0200000001f9f34e95b9d5c8abcd20fc5bd4a825d1517be62f0f775e5f36da944d9' +
        '452e550000000006b483045022100c86e9a111afc90f64b4904bd609e9eaed80d48' +
        'ca17c162b1aca0a788ac3526f002207bb79b60d4fc6526329bf18a77135dc566020' +
        '9e761da46e1c2f1152ec013215801210211755115eabf846720f5cb18f248666fec' +
        '631e5e1e66009ce3710ceea5b1ad13ffffffff01905f0100000000001976a9148bb' +
        'c95d2709c71607c60ee3f097c1217482f518d88ac00000000',
        'hex',
      ),
      sighashType: 1,
    })
    psbt.addOutput({
      address: '1KRMKfeZcmosxALVYESdPNez1AP1mEtywp',
      value: 80000
    })
    psbt.signInput(0, alice)
    assert.throws(() => {
      psbt.setVersion(3)
    }, new RegExp('Can not modify transaction, signatures exist.'))
    psbt.validateSignatures(0)
    psbt.finalizeAllInputs()
    assert.strictEqual(
      psbt.extractTransaction().toHex(),
      '02000000013ebc8203037dda39d482bf41ff3be955996c50d9d4f7cfc3d2097a694a7' +
      'b067d000000006b483045022100931b6db94aed25d5486884d83fc37160f37f3368c0' +
      'd7f48c757112abefec983802205fda64cff98c849577026eb2ce916a50ea70626a766' +
      '9f8596dd89b720a26b4d501210365db9da3f8a260078a7e8f8b708a1161468fb2323f' +
      'fda5ec16b261ec1056f455ffffffff0180380100000000001976a914ca0d36044e0dc' +
      '08a22724efa6f6a07b0ec4c79aa88ac00000000',
    )
  })

  describe('Method return types', () => {
    it('fromTransaction returns Psbt type (not base class)', () => {
      const psbt = Psbt.fromTransaction(Buffer.from([2,0,0,0,0,0,0,0,0,0]));
      assert.strictEqual(psbt instanceof Psbt, true);
      assert.ok(psbt.__CACHE.__TX);
    })
    it('fromBuffer returns Psbt type (not base class)', () => {
      const psbt = Psbt.fromBuffer(Buffer.from(
        '70736274ff01000a01000000000000000000000000', 'hex' //cHNidP8BAAoBAAAAAAAAAAAAAAAA
      ));
      assert.strictEqual(psbt instanceof Psbt, true);
      assert.ok(psbt.__CACHE.__TX);
    })
    it('fromBase64 returns Psbt type (not base class)', () => {
      const psbt = Psbt.fromBase64('cHNidP8BAAoBAAAAAAAAAAAAAAAA');
      assert.strictEqual(psbt instanceof Psbt, true);
      assert.ok(psbt.__CACHE.__TX);
    })
    it('fromHex returns Psbt type (not base class)', () => {
      const psbt = Psbt.fromHex('70736274ff01000a01000000000000000000000000');
      assert.strictEqual(psbt instanceof Psbt, true);
      assert.ok(psbt.__CACHE.__TX);
    })
  })

  describe('Cache', () => {
    it('non-witness UTXOs are cached', () => {
      const f = fixtures.cache.nonWitnessUtxo;
      const psbt = Psbt.fromBase64(f.psbt)
      const index = f.inputIndex;

      // Cache is empty
      assert.strictEqual(psbt.__CACHE.__NON_WITNESS_UTXO_BUF_CACHE[index], undefined)

      // Cache is populated
      psbt.addNonWitnessUtxoToInput(index, f.nonWitnessUtxo)
      const value = psbt.inputs[index].nonWitnessUtxo
      assert.ok(psbt.__CACHE.__NON_WITNESS_UTXO_BUF_CACHE[index].equals(value))
      assert.ok(psbt.__CACHE.__NON_WITNESS_UTXO_BUF_CACHE[index].equals(f.nonWitnessUtxo))

      // Cache is rebuilt from internal transaction object when cleared
      psbt.inputs[index].nonWitnessUtxo = Buffer.from([1,2,3])
      psbt.__CACHE.__NON_WITNESS_UTXO_BUF_CACHE[index] = undefined
      assert.ok(psbt.inputs[index].nonWitnessUtxo.equals(value))
    })
  })
})

