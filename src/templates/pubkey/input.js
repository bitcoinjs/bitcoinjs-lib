// {signature}

const bscript = require('../../script')

function check (script) {
  const chunks = bscript.decompile(script)

  return chunks.length === 1 &&
    bscript.isCanonicalScriptSignature(chunks[0])
}
check.toJSON = function () { return 'pubKey input' }

module.exports = {
  check: check
}
