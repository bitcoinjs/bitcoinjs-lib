var assert = require('assert')
var enforceType = require('../src/types')

function CustomType() { return "ensure non-greedy match".toUpperCase() }

var types = ['Array', 'Boolean', 'Buffer', 'Number', 'String', CustomType]
var values = [[], true, new Buffer(1), 1234, 'foobar', new CustomType()]

describe('enforceType', function() {
  types.forEach(function(type, i) {
    describe(type, function() {
      values.forEach(function(value, j) {
        if (j === i) {
          it('passes for ' + types[j], function() {
            enforceType(type, value)
          })

        } else {
          it('fails for ' + types[j], function() {
            assert.throws(function() {
              enforceType(type, value)
            }, new RegExp('Expected ' + (type.name || type) + ', got '))
          })
        }
      })
    })
  })
})
