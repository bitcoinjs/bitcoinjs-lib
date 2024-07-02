export interface Opcodes {
  readonly OP_FALSE: number;
  readonly OP_0: number;
  readonly OP_PUSHDATA1: number;
  readonly OP_PUSHDATA2: number;
  readonly OP_PUSHDATA4: number;
  readonly OP_1NEGATE: number;
  readonly OP_RESERVED: number;
  readonly OP_TRUE: number;
  readonly OP_1: number;
  readonly OP_2: number;
  readonly OP_3: number;
  readonly OP_4: number;
  readonly OP_5: number;
  readonly OP_6: number;
  readonly OP_7: number;
  readonly OP_8: number;
  readonly OP_9: number;
  readonly OP_10: number;
  readonly OP_11: number;
  readonly OP_12: number;
  readonly OP_13: number;
  readonly OP_14: number;
  readonly OP_15: number;
  readonly OP_16: number;

  // control
  readonly OP_NOP: number;
  readonly OP_VER: number;
  readonly OP_IF: number;
  readonly OP_NOTIF: number;
  readonly OP_VERIF: number;
  readonly OP_VERNOTIF: number;
  readonly OP_ELSE: number;
  readonly OP_ENDIF: number;
  readonly OP_VERIFY: number;
  readonly OP_RETURN: number;

  // stack ops
  readonly OP_TOALTSTACK: number;
  readonly OP_FROMALTSTACK: number;
  readonly OP_2DROP: number;
  readonly OP_2DUP: number;
  readonly OP_3DUP: number;
  readonly OP_2OVER: number;
  readonly OP_2ROT: number;
  readonly OP_2SWAP: number;
  readonly OP_IFDUP: number;
  readonly OP_DEPTH: number;
  readonly OP_DROP: number;
  readonly OP_DUP: number;
  readonly OP_NIP: number;
  readonly OP_OVER: number;
  readonly OP_PICK: number;
  readonly OP_ROLL: number;
  readonly OP_ROT: number;
  readonly OP_SWAP: number;
  readonly OP_TUCK: number;

  // splice ops
  readonly OP_CAT: number;
  readonly OP_SUBSTR: number;
  readonly OP_LEFT: number;
  readonly OP_RIGHT: number;
  readonly OP_SIZE: number;

  // bit logic
  readonly OP_INVERT: number;
  readonly OP_AND: number;
  readonly OP_OR: number;
  readonly OP_XOR: number;
  readonly OP_EQUAL: number;
  readonly OP_EQUALVERIFY: number;
  readonly OP_RESERVED1: number;
  readonly OP_RESERVED2: number;

  // numeric
  readonly OP_1ADD: number;
  readonly OP_1SUB: number;
  readonly OP_2MUL: number;
  readonly OP_2DIV: number;
  readonly OP_NEGATE: number;
  readonly OP_ABS: number;
  readonly OP_NOT: number;
  readonly OP_0NOTEQUAL: number;
  readonly OP_ADD: number;
  readonly OP_SUB: number;
  readonly OP_MUL: number;
  readonly OP_DIV: number;
  readonly OP_MOD: number;
  readonly OP_LSHIFT: number;
  readonly OP_RSHIFT: number;
  readonly OP_BOOLAND: number;
  readonly OP_BOOLOR: number;
  readonly OP_NUMEQUAL: number;
  readonly OP_NUMEQUALVERIFY: number;
  readonly OP_NUMNOTEQUAL: number;
  readonly OP_LESSTHAN: number;
  readonly OP_GREATERTHAN: number;
  readonly OP_LESSTHANOREQUAL: number;
  readonly OP_GREATERTHANOREQUAL: number;
  readonly OP_MIN: number;
  readonly OP_MAX: number;
  readonly OP_WITHIN: number;

  // crypto
  readonly OP_RIPEMD160: number;
  readonly OP_SHA1: number;
  readonly OP_SHA256: number;
  readonly OP_HASH160: number;
  readonly OP_HASH256: number;
  readonly OP_CODESEPARATOR: number;
  readonly OP_CHECKSIG: number;
  readonly OP_CHECKSIGVERIFY: number;
  readonly OP_CHECKMULTISIG: number;
  readonly OP_CHECKMULTISIGVERIFY: number;
  readonly OP_CHECKLOCKTIMEVERIFY: number;
  readonly OP_CHECKSEQUENCEVERIFY: number;

  readonly OP_CHECKSIGADD: number;

  // expansion
  readonly OP_NOP1: number;
  readonly OP_NOP2: number;
  readonly OP_NOP3: number;
  readonly OP_NOP4: number;
  readonly OP_NOP5: number;
  readonly OP_NOP6: number;
  readonly OP_NOP7: number;
  readonly OP_NOP8: number;
  readonly OP_NOP9: number;
  readonly OP_NOP10: number;

  // template matching params
  readonly OP_PUBKEYHASH: number;
  readonly OP_PUBKEY: number;
  readonly OP_INVALIDOPCODE: number;
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

type ReverseOpcodes = {
  [K in keyof Opcodes as Opcodes[K]]: K;
};

const REVERSE_OPS: ReverseOpcodes = Object.fromEntries(
  Object.entries(OPS).map(([key, value]) => [value, key])
) as ReverseOpcodes;

export { OPS, REVERSE_OPS };
