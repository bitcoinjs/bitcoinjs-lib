module.exports = {
  valid: [
    {
      description: 'P2SH ScriptPubKey',
      hex: 'a914e8c300c87986efa84c37c0519929019ef86eb5b487',
      type: 'scripthash',
      hash: '0ba47b56a573bab4b430ad6ed3ec79270e04b066',
      scriptPubKey: true
    },
    {
      description: 'PubKeyHash ScriptPubKey',
      hex: '76a9145a3acbc7bbcc97c5ff16f5909c9d7d3fadb293a888ac',
      type: 'pubkeyhash',
      hash: 'a5313f33d5c7b81674b35f7f3febc3522ef234db',
      scriptPubKey: true
    },
    {
      description: 'pubKeyHash scriptSig',
      hex: '48304502206becda98cecf7a545d1a640221438ff8912d9b505ede67e0138485111099f696022100ccd616072501310acba10feb97cecc918e21c8e92760cd35144efec7622938f30141040cd2d2ce17a1e9b2b3b2cb294d40eecf305a25b7e7bfdafae6bb2639f4ee399b3637706c3d377ec4ab781355add443ae864b134c5e523001c442186ea60f0eb8',
      type: 'pubkeyhash',
      hash: 'b9bac2a5c5c29bb27c382d41fa3d179c646c78fd',
      scriptPubKey: false
    },
    {
      description: 'Valid multisig script',
      hex: '5121032487c2a32f7c8d57d2a93906a6457afd00697925b0e6e145d89af6d3bca330162102308673d16987eaa010e540901cc6fe3695e758c19f46ce604e174dac315e685a52ae',
      type: 'multisig',
      hash: 'f1c98f0b74ecabcf78ae20dfa224bb6666051fbe',
      scriptPubKey: true
    },
    {
      description: 'OP_RETURN script',
      hex:'6a2606deadbeef03f895a2ad89fb6d696497af486cb7c644a27aa568c7a18dd06113401115185474',
      type: 'nulldata',
      hash: 'ec88f016655477663455fe6a8e83508c348ea145',
      scriptPubKey: true
    },
    {
      description: 'Non standard script',
      hex: 'aa206fe28c0ab6f1b372c1a6a246ae63f74f931e8365e15a089c68d619000000000087',
      type: 'nonstandard',
      hash: '3823382e70d1930989813d3459988e0d7c2861d8',
      scriptPubKey: true
    },
    {
      description: 'Invalid multisig script',
      asm: '0 0 0 OP_CHECKmulTISIG',
      hex: '000000ae',
      type: 'nonstandard',
      hash: '62ede8963f9387544935f168745262f703dab1fb',
      scriptPubKey: true
    }
  ]
}
