module.exports = {
  "valid": [
    {
      "dec": "1",
      "hex": "01",
      "hexPadded": "0000000000000000000000000000000000000000000000000000000000000001"
    },
    {
      "dec": "158798437896437949616241483468158498679",
      "hex": "77777777777777777777777777777777",
      "hexPadded": "0000000000000000000000000000000077777777777777777777777777777777"
    },
    {
      "dec": "115792089237316195423570985008687907852837564279074904382605163141518161494336",
      "hex": "fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364140",
      "hexPadded": "fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364140"
    },
    {
      "dec": "48968302285117906840285529799176770990048954789747953886390402978935544927851",
      "hex": "6c4313b03f2e7324d75e642f0ab81b734b724e13fec930f309e222470236d66b",
      "hexPadded": "6c4313b03f2e7324d75e642f0ab81b734b724e13fec930f309e222470236d66b"
    }
  ],
  "invalid": [
    {
      "description": "non-hex string",
      "string": "invalid"
    },
    {
      "description": "non-hex alphabet",
      "string": "c2F0b3NoaQo="
    },
    {
      "description": "internal whitespace",
      "string": "11111 11111"
    },
    {
      "description": "leading whitespace",
      "string": " 1111111111"
    },
    {
      "description": "trailing whitespace",
      "string": "1111111111 "
    }
  ]
}
