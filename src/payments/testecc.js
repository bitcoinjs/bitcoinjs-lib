'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.testEcc = void 0;
const h = hex => Buffer.from(hex, 'hex');
function testEcc(ecc) {
  assert(
    ecc.isXOnlyPoint(
      h('79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798'),
    ),
  );
  assert(
    ecc.isXOnlyPoint(
      h('fffffffffffffffffffffffffffffffffffffffffffffffffffffffeeffffc2e'),
    ),
  );
  assert(
    ecc.isXOnlyPoint(
      h('f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9'),
    ),
  );
  assert(
    ecc.isXOnlyPoint(
      h('0000000000000000000000000000000000000000000000000000000000000001'),
    ),
  );
  assert(
    !ecc.isXOnlyPoint(
      h('0000000000000000000000000000000000000000000000000000000000000000'),
    ),
  );
  assert(
    !ecc.isXOnlyPoint(
      h('fffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f'),
    ),
  );
  tweakAddVectors.forEach(t => {
    const r = ecc.xOnlyPointAddTweak(h(t.pubkey), h(t.tweak));
    if (t.result === null) {
      assert(r === null);
    } else {
      assert(r !== null);
      assert(r.parity === t.parity);
      assert(Buffer.from(r.xOnlyPubkey).equals(h(t.result)));
    }
  });
}
exports.testEcc = testEcc;
function assert(bool) {
  if (!bool) throw new Error('ecc library invalid');
}
const tweakAddVectors = [
  {
    pubkey: '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
    tweak: 'fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364140',
    parity: -1,
    result: null,
  },
  {
    pubkey: '1617d38ed8d8657da4d4761e8057bc396ea9e4b9d29776d4be096016dbd2509b',
    tweak: 'a8397a935f0dfceba6ba9618f6451ef4d80637abf4e6af2669fbc9de6a8fd2ac',
    parity: 1,
    result: 'e478f99dab91052ab39a33ea35fd5e6e4933f4d28023cd597c9a1f6760346adf',
  },
  {
    pubkey: '2f1b310f4c065331bc0d79ba4661bb9822d67d7c4a1b0a1892e1fd0cd23aa68d',
    tweak: '40ab636041bb695843ac7f220344565bed3b5dca919e256b7e31e19d69b36fad',
    parity: 1,
    result: '5786150f0ac36a2aaeb8d11aaeb7aa2d03ad63c528cc307a7cd5648c84041f34',
  },
  {
    pubkey: 'e7e9acacbdb43fc9fb71a8db1536c0f866caa78def49f666fa121a6f7954bb01',
    tweak: '1ad613216778a70490c8a681a4901d4ca880d76916deb69979b5ac52d2760e09',
    parity: 1,
    result: 'ae10fa880c85848cc1faf056f56a64b7d45c68838cfb308d03ca2be9b485c130',
  },
  {
    pubkey: '2c0b7cf95324a07d05398b240174dc0c2be444d96b159aa6c7f7b1e668680991',
    tweak: '823c3cd2142744b075a87eade7e1b8678ba308d566226a0056ca2b7a76f86b47',
    parity: 0,
    result: '9534f8dc8c6deda2dc007655981c78b49c5d96c778fbf363462a11ec9dfd948c',
  },
  {
    pubkey: '8f19ee7677713806c662078a9f2b2c7b930376d22f2d617bce50b5e444839a7c',
    tweak: '7df1f4b66058f8be34b6b7d17be9bcf35ba5c98edf8d4e763b95964bad655fe4',
    parity: 1,
    result: '74619a5990750928d0728817b02bb0d398062dad0e568f46ea5348d35bef914f',
  },
  {
    pubkey: '2bda68b3aa0239d382f185ca2d8c31ce604cc26220cef3eb65223f47a0088d87',
    tweak: 'e5a018b3a2e155316109d9cdc5eab739759c0e07e0c00bf9fccb8237fe4d7f02',
    parity: 0,
    result: '84479dc6bf70762721b10b89c8798e00d525507edc3fabbfc89ad915b6509379',
  },
  {
    pubkey: '9611ba340bce00a594f1ffb1294974af80e1301e49597378732fd77bbdedf454',
    tweak: 'bbb8ec1f063522953a4a9f90ff4e849560e0f0597458529ea13b8868f255c7c7',
    parity: 0,
    result: '30bebfdad18b87b646f60e51d3c45c6658fbb4364c94b1b33d925a4515b66757',
  },
  {
    pubkey: 'd9f5792078a845303c1f1ea88aec79ed0fd9f0c49e9e7bff2765877e79b4dd52',
    tweak: '531fe6068134503d2723133227c867ac8fa6c83c537e9a44c3c5bdbdcb1fe337',
    parity: 0,
    result: 'fe5dd39f0491af71711454eee5b6a9c99779c422dd97f5e7f75d7ce7be7b32f0',
  },
  {
    pubkey: '40ab636041bb695843ac7f220344565bed3b5dca919e256b7e31e19d69b36fad',
    tweak: '048968943184ce8a0239ab2141641e8eaead35a6dc8e6b55ad33ac1eca975a47',
    parity: 1,
    result: '6c8245a62201887c5e3aeb022fff06e6c110f3e58ad6d37cc20e877082b72c58',
  },
  {
    pubkey: '6aa3da9b5c1d61956076cb3014ffdaa0996bacdae29ba4b89e39b4088f86ec78',
    tweak: 'ff8adab52623bcb2717fc71d7edc6f55e98396e6c234dff01f307a12b2af1c99',
    parity: 1,
    result: 'd6080b5df61525fe8be31a823f3943e5fc9354d5a091b2dea195985c7c395787',
  },
  {
    pubkey: '24653eac434488002cc06bbfb7f10fe18991e35f9fe4302dbea6d2353dc0ab1c',
    tweak: '9e5f7dbe6d62ade5aab476b40559852ea1b5fc7bb99a61a42eab550f69ffafb4',
    parity: 0,
    result: '58289ee230fcf6a78cb9878cae5102cc9104490abab9d03f3eccc2f0cd07de5f',
  },
  {
    pubkey: 'e5a018b3a2e155316109d9cdc5eab739759c0e07e0c00bf9fccb8237fe4d7f02',
    tweak: 'bde750d93efe821813df9c15ee676f2e9c63386336c164f5a15cf240ac653c06',
    parity: 0,
    result: '9a1ae919c5c78da635d94a92b3053e46b2261b81ec70db82a382f5bff474bec4',
  },
  {
    pubkey: 'bc14bc97e2d818ee360a9ba7782bd6a6dfc2c1e335fffc584a095fdac5fea641',
    tweak: '4f355bdcb7cc0af728ef3cceb9615d90684bb5b2ca5f859ab0f0b704075871aa',
    parity: 1,
    result: '19a7416f4f95f36c5e48dc7630ffea8b292e1721cecfa9cc5f794c83973e41d6',
  },
  {
    pubkey: '35e9d7c48e3a5254d5881b60abf004cf6eedc6ab842393caa2fdd20d6d0ad170',
    tweak: '18bb586dc109adf49ffb42e0ac293d2a2965e49a0a4900c2be776b426b7cbfde',
    parity: 0,
    result: 'fa7cca72580bb686fbbae09ded801c7d109fa378f52e8a5f43a1922e442e44c1',
  },
  {
    pubkey: '67bff656551f25009ac8ed88664736c08074a15dbd2268292f5de7ca7e718338',
    tweak: 'b96359049e97f49d871e856f37e54d0978bae2cc936b4484d96df984cd20daa1',
    parity: 0,
    result: 'dd081d737da17fb4f6686f8497cac56b16ea06e1dc05859633f735fb304e7e5a',
  },
  {
    pubkey: '5b0da52533a1620fe947cb658c35e1772f39ef1253753493b7dc4b8d8f31f40e',
    tweak: '3d481f46056f2da27870a5d00c0c7bf484036780a83bbcc2e2da2f03bc33bff0',
    parity: 1,
    result: '164e13b54edc89673f94563120d87db4a47b12e49c40c195ac51ea7bc50f22e1',
  },
  {
    pubkey: '0612c5e8c98a9677a2ddd13770e26f5f1e771a088c88ce519a1e1b65872423f9',
    tweak: 'dbcfa1c73674cba4aa1b6992ebdc6a77008d38f6c6ec068c3c862b9ff6d287f2',
    parity: 0,
    result: '82fc6954352b7189a156e4678d0c315c122431fa9551961b8e3c811b55a42c8b',
  },
  {
    pubkey: '9ac20335eb38768d2052be1dbbc3c8f6178407458e51e6b4ad22f1d91758895b',
    tweak: '6aa3da9b5c1d61956076cb3014ffdaa0996bacdae29ba4b89e39b4088f86ec78',
    parity: 1,
    result: 'cf9065a7e2c9f909becc1c95f9884ed9fbe19c4a8954ed17880f02d94ae96a63',
  },
  {
    pubkey: 'c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5',
    tweak: 'fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd036413f',
    parity: -1,
    result: null,
  },
];
