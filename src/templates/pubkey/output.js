// {pubKey} OP_CHECKSIG

const bscript = require('../../script')
const OPS = require('bitcoin-ops')

function check (script) {
  const chunks = bscript.decompile(script)

  return chunks.length === 2 &&
    bscript.isCanonicalPubKey(chunks[0]) &&
    chunks[1] === OPS.OP_CHECKSIG
}
check.toJSON = function () { return 'pubKey output' }

module.exports = { check }
