const { describe, it } = require('mocha')
const assert = require('assert')
const u = require('./payments.utils')

;['embed', 'p2ms', 'p2pk', 'p2pkh', 'p2sh', 'p2wpkh', 'p2wsh'].forEach(function (p) {
  describe(p, function () {
    const fn = require('../src/payments/' + p)
    const fixtures = require('./fixtures/' + p)

    fixtures.valid.forEach(function (f, i) {
      it(f.description + ' as expected', function () {
        const args = u.preform(f.arguments)
        const actual = fn(args, f.options)

        u.equate(actual, f.expected, f.arguments)
      })

      it(f.description + ' as expected (no validation)', function () {
        const args = u.preform(f.arguments)
        const actual = fn(args, Object.assign({}, f.options, {
          validate: false
        }))

        u.equate(actual, f.expected, f.arguments)
      })
    })

    fixtures.invalid.forEach(function (f) {
      it('throws ' + f.exception + (f.description ? ('for ' + f.description) : ''), function () {
        const args = u.preform(f.arguments)

        assert.throws(function () {
          fn(args, f.options)
        }, new RegExp(f.exception))
      })
    })

    // cross-verify dynamically too
    if (!fixtures.dynamic) return
    const { depends, details } = fixtures.dynamic

    details.forEach(function (f) {
      const detail = u.preform(f)
      const disabled = {}
      if (f.disabled) f.disabled.forEach(function (k) { disabled[k] = true })

      for (let key in depends) {
        if (key in disabled) continue
        const dependencies = depends[key]

        dependencies.forEach(function (dependency) {
          if (!Array.isArray(dependency)) dependency = [dependency]

          const args = {}
          dependency.forEach(function (d) { u.from(d, detail, args) })
          const expected = u.from(key, detail)

          it(f.description + ', ' + key + ' derives from ' + JSON.stringify(dependency), function () {
            u.equate(fn(args), expected)
          })
        })
      }
    })
  })
})
