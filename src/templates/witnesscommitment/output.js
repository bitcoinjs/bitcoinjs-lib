// OP_RETURN {aa21a9ed} {commitment}

const Buffer = require('safe-buffer').Buffer
const bscript = require('../../script')
const types = require('../../types')
const typeforce = require('typeforce')
const OPS = require('bitcoin-ops')

const HEADER = Buffer.from('aa21a9ed', 'hex')

function check (script) {
  const buffer = bscript.compile(script)

  return buffer.length > 37 &&
    buffer[0] === OPS.OP_RETURN &&
    buffer[1] === 0x24 &&
    buffer.slice(2, 6).equals(HEADER)
}

check.toJSON = function () { return 'Witness commitment output' }

function encode (commitment) {
  typeforce(types.Hash256bit, commitment)

  const buffer = Buffer.allocUnsafe(36)
  HEADER.copy(buffer, 0)
  commitment.copy(buffer, 4)

  return bscript.compile([OPS.OP_RETURN, buffer])
}

function decode (buffer) {
  typeforce(check, buffer)

  return bscript.decompile(buffer)[1].slice(4, 36)
}

module.exports = {
  check: check,
  decode: decode,
  encode: encode
}
