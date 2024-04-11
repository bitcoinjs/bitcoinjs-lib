export interface Opcodes {
  OP_FALSE: number;
  OP_0: number;
  OP_PUSHDATA1: number;
  OP_PUSHDATA2: number;
  OP_PUSHDATA4: number;
  OP_1NEGATE: number;
  OP_RESERVED: number;
  OP_TRUE: number;
  OP_1: number;
  OP_2: number;
  OP_3: number;
  OP_4: number;
  OP_5: number;
  OP_6: number;
  OP_7: number;
  OP_8: number;
  OP_9: number;
  OP_10: number;
  OP_11: number;
  OP_12: number;
  OP_13: number;
  OP_14: number;
  OP_15: number;
  OP_16: number;

  // control
  OP_NOP: number;
  OP_VER: number;
  OP_IF: number;
  OP_NOTIF: number;
  OP_VERIF: number;
  OP_VERNOTIF: number;
  OP_ELSE: number;
  OP_ENDIF: number;
  OP_VERIFY: number;
  OP_RETURN: number;

  // stack ops
  OP_TOALTSTACK: number;
  OP_FROMALTSTACK: number;
  OP_2DROP: number;
  OP_2DUP: number;
  OP_3DUP: number;
  OP_2OVER: number;
  OP_2ROT: number;
  OP_2SWAP: number;
  OP_IFDUP: number;
  OP_DEPTH: number;
  OP_DROP: number;
  OP_DUP: number;
  OP_NIP: number;
  OP_OVER: number;
  OP_PICK: number;
  OP_ROLL: number;
  OP_ROT: number;
  OP_SWAP: number;
  OP_TUCK: number;

  // splice ops
  OP_CAT: number;
  OP_SUBSTR: number;
  OP_LEFT: number;
  OP_RIGHT: number;
  OP_SIZE: number;

  // bit logic
  OP_INVERT: number;
  OP_AND: number;
  OP_OR: number;
  OP_XOR: number;
  OP_EQUAL: number;
  OP_EQUALVERIFY: number;
  OP_RESERVED1: number;
  OP_RESERVED2: number;

  // numeric
  OP_1ADD: number;
  OP_1SUB: number;
  OP_2MUL: number;
  OP_2DIV: number;
  OP_NEGATE: number;
  OP_ABS: number;
  OP_NOT: number;
  OP_0NOTEQUAL: number;
  OP_ADD: number;
  OP_SUB: number;
  OP_MUL: number;
  OP_DIV: number;
  OP_MOD: number;
  OP_LSHIFT: number;
  OP_RSHIFT: number;
  OP_BOOLAND: number;
  OP_BOOLOR: number;
  OP_NUMEQUAL: number;
  OP_NUMEQUALVERIFY: number;
  OP_NUMNOTEQUAL: number;
  OP_LESSTHAN: number;
  OP_GREATERTHAN: number;
  OP_LESSTHANOREQUAL: number;
  OP_GREATERTHANOREQUAL: number;
  OP_MIN: number;
  OP_MAX: number;
  OP_WITHIN: number;

  // crypto
  OP_RIPEMD160: number;
  OP_SHA1: number;
  OP_SHA256: number;
  OP_HASH160: number;
  OP_HASH256: number;
  OP_CODESEPARATOR: number;
  OP_CHECKSIG: number;
  OP_CHECKSIGVERIFY: number;
  OP_CHECKMULTISIG: number;
  OP_CHECKMULTISIGVERIFY: number;
  OP_CHECKLOCKTIMEVERIFY: number;
  OP_CHECKSEQUENCEVERIFY: number;

  OP_CHECKSIGADD: number;

  // expansion
  OP_NOP1: number;
  OP_NOP2: number;
  OP_NOP3: number;
  OP_NOP4: number;
  OP_NOP5: number;
  OP_NOP6: number;
  OP_NOP7: number;
  OP_NOP8: number;
  OP_NOP9: number;
  OP_NOP10: number;

  // template matching params
  OP_PUBKEYHASH: number;
  OP_PUBKEY: number;
  OP_INVALIDOPCODE: number;
}

const OPS: Opcodes = {
  OP_FALSE: 0,
  OP_0: 0,
  OP_PUSHDATA1: 76,
  OP_PUSHDATA2: 77,
  OP_PUSHDATA4: 78,
  OP_1NEGATE: 79,
  OP_RESERVED: 80,
  OP_TRUE: 81,
  OP_1: 81,
  OP_2: 82,
  OP_3: 83,
  OP_4: 84,
  OP_5: 85,
  OP_6: 86,
  OP_7: 87,
  OP_8: 88,
  OP_9: 89,
  OP_10: 90,
  OP_11: 91,
  OP_12: 92,
  OP_13: 93,
  OP_14: 94,
  OP_15: 95,
  OP_16: 96,

  OP_NOP: 97,
  OP_VER: 98,
  OP_IF: 99,
  OP_NOTIF: 100,
  OP_VERIF: 101,
  OP_VERNOTIF: 102,
  OP_ELSE: 103,
  OP_ENDIF: 104,
  OP_VERIFY: 105,
  OP_RETURN: 106,

  OP_TOALTSTACK: 107,
  OP_FROMALTSTACK: 108,
  OP_2DROP: 109,
  OP_2DUP: 110,
  OP_3DUP: 111,
  OP_2OVER: 112,
  OP_2ROT: 113,
  OP_2SWAP: 114,
  OP_IFDUP: 115,
  OP_DEPTH: 116,
  OP_DROP: 117,
  OP_DUP: 118,
  OP_NIP: 119,
  OP_OVER: 120,
  OP_PICK: 121,
  OP_ROLL: 122,
  OP_ROT: 123,
  OP_SWAP: 124,
  OP_TUCK: 125,

  OP_CAT: 126,
  OP_SUBSTR: 127,
  OP_LEFT: 128,
  OP_RIGHT: 129,
  OP_SIZE: 130,

  OP_INVERT: 131,
  OP_AND: 132,
  OP_OR: 133,
  OP_XOR: 134,
  OP_EQUAL: 135,
  OP_EQUALVERIFY: 136,
  OP_RESERVED1: 137,
  OP_RESERVED2: 138,

  OP_1ADD: 139,
  OP_1SUB: 140,
  OP_2MUL: 141,
  OP_2DIV: 142,
  OP_NEGATE: 143,
  OP_ABS: 144,
  OP_NOT: 145,
  OP_0NOTEQUAL: 146,
  OP_ADD: 147,
  OP_SUB: 148,
  OP_MUL: 149,
  OP_DIV: 150,
  OP_MOD: 151,
  OP_LSHIFT: 152,
  OP_RSHIFT: 153,

  OP_BOOLAND: 154,
  OP_BOOLOR: 155,
  OP_NUMEQUAL: 156,
  OP_NUMEQUALVERIFY: 157,
  OP_NUMNOTEQUAL: 158,
  OP_LESSTHAN: 159,
  OP_GREATERTHAN: 160,
  OP_LESSTHANOREQUAL: 161,
  OP_GREATERTHANOREQUAL: 162,
  OP_MIN: 163,
  OP_MAX: 164,

  OP_WITHIN: 165,

  OP_RIPEMD160: 166,
  OP_SHA1: 167,
  OP_SHA256: 168,
  OP_HASH160: 169,
  OP_HASH256: 170,
  OP_CODESEPARATOR: 171,
  OP_CHECKSIG: 172,
  OP_CHECKSIGVERIFY: 173,
  OP_CHECKMULTISIG: 174,
  OP_CHECKMULTISIGVERIFY: 175,

  OP_NOP1: 176,

  OP_NOP2: 177,
  OP_CHECKLOCKTIMEVERIFY: 177,

  OP_NOP3: 178,
  OP_CHECKSEQUENCEVERIFY: 178,

  OP_NOP4: 179,
  OP_NOP5: 180,
  OP_NOP6: 181,
  OP_NOP7: 182,
  OP_NOP8: 183,
  OP_NOP9: 184,
  OP_NOP10: 185,

  OP_CHECKSIGADD: 186,

  OP_PUBKEYHASH: 253,
  OP_PUBKEY: 254,
  OP_INVALIDOPCODE: 255,
};

const REVERSE_OPS: { [key: number]: string } = {};
for (const op of Object.keys(OPS)) {
  const code = OPS[op as keyof Opcodes];
  REVERSE_OPS[code] = op;
}

export { OPS, REVERSE_OPS };
