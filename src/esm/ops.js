// Define OPS enum
var OPS;
(function (OPS) {
  OPS[(OPS['OP_FALSE'] = 0)] = 'OP_FALSE';
  OPS[(OPS['OP_0'] = 0)] = 'OP_0';
  OPS[(OPS['OP_PUSHDATA1'] = 76)] = 'OP_PUSHDATA1';
  OPS[(OPS['OP_PUSHDATA2'] = 77)] = 'OP_PUSHDATA2';
  OPS[(OPS['OP_PUSHDATA4'] = 78)] = 'OP_PUSHDATA4';
  OPS[(OPS['OP_1NEGATE'] = 79)] = 'OP_1NEGATE';
  OPS[(OPS['OP_RESERVED'] = 80)] = 'OP_RESERVED';
  OPS[(OPS['OP_TRUE'] = 81)] = 'OP_TRUE';
  OPS[(OPS['OP_1'] = 81)] = 'OP_1';
  OPS[(OPS['OP_2'] = 82)] = 'OP_2';
  OPS[(OPS['OP_3'] = 83)] = 'OP_3';
  OPS[(OPS['OP_4'] = 84)] = 'OP_4';
  OPS[(OPS['OP_5'] = 85)] = 'OP_5';
  OPS[(OPS['OP_6'] = 86)] = 'OP_6';
  OPS[(OPS['OP_7'] = 87)] = 'OP_7';
  OPS[(OPS['OP_8'] = 88)] = 'OP_8';
  OPS[(OPS['OP_9'] = 89)] = 'OP_9';
  OPS[(OPS['OP_10'] = 90)] = 'OP_10';
  OPS[(OPS['OP_11'] = 91)] = 'OP_11';
  OPS[(OPS['OP_12'] = 92)] = 'OP_12';
  OPS[(OPS['OP_13'] = 93)] = 'OP_13';
  OPS[(OPS['OP_14'] = 94)] = 'OP_14';
  OPS[(OPS['OP_15'] = 95)] = 'OP_15';
  OPS[(OPS['OP_16'] = 96)] = 'OP_16';
  OPS[(OPS['OP_NOP'] = 97)] = 'OP_NOP';
  OPS[(OPS['OP_VER'] = 98)] = 'OP_VER';
  OPS[(OPS['OP_IF'] = 99)] = 'OP_IF';
  OPS[(OPS['OP_NOTIF'] = 100)] = 'OP_NOTIF';
  OPS[(OPS['OP_VERIF'] = 101)] = 'OP_VERIF';
  OPS[(OPS['OP_VERNOTIF'] = 102)] = 'OP_VERNOTIF';
  OPS[(OPS['OP_ELSE'] = 103)] = 'OP_ELSE';
  OPS[(OPS['OP_ENDIF'] = 104)] = 'OP_ENDIF';
  OPS[(OPS['OP_VERIFY'] = 105)] = 'OP_VERIFY';
  OPS[(OPS['OP_RETURN'] = 106)] = 'OP_RETURN';
  OPS[(OPS['OP_TOALTSTACK'] = 107)] = 'OP_TOALTSTACK';
  OPS[(OPS['OP_FROMALTSTACK'] = 108)] = 'OP_FROMALTSTACK';
  OPS[(OPS['OP_2DROP'] = 109)] = 'OP_2DROP';
  OPS[(OPS['OP_2DUP'] = 110)] = 'OP_2DUP';
  OPS[(OPS['OP_3DUP'] = 111)] = 'OP_3DUP';
  OPS[(OPS['OP_2OVER'] = 112)] = 'OP_2OVER';
  OPS[(OPS['OP_2ROT'] = 113)] = 'OP_2ROT';
  OPS[(OPS['OP_2SWAP'] = 114)] = 'OP_2SWAP';
  OPS[(OPS['OP_IFDUP'] = 115)] = 'OP_IFDUP';
  OPS[(OPS['OP_DEPTH'] = 116)] = 'OP_DEPTH';
  OPS[(OPS['OP_DROP'] = 117)] = 'OP_DROP';
  OPS[(OPS['OP_DUP'] = 118)] = 'OP_DUP';
  OPS[(OPS['OP_NIP'] = 119)] = 'OP_NIP';
  OPS[(OPS['OP_OVER'] = 120)] = 'OP_OVER';
  OPS[(OPS['OP_PICK'] = 121)] = 'OP_PICK';
  OPS[(OPS['OP_ROLL'] = 122)] = 'OP_ROLL';
  OPS[(OPS['OP_ROT'] = 123)] = 'OP_ROT';
  OPS[(OPS['OP_SWAP'] = 124)] = 'OP_SWAP';
  OPS[(OPS['OP_TUCK'] = 125)] = 'OP_TUCK';
  OPS[(OPS['OP_CAT'] = 126)] = 'OP_CAT';
  OPS[(OPS['OP_SUBSTR'] = 127)] = 'OP_SUBSTR';
  OPS[(OPS['OP_LEFT'] = 128)] = 'OP_LEFT';
  OPS[(OPS['OP_RIGHT'] = 129)] = 'OP_RIGHT';
  OPS[(OPS['OP_SIZE'] = 130)] = 'OP_SIZE';
  OPS[(OPS['OP_INVERT'] = 131)] = 'OP_INVERT';
  OPS[(OPS['OP_AND'] = 132)] = 'OP_AND';
  OPS[(OPS['OP_OR'] = 133)] = 'OP_OR';
  OPS[(OPS['OP_XOR'] = 134)] = 'OP_XOR';
  OPS[(OPS['OP_EQUAL'] = 135)] = 'OP_EQUAL';
  OPS[(OPS['OP_EQUALVERIFY'] = 136)] = 'OP_EQUALVERIFY';
  OPS[(OPS['OP_RESERVED1'] = 137)] = 'OP_RESERVED1';
  OPS[(OPS['OP_RESERVED2'] = 138)] = 'OP_RESERVED2';
  OPS[(OPS['OP_1ADD'] = 139)] = 'OP_1ADD';
  OPS[(OPS['OP_1SUB'] = 140)] = 'OP_1SUB';
  OPS[(OPS['OP_2MUL'] = 141)] = 'OP_2MUL';
  OPS[(OPS['OP_2DIV'] = 142)] = 'OP_2DIV';
  OPS[(OPS['OP_NEGATE'] = 143)] = 'OP_NEGATE';
  OPS[(OPS['OP_ABS'] = 144)] = 'OP_ABS';
  OPS[(OPS['OP_NOT'] = 145)] = 'OP_NOT';
  OPS[(OPS['OP_0NOTEQUAL'] = 146)] = 'OP_0NOTEQUAL';
  OPS[(OPS['OP_ADD'] = 147)] = 'OP_ADD';
  OPS[(OPS['OP_SUB'] = 148)] = 'OP_SUB';
  OPS[(OPS['OP_MUL'] = 149)] = 'OP_MUL';
  OPS[(OPS['OP_DIV'] = 150)] = 'OP_DIV';
  OPS[(OPS['OP_MOD'] = 151)] = 'OP_MOD';
  OPS[(OPS['OP_LSHIFT'] = 152)] = 'OP_LSHIFT';
  OPS[(OPS['OP_RSHIFT'] = 153)] = 'OP_RSHIFT';
  OPS[(OPS['OP_BOOLAND'] = 154)] = 'OP_BOOLAND';
  OPS[(OPS['OP_BOOLOR'] = 155)] = 'OP_BOOLOR';
  OPS[(OPS['OP_NUMEQUAL'] = 156)] = 'OP_NUMEQUAL';
  OPS[(OPS['OP_NUMEQUALVERIFY'] = 157)] = 'OP_NUMEQUALVERIFY';
  OPS[(OPS['OP_NUMNOTEQUAL'] = 158)] = 'OP_NUMNOTEQUAL';
  OPS[(OPS['OP_LESSTHAN'] = 159)] = 'OP_LESSTHAN';
  OPS[(OPS['OP_GREATERTHAN'] = 160)] = 'OP_GREATERTHAN';
  OPS[(OPS['OP_LESSTHANOREQUAL'] = 161)] = 'OP_LESSTHANOREQUAL';
  OPS[(OPS['OP_GREATERTHANOREQUAL'] = 162)] = 'OP_GREATERTHANOREQUAL';
  OPS[(OPS['OP_MIN'] = 163)] = 'OP_MIN';
  OPS[(OPS['OP_MAX'] = 164)] = 'OP_MAX';
  OPS[(OPS['OP_WITHIN'] = 165)] = 'OP_WITHIN';
  OPS[(OPS['OP_RIPEMD160'] = 166)] = 'OP_RIPEMD160';
  OPS[(OPS['OP_SHA1'] = 167)] = 'OP_SHA1';
  OPS[(OPS['OP_SHA256'] = 168)] = 'OP_SHA256';
  OPS[(OPS['OP_HASH160'] = 169)] = 'OP_HASH160';
  OPS[(OPS['OP_HASH256'] = 170)] = 'OP_HASH256';
  OPS[(OPS['OP_CODESEPARATOR'] = 171)] = 'OP_CODESEPARATOR';
  OPS[(OPS['OP_CHECKSIG'] = 172)] = 'OP_CHECKSIG';
  OPS[(OPS['OP_CHECKSIGVERIFY'] = 173)] = 'OP_CHECKSIGVERIFY';
  OPS[(OPS['OP_CHECKMULTISIG'] = 174)] = 'OP_CHECKMULTISIG';
  OPS[(OPS['OP_CHECKMULTISIGVERIFY'] = 175)] = 'OP_CHECKMULTISIGVERIFY';
  OPS[(OPS['OP_NOP1'] = 176)] = 'OP_NOP1';
  OPS[(OPS['OP_CHECKLOCKTIMEVERIFY'] = 177)] = 'OP_CHECKLOCKTIMEVERIFY';
  OPS[(OPS['OP_NOP2'] = 177)] = 'OP_NOP2';
  OPS[(OPS['OP_CHECKSEQUENCEVERIFY'] = 178)] = 'OP_CHECKSEQUENCEVERIFY';
  OPS[(OPS['OP_NOP3'] = 178)] = 'OP_NOP3';
  OPS[(OPS['OP_NOP4'] = 179)] = 'OP_NOP4';
  OPS[(OPS['OP_NOP5'] = 180)] = 'OP_NOP5';
  OPS[(OPS['OP_NOP6'] = 181)] = 'OP_NOP6';
  OPS[(OPS['OP_NOP7'] = 182)] = 'OP_NOP7';
  OPS[(OPS['OP_NOP8'] = 183)] = 'OP_NOP8';
  OPS[(OPS['OP_NOP9'] = 184)] = 'OP_NOP9';
  OPS[(OPS['OP_NOP10'] = 185)] = 'OP_NOP10';
  OPS[(OPS['OP_CHECKSIGADD'] = 186)] = 'OP_CHECKSIGADD';
  OPS[(OPS['OP_PUBKEYHASH'] = 253)] = 'OP_PUBKEYHASH';
  OPS[(OPS['OP_PUBKEY'] = 254)] = 'OP_PUBKEY';
  OPS[(OPS['OP_INVALIDOPCODE'] = 255)] = 'OP_INVALIDOPCODE';
})(OPS || (OPS = {}));
// Export modules
export { OPS, OPS as REVERSE_OPS };
