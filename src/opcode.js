var Opcode = function (num) {
  this.code = num;
};

Opcode.prototype.toString = function () {
  return Opcode.reverseMap[this.code];
};

Opcode.map = {
  // push value
  OP_0         : 0,
  OP_FALSE     : 0,
  OP_PUSHDATA1 : 76,
  OP_PUSHDATA2 : 77,
  OP_PUSHDATA4 : 78,
  OP_1NEGATE   : 79,
  OP_RESERVED  : 80,
  OP_1         : 81,
  OP_TRUE      : 81,
  OP_2         : 82,
  OP_3         : 83,
  OP_4         : 84,
  OP_5         : 85,
  OP_6         : 86,
  OP_7         : 87,
  OP_8         : 88,
  OP_9         : 89,
  OP_10        : 90,
  OP_11        : 91,
  OP_12        : 92,
  OP_13        : 93,
  OP_14        : 94,
  OP_15        : 95,
  OP_16        : 96,

  // control
  OP_NOP       : 97,
  OP_VER       : 98,
  OP_IF        : 99,
  OP_NOTIF     : 100,
  OP_VERIF     : 101,
  OP_VERNOTIF  : 102,
  OP_ELSE      : 103,
  OP_ENDIF     : 104,
  OP_VERIFY    : 105,
  OP_RETURN    : 106,

  // stack ops
  OP_TOALTSTACK   : 107,
  OP_FROMALTSTACK : 108,
  OP_2DROP        : 109,
  OP_2DUP         : 110,
  OP_3DUP         : 111,
  OP_2OVER        : 112,
  OP_2ROT         : 113,
  OP_2SWAP        : 114,
  OP_IFDUP        : 115,
  OP_DEPTH        : 116,
  OP_DROP         : 117,
  OP_DUP          : 118,
  OP_NIP          : 119,
  OP_OVER         : 120,
  OP_PICK         : 121,
  OP_ROLL         : 122,
  OP_ROT          : 123,
  OP_SWAP         : 124,
  OP_TUCK         : 125,

  // splice ops
  OP_CAT          : 126,
  OP_SUBSTR       : 127,
  OP_LEFT         : 128,
  OP_RIGHT        : 129,
  OP_SIZE         : 130,

  // bit logic
  OP_INVERT       : 131,
  OP_AND          : 132,
  OP_OR           : 133,
  OP_XOR          : 134,
  OP_EQUAL        : 135,
  OP_EQUALVERIFY  : 136,
  OP_RESERVED1    : 137,
  OP_RESERVED2    : 138,

  // numeric
  OP_1ADD         : 139,
  OP_1SUB         : 140,
  OP_2MUL         : 141,
  OP_2DIV         : 142,
  OP_NEGATE       : 143,
  OP_ABS          : 144,
  OP_NOT          : 145,
  OP_0NOTEQUAL    : 146,

  OP_ADD          : 147,
  OP_SUB          : 148,
  OP_MUL          : 149,
  OP_DIV          : 150,
  OP_MOD          : 151,
  OP_LSHIFT       : 152,
  OP_RSHIFT       : 153,

  OP_BOOLAND             : 154,
  OP_BOOLOR              : 155,
  OP_NUMEQUAL            : 156,
  OP_NUMEQUALVERIFY      : 157,
  OP_NUMNOTEQUAL         : 158,
  OP_LESSTHAN            : 159,
  OP_GREATERTHAN         : 160,
  OP_LESSTHANOREQUAL     : 161,
  OP_GREATERTHANOREQUAL  : 162,
  OP_MIN                 : 163,
  OP_MAX                 : 164,

  OP_WITHIN              : 165,

  // crypto
  OP_RIPEMD160           : 166,
  OP_SHA1                : 167,
  OP_SHA256              : 168,
  OP_HASH160             : 169,
  OP_HASH256             : 170,
  OP_CODESEPARATOR       : 171,
  OP_CHECKSIG            : 172,
  OP_CHECKSIGVERIFY      : 173,
  OP_CHECKMULTISIG       : 174,
  OP_CHECKMULTISIGVERIFY : 175,

  // expansion
  OP_NOP1  : 176,
  OP_NOP2  : 177,
  OP_NOP3  : 178,
  OP_NOP4  : 179,
  OP_NOP5  : 180,
  OP_NOP6  : 181,
  OP_NOP7  : 182,
  OP_NOP8  : 183,
  OP_NOP9  : 184,
  OP_NOP10 : 185,

  // template matching params
  OP_PUBKEYHASH    : 253,
  OP_PUBKEY        : 254,
  OP_INVALIDOPCODE : 255
};

Opcode.reverseMap = [];

for (var i in Opcode.map) {
  Opcode.reverseMap[Opcode.map[i]] = i;
}

module.exports = Opcode;
