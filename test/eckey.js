var assert = require('assert');
var Key = require('..').Key;

test('Serialize/Deserialize', function() {
  var key = new Key();
  var exportedKey = key.getExportedPrivateKey();
  var key2 = new Key(exportedKey);

  assert.ok(key.priv.equals(key2.priv));

  var testExportedKey = key.getExportedPrivateKey('testnet');
  assert.notEqual(exportedKey, testExportedKey);

  var key3 = new Key(testExportedKey);
  assert.ok(key.priv.equals(key3.priv));

  var prodExportedKey = key.getExportedPrivateKey('prod');
  assert.equal(exportedKey, prodExportedKey);
});
