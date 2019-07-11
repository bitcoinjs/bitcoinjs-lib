const { describe, it } = require('mocha')
const assert = require('assert')
const u = require('./payments.utils')

;['embed', 'p2ms', 'p2pk', 'p2pkh', 'p2sh', 'p2wpkh', 'p2wsh'].forEach(p => {
  describe(p, () => {
    let fn
    let payment = require('../src/payments/' + p)
    if (p === 'embed') {
      fn = payment.p2data
    } else {
      fn = payment[p]
    }
    const fixtures = require('./fixtures/' + p)

    fixtures.valid.forEach((f, i) => {
      it(f.description + ' as expected', () => {
        const args = u.preform(f.arguments)
        const actual = fn(args, f.options)

        u.equate(actual, f.expected, f.arguments)
      })

      it(f.description + ' as expected (no validation)', () => {
        const args = u.preform(f.arguments)
        const actual = fn(args, Object.assign({}, f.options, {
          validate: false
        }))

        u.equate(actual, f.expected, f.arguments)
      })
    })

    fixtures.invalid.forEach(f => {
      it('throws ' + f.exception + (f.description ? ('for ' + f.description) : ''), () => {
        const args = u.preform(f.arguments)

        assert.throws(() => {
          fn(args, f.options)
        }, new RegExp(f.exception))
      })
    })

    if (p === 'p2sh') {
      const p2wsh = require('../src/payments/p2wsh').p2wsh
      const p2pk = require('../src/payments/p2pk').p2pk
      it('properly assembles nested p2wsh with names', () => {
        const actual = fn({
          redeem: p2wsh({
            redeem: p2pk({
              pubkey: Buffer.from(
                '03e15819590382a9dd878f01e2f0cbce541564eb415e43b440472d883ecd283058',
                'hex',
              )
            })
          })
        })
        assert.strictEqual(actual.address, '3MGbrbye4ttNUXM8WAvBFRKry4fkS9fjuw')
        assert.strictEqual(actual.name, 'p2sh-p2wsh-p2pk')
        assert.strictEqual(actual.redeem.name, 'p2wsh-p2pk')
        assert.strictEqual(actual.redeem.redeem.name, 'p2pk')
      })
    }

    // cross-verify dynamically too
    if (!fixtures.dynamic) return
    const { depends, details } = fixtures.dynamic

    details.forEach(f => {
      const detail = u.preform(f)
      const disabled = {}
      if (f.disabled) f.disabled.forEach(k => { disabled[k] = true })

      for (let key in depends) {
        if (key in disabled) continue
        const dependencies = depends[key]

        dependencies.forEach(dependency => {
          if (!Array.isArray(dependency)) dependency = [dependency]

          const args = {}
          dependency.forEach(d => { u.from(d, detail, args) })
          const expected = u.from(key, detail)

          it(f.description + ', ' + key + ' derives from ' + JSON.stringify(dependency), () => {
            u.equate(fn(args), expected)
          })
        })
      }
    })
  })
})
