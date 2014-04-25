module.exports = {
  "valid": [
    {
      "hex": "",
      "string": ""
    },
    {
      "hex": "61",
      "string": "2g"
    },
    {
      "hex": "626262",
      "string": "a3gV"
    },
    {
      "hex": "636363",
      "string": "aPEr"
    },
    {
      "hex": "73696d706c792061206c6f6e6720737472696e67",
      "string": "2cFupjhnEsSn59qHXstmK2ffpLv2"
    },
    {
      "hex": "00eb15231dfceb60925886b67d065299925915aeb172c06647",
      "string": "1NS17iag9jJgTHD1VXjvLCEnZuQ3rJDE9L"
    },
    {
      "hex": "516b6fcd0f",
      "string": "ABnLTmg"
    },
    {
      "hex": "bf4f89001e670274dd",
      "string": "3SEo3LWLoPntC"
    },
    {
      "hex": "572e4794",
      "string": "3EFU7m"
    },
    {
      "hex": "ecac89cad93923c02321",
      "string": "EJDM8drfXA6uyA"
    },
    {
      "hex": "10c8511e",
      "string": "Rt5zm"
    },
    {
      "hex": "00000000000000000000",
      "string": "1111111111"
    }
  ],
  "invalid": [
    {
      "description": "non-base58 string",
      "string": "invalid"
    },
    {
      "description": "non-base58 alphabet",
      "string": "c2F0b3NoaQo="
    },
    {
      "description": "leading whitespace",
      "string": " 1111111111"
    },
    {
      "description": "trailing whitespace",
      "string": "1111111111 "
    },
    {
      "description": "unexpected character after whitespace",
      "string": " \t\n\u000b\f\r skip \r\f\u000b\n\t a"
    }
  ]
}
