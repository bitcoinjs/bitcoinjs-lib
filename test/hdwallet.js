var HDWallet = require('../src/hdwallet.js')
var assert = require('assert')
var convert = require('../src/convert.js')
var Network = require('../src/network')
var mainnet = Network.mainnet.addressVersion
var testnet = Network.testnet.addressVersion

var b2h = convert.bytesToHex

describe('HDWallet', function() {
  describe('toBase58', function() {
    it('reproduces input', function() {
      var input = 'xpub6D4BDPcP2GT577Vvch3R8wDkScZWzQzMMUm3PWbmWvVJrZwQY4VUNgqFJPMM3No2dFDFGTsxxpG5uJh7n7epu4trkrX7x7DogT5Uv6fcLW5'
      var output = HDWallet.fromBase58(input).toBase58(false)
      assert.equal(output, input)

      input = 'xprvA2JDeKCSNNZky6uBCviVfJSKyQ1mDYahRjijr5idH2WwLsEd4Hsb2Tyh8RfQMuPh7f7RtyzTtdrbdqqsunu5Mm3wDvUAKRHSC34sJ7in334'
      output = HDWallet.fromBase58(input).toBase58(true)
      assert.equal(output, input)
    })

    it('fails with priv=true when theres no private key', function() {
      var hd = HDWallet.fromBase58('xpub6DF8uhdarytz3FWdA8TvFSvvAh8dP3283MY7p2V4SeE2wyWmG5mg5EwVvmdMVCQcoNJxGoWaU9DCWh89LojfZ537wTfunKau47EL2dhHKon')
      try {
        hd.toBase58(true)
      } catch(e) {
        assert(e.message.match(/private key/i))
        return
      }
      assert.fail()
    })
  })

  describe('constructor & seed deserialization', function() {
    var expectedPrivateKey = '0fd71c652e847ba7ea7956e3cf3fc0a0985871846b1b2c23b9c6a29a38cee86001'
    var seed = [
      99, 114, 97, 122, 121, 32, 104, 111, 114, 115, 101, 32, 98,
      97, 116, 116, 101, 114, 121, 32, 115, 116, 97, 112, 108, 101
    ]

    it('creates from binary seed', function() {
      var hd = new HDWallet(seed)

      assert.equal(hd.priv.toHex(), expectedPrivateKey)
      assert(hd.pub)
    })

    describe('fromSeedHex', function() {
      it('creates from hex seed', function() {
        var hd = HDWallet.fromSeedHex(b2h(seed))

        assert.equal(hd.priv.toHex(), expectedPrivateKey)
        assert(hd.pub)
      })
    })

    describe('fromSeedString', function() {
      it('creates from string seed', function() {
        var hd = HDWallet.fromSeedString(convert.bytesToString(seed))

        assert.equal(hd.priv.toHex(), expectedPrivateKey)
        assert(hd.pub)
      })
    })
  })

  describe('Test vectors', function() {
    it('Test vector 1', function() {
      var hd = HDWallet.fromSeedHex('000102030405060708090a0b0c0d0e0f')

      // m
      assert.equal(b2h(hd.getIdentifier()), '3442193e1bb70916e914552172cd4e2dbc9df811')
      assert.equal(b2h(hd.getFingerprint()), '3442193e')
      assert.equal(hd.getAddress().toString(), '15mKKb2eos1hWa6tisdPwwDC1a5J1y9nma')
      assert.equal(hd.priv.toHex(), 'e8f32e723decf4051aefac8e2c93c9c5b214313817cdb01a1494b917c8436b3501')
      assert.equal(hd.priv.toWif(), 'L52XzL2cMkHxqxBXRyEpnPQZGUs3uKiL3R11XbAdHigRzDozKZeW')
      assert.equal(hd.pub.toHex(), '0339a36013301597daef41fbe593a02cc513d0b55527ec2df1050e2e8ff49c85c2')
      assert.equal(b2h(hd.chaincode), '873dff81c02f525623fd1fe5167eac3a55a049de3d314bb42ee227ffed37d508')
      assert.equal(hd.toHex(false), '0488b21e000000000000000000873dff81c02f525623fd1fe5167eac3a55a049de3d314bb42ee227ffed37d5080339a36013301597daef41fbe593a02cc513d0b55527ec2df1050e2e8ff49c85c2')
      assert.equal(hd.toHex(true), '0488ade4000000000000000000873dff81c02f525623fd1fe5167eac3a55a049de3d314bb42ee227ffed37d50800e8f32e723decf4051aefac8e2c93c9c5b214313817cdb01a1494b917c8436b35')
      assert.equal(hd.toBase58(false), 'xpub661MyMwAqRbcFtXgS5sYJABqqG9YLmC4Q1Rdap9gSE8NqtwybGhePY2gZ29ESFjqJoCu1Rupje8YtGqsefD265TMg7usUDFdp6W1EGMcet8')
      assert.equal(hd.toBase58(true), 'xprv9s21ZrQH143K3QTDL4LXw2F7HEK3wJUD2nW2nRk4stbPy6cq3jPPqjiChkVvvNKmPGJxWUtg6LnF5kejMRNNU3TGtRBeJgk33yuGBxrMPHi')

      // m/0'
      hd = hd.derivePrivate(0)
      assert.equal(b2h(hd.getIdentifier()), '5c1bd648ed23aa5fd50ba52b2457c11e9e80a6a7')
      assert.equal(b2h(hd.getFingerprint()), '5c1bd648')
      assert.equal(hd.getAddress().toString(), '19Q2WoS5hSS6T8GjhK8KZLMgmWaq4neXrh')
      assert.equal(hd.priv.toHex().slice(0, 64), 'edb2e14f9ee77d26dd93b4ecede8d16ed408ce149b6cd80b0715a2d911a0afea')
      assert.equal(hd.priv.toWif(), 'L5BmPijJjrKbiUfG4zbiFKNqkvuJ8usooJmzuD7Z8dkRoTThYnAT')
      assert.equal(hd.pub.toHex(), '035a784662a4a20a65bf6aab9ae98a6c068a81c52e4b032c0fb5400c706cfccc56')
      assert.equal(b2h(hd.chaincode), '47fdacbd0f1097043b78c63c20c34ef4ed9a111d980047ad16282c7ae6236141')
      assert.equal(hd.toHex(false), '0488b21e013442193e8000000047fdacbd0f1097043b78c63c20c34ef4ed9a111d980047ad16282c7ae6236141035a784662a4a20a65bf6aab9ae98a6c068a81c52e4b032c0fb5400c706cfccc56')
      assert.equal(hd.toHex(true), '0488ade4013442193e8000000047fdacbd0f1097043b78c63c20c34ef4ed9a111d980047ad16282c7ae623614100edb2e14f9ee77d26dd93b4ecede8d16ed408ce149b6cd80b0715a2d911a0afea')
      assert.equal(hd.toBase58(false), 'xpub68Gmy5EdvgibQVfPdqkBBCHxA5htiqg55crXYuXoQRKfDBFA1WEjWgP6LHhwBZeNK1VTsfTFUHCdrfp1bgwQ9xv5ski8PX9rL2dZXvgGDnw')
      assert.equal(hd.toBase58(true), 'xprv9uHRZZhk6KAJC1avXpDAp4MDc3sQKNxDiPvvkX8Br5ngLNv1TxvUxt4cV1rGL5hj6KCesnDYUhd7oWgT11eZG7XnxHrnYeSvkzY7d2bhkJ7')

      // m/0'/1
      hd = hd.derive(1)
      assert.equal(b2h(hd.getIdentifier()), 'bef5a2f9a56a94aab12459f72ad9cf8cf19c7bbe')
      assert.equal(b2h(hd.getFingerprint()), 'bef5a2f9')
      assert.equal(hd.getAddress().toString(), '1JQheacLPdM5ySCkrZkV66G2ApAXe1mqLj')
      assert.equal(hd.priv.toHex().slice(0, 64), '3c6cb8d0f6a264c91ea8b5030fadaa8e538b020f0a387421a12de9319dc93368')
      assert.equal(hd.priv.toWif(), 'KyFAjQ5rgrKvhXvNMtFB5PCSKUYD1yyPEe3xr3T34TZSUHycXtMM')
      assert.equal(hd.pub.toHex(), '03501e454bf00751f24b1b489aa925215d66af2234e3891c3b21a52bedb3cd711c')
      assert.equal(b2h(hd.chaincode), '2a7857631386ba23dacac34180dd1983734e444fdbf774041578e9b6adb37c19')
      assert.equal(hd.toHex(false), '0488b21e025c1bd648000000012a7857631386ba23dacac34180dd1983734e444fdbf774041578e9b6adb37c1903501e454bf00751f24b1b489aa925215d66af2234e3891c3b21a52bedb3cd711c')
      assert.equal(hd.toHex(true), '0488ade4025c1bd648000000012a7857631386ba23dacac34180dd1983734e444fdbf774041578e9b6adb37c19003c6cb8d0f6a264c91ea8b5030fadaa8e538b020f0a387421a12de9319dc93368')
      assert.equal(hd.toBase58(false), 'xpub6ASuArnXKPbfEwhqN6e3mwBcDTgzisQN1wXN9BJcM47sSikHjJf3UFHKkNAWbWMiGj7Wf5uMash7SyYq527Hqck2AxYysAA7xmALppuCkwQ')
      assert.equal(hd.toBase58(true), 'xprv9wTYmMFdV23N2TdNG573QoEsfRrWKQgWeibmLntzniatZvR9BmLnvSxqu53Kw1UmYPxLgboyZQaXwTCg8MSY3H2EU4pWcQDnRnrVA1xe8fs')

      // m/0'/1/2'
      hd = hd.derivePrivate(2)
      assert.equal(b2h(hd.getIdentifier()), 'ee7ab90cde56a8c0e2bb086ac49748b8db9dce72')
      assert.equal(b2h(hd.getFingerprint()), 'ee7ab90c')
      assert.equal(hd.getAddress().toString(), '1NjxqbA9aZWnh17q1UW3rB4EPu79wDXj7x')
      assert.equal(hd.priv.toHex().slice(0, 64), 'cbce0d719ecf7431d88e6a89fa1483e02e35092af60c042b1df2ff59fa424dca')
      assert.equal(hd.priv.toWif(), 'L43t3od1Gh7Lj55Bzjj1xDAgJDcL7YFo2nEcNaMGiyRZS1CidBVU')
      assert.equal(hd.pub.toHex(), '0357bfe1e341d01c69fe5654309956cbea516822fba8a601743a012a7896ee8dc2')
      assert.equal(b2h(hd.chaincode), '04466b9cc8e161e966409ca52986c584f07e9dc81f735db683c3ff6ec7b1503f')
      assert.equal(hd.toHex(false), '0488b21e03bef5a2f98000000204466b9cc8e161e966409ca52986c584f07e9dc81f735db683c3ff6ec7b1503f0357bfe1e341d01c69fe5654309956cbea516822fba8a601743a012a7896ee8dc2')
      assert.equal(hd.toHex(true), '0488ade403bef5a2f98000000204466b9cc8e161e966409ca52986c584f07e9dc81f735db683c3ff6ec7b1503f00cbce0d719ecf7431d88e6a89fa1483e02e35092af60c042b1df2ff59fa424dca')
      assert.equal(hd.toBase58(false), 'xpub6D4BDPcP2GT577Vvch3R8wDkScZWzQzMMUm3PWbmWvVJrZwQY4VUNgqFJPMM3No2dFDFGTsxxpG5uJh7n7epu4trkrX7x7DogT5Uv6fcLW5')
      assert.equal(hd.toBase58(true), 'xprv9z4pot5VBttmtdRTWfWQmoH1taj2axGVzFqSb8C9xaxKymcFzXBDptWmT7FwuEzG3ryjH4ktypQSAewRiNMjANTtpgP4mLTj34bhnZX7UiM')

      // m/0'/1/2'/2
      hd = hd.derive(2)
      assert.equal(b2h(hd.getIdentifier()), 'd880d7d893848509a62d8fb74e32148dac68412f')
      assert.equal(b2h(hd.getFingerprint()), 'd880d7d8')
      assert.equal(hd.getAddress().toString(), '1LjmJcdPnDHhNTUgrWyhLGnRDKxQjoxAgt')
      assert.equal(hd.priv.toHex().slice(0, 64), '0f479245fb19a38a1954c5c7c0ebab2f9bdfd96a17563ef28a6a4b1a2a764ef4')
      assert.equal(hd.priv.toWif(), 'KwjQsVuMjbCP2Zmr3VaFaStav7NvevwjvvkqrWd5Qmh1XVnCteBR')
      assert.equal(hd.pub.toHex(), '02e8445082a72f29b75ca48748a914df60622a609cacfce8ed0e35804560741d29')
      assert.equal(b2h(hd.chaincode), 'cfb71883f01676f587d023cc53a35bc7f88f724b1f8c2892ac1275ac822a3edd')
      assert.equal(hd.toHex(false), '0488b21e04ee7ab90c00000002cfb71883f01676f587d023cc53a35bc7f88f724b1f8c2892ac1275ac822a3edd02e8445082a72f29b75ca48748a914df60622a609cacfce8ed0e35804560741d29')
      assert.equal(hd.toHex(true), '0488ade404ee7ab90c00000002cfb71883f01676f587d023cc53a35bc7f88f724b1f8c2892ac1275ac822a3edd000f479245fb19a38a1954c5c7c0ebab2f9bdfd96a17563ef28a6a4b1a2a764ef4')
      assert.equal(hd.toBase58(false), 'xpub6FHa3pjLCk84BayeJxFW2SP4XRrFd1JYnxeLeU8EqN3vDfZmbqBqaGJAyiLjTAwm6ZLRQUMv1ZACTj37sR62cfN7fe5JnJ7dh8zL4fiyLHV')
      assert.equal(hd.toBase58(true), 'xprvA2JDeKCSNNZky6uBCviVfJSKyQ1mDYahRjijr5idH2WwLsEd4Hsb2Tyh8RfQMuPh7f7RtyzTtdrbdqqsunu5Mm3wDvUAKRHSC34sJ7in334')

      // m/0'/1/2'/2/1000000000
      hd = hd.derive(1000000000)
      assert.equal(b2h(hd.getIdentifier()), 'd69aa102255fed74378278c7812701ea641fdf32')
      assert.equal(b2h(hd.getFingerprint()), 'd69aa102')
      assert.equal(hd.getAddress().toString(), '1LZiqrop2HGR4qrH1ULZPyBpU6AUP49Uam')
      assert.equal(hd.priv.toHex().slice(0, 64), '471b76e389e528d6de6d816857e012c5455051cad6660850e58372a6c3e6e7c8')
      assert.equal(hd.priv.toWif(), 'Kybw8izYevo5xMh1TK7aUr7jHFCxXS1zv8p3oqFz3o2zFbhRXHYs')
      assert.equal(hd.pub.toHex(), '022a471424da5e657499d1ff51cb43c47481a03b1e77f951fe64cec9f5a48f7011')
      assert.equal(b2h(hd.chaincode), 'c783e67b921d2beb8f6b389cc646d7263b4145701dadd2161548a8b078e65e9e')
      assert.equal(hd.toHex(false), '0488b21e05d880d7d83b9aca00c783e67b921d2beb8f6b389cc646d7263b4145701dadd2161548a8b078e65e9e022a471424da5e657499d1ff51cb43c47481a03b1e77f951fe64cec9f5a48f7011')
      assert.equal(hd.toHex(true), '0488ade405d880d7d83b9aca00c783e67b921d2beb8f6b389cc646d7263b4145701dadd2161548a8b078e65e9e00471b76e389e528d6de6d816857e012c5455051cad6660850e58372a6c3e6e7c8')
      assert.equal(hd.toBase58(false), 'xpub6H1LXWLaKsWFhvm6RVpEL9P4KfRZSW7abD2ttkWP3SSQvnyA8FSVqNTEcYFgJS2UaFcxupHiYkro49S8yGasTvXEYBVPamhGW6cFJodrTHy')
      assert.equal(hd.toBase58(true), 'xprvA41z7zogVVwxVSgdKUHDy1SKmdb533PjDz7J6N6mV6uS3ze1ai8FHa8kmHScGpWmj4WggLyQjgPie1rFSruoUihUZREPSL39UNdE3BBDu76')
    })

    it('Test vector 2', function() {
      var hd = HDWallet.fromSeedHex('fffcf9f6f3f0edeae7e4e1dedbd8d5d2cfccc9c6c3c0bdbab7b4b1aeaba8a5a29f9c999693908d8a8784817e7b7875726f6c696663605d5a5754514e4b484542')

      // m
      assert.equal(b2h(hd.getIdentifier()), 'bd16bee53961a47d6ad888e29545434a89bdfe95')
      assert.equal(b2h(hd.getFingerprint()), 'bd16bee5')
      assert.equal(hd.getAddress().toString(), '1JEoxevbLLG8cVqeoGKQiAwoWbNYSUyYjg')
      assert.equal(hd.priv.toHex().slice(0, 64), '4b03d6fc340455b363f51020ad3ecca4f0850280cf436c70c727923f6db46c3e')
      assert.equal(hd.priv.toWif(), 'KyjXhyHF9wTphBkfpxjL8hkDXDUSbE3tKANT94kXSyh6vn6nKaoy')
      assert.equal(hd.pub.toHex(), '03cbcaa9c98c877a26977d00825c956a238e8dddfbd322cce4f74b0b5bd6ace4a7')
      assert.equal(b2h(hd.chaincode), '60499f801b896d83179a4374aeb7822aaeaceaa0db1f85ee3e904c4defbd9689')
      assert.equal(hd.toHex(false), '0488b21e00000000000000000060499f801b896d83179a4374aeb7822aaeaceaa0db1f85ee3e904c4defbd968903cbcaa9c98c877a26977d00825c956a238e8dddfbd322cce4f74b0b5bd6ace4a7')
      assert.equal(hd.toHex(true), '0488ade400000000000000000060499f801b896d83179a4374aeb7822aaeaceaa0db1f85ee3e904c4defbd9689004b03d6fc340455b363f51020ad3ecca4f0850280cf436c70c727923f6db46c3e')
      assert.equal(hd.toBase58(false), 'xpub661MyMwAqRbcFW31YEwpkMuc5THy2PSt5bDMsktWQcFF8syAmRUapSCGu8ED9W6oDMSgv6Zz8idoc4a6mr8BDzTJY47LJhkJ8UB7WEGuduB')
      assert.equal(hd.toBase58(true), 'xprv9s21ZrQH143K31xYSDQpPDxsXRTUcvj2iNHm5NUtrGiGG5e2DtALGdso3pGz6ssrdK4PFmM8NSpSBHNqPqm55Qn3LqFtT2emdEXVYsCzC2U')

      // m/0
      hd = hd.derive(0)
      assert.equal(b2h(hd.getIdentifier()), '5a61ff8eb7aaca3010db97ebda76121610b78096')
      assert.equal(b2h(hd.getFingerprint()), '5a61ff8e')
      assert.equal(hd.getAddress().toString(), '19EuDJdgfRkwCmRzbzVBHZWQG9QNWhftbZ')
      assert.equal(hd.priv.toHex().slice(0, 64), 'abe74a98f6c7eabee0428f53798f0ab8aa1bd37873999041703c742f15ac7e1e')
      assert.equal(hd.priv.toWif(), 'L2ysLrR6KMSAtx7uPqmYpoTeiRzydXBattRXjXz5GDFPrdfPzKbj')
      assert.equal(hd.pub.toHex(), '02fc9e5af0ac8d9b3cecfe2a888e2117ba3d089d8585886c9c826b6b22a98d12ea')
      assert.equal(b2h(hd.chaincode), 'f0909affaa7ee7abe5dd4e100598d4dc53cd709d5a5c2cac40e7412f232f7c9c')
      assert.equal(hd.toHex(false), '0488b21e01bd16bee500000000f0909affaa7ee7abe5dd4e100598d4dc53cd709d5a5c2cac40e7412f232f7c9c02fc9e5af0ac8d9b3cecfe2a888e2117ba3d089d8585886c9c826b6b22a98d12ea')
      assert.equal(hd.toHex(true), '0488ade401bd16bee500000000f0909affaa7ee7abe5dd4e100598d4dc53cd709d5a5c2cac40e7412f232f7c9c00abe74a98f6c7eabee0428f53798f0ab8aa1bd37873999041703c742f15ac7e1e')
      assert.equal(hd.toBase58(false), 'xpub69H7F5d8KSRgmmdJg2KhpAK8SR3DjMwAdkxj3ZuxV27CprR9LgpeyGmXUbC6wb7ERfvrnKZjXoUmmDznezpbZb7ap6r1D3tgFxHmwMkQTPH')
      assert.equal(hd.toBase58(true), 'xprv9vHkqa6EV4sPZHYqZznhT2NPtPCjKuDKGY38FBWLvgaDx45zo9WQRUT3dKYnjwih2yJD9mkrocEZXo1ex8G81dwSM1fwqWpWkeS3v86pgKt')

      // m/0/2147483647'
      hd = hd.derivePrivate(2147483647)
      assert.equal(b2h(hd.getIdentifier()), 'd8ab493736da02f11ed682f88339e720fb0379d1')
      assert.equal(b2h(hd.getFingerprint()), 'd8ab4937')
      assert.equal(hd.getAddress().toString(), '1Lke9bXGhn5VPrBuXgN12uGUphrttUErmk')
      assert.equal(hd.priv.toHex().slice(0, 64), '877c779ad9687164e9c2f4f0f4ff0340814392330693ce95a58fe18fd52e6e93')
      assert.equal(hd.priv.toWif(), 'L1m5VpbXmMp57P3knskwhoMTLdhAAaXiHvnGLMribbfwzVRpz2Sr')
      assert.equal(hd.pub.toHex(), '03c01e7425647bdefa82b12d9bad5e3e6865bee0502694b94ca58b666abc0a5c3b')
      assert.equal(b2h(hd.chaincode), 'be17a268474a6bb9c61e1d720cf6215e2a88c5406c4aee7b38547f585c9a37d9')
      assert.equal(hd.toHex(false), '0488b21e025a61ff8effffffffbe17a268474a6bb9c61e1d720cf6215e2a88c5406c4aee7b38547f585c9a37d903c01e7425647bdefa82b12d9bad5e3e6865bee0502694b94ca58b666abc0a5c3b')
      assert.equal(hd.toHex(true), '0488ade4025a61ff8effffffffbe17a268474a6bb9c61e1d720cf6215e2a88c5406c4aee7b38547f585c9a37d900877c779ad9687164e9c2f4f0f4ff0340814392330693ce95a58fe18fd52e6e93')
      assert.equal(hd.toBase58(false), 'xpub6ASAVgeehLbnwdqV6UKMHVzgqAG8Gr6riv3Fxxpj8ksbH9ebxaEyBLZ85ySDhKiLDBrQSARLq1uNRts8RuJiHjaDMBU4Zn9h8LZNnBC5y4a')
      assert.equal(hd.toBase58(true), 'xprv9wSp6B7kry3Vj9m1zSnLvN3xH8RdsPP1Mh7fAaR7aRLcQMKTR2vidYEeEg2mUCTAwCd6vnxVrcjfy2kRgVsFawNzmjuHc2YmYRmagcEPdU9')

      // m/0/2147483647'/1
      hd = hd.derive(1)
      assert.equal(b2h(hd.getIdentifier()), '78412e3a2296a40de124307b6485bd19833e2e34')
      assert.equal(b2h(hd.getFingerprint()), '78412e3a')
      assert.equal(hd.getAddress().toString(), '1BxrAr2pHpeBheusmd6fHDP2tSLAUa3qsW')
      assert.equal(hd.priv.toHex().slice(0, 64), '704addf544a06e5ee4bea37098463c23613da32020d604506da8c0518e1da4b7')
      assert.equal(hd.priv.toWif(), 'KzyzXnznxSv249b4KuNkBwowaN3akiNeEHy5FWoPCJpStZbEKXN2')
      assert.equal(hd.pub.toHex(), '03a7d1d856deb74c508e05031f9895dab54626251b3806e16b4bd12e781a7df5b9')
      assert.equal(b2h(hd.chaincode), 'f366f48f1ea9f2d1d3fe958c95ca84ea18e4c4ddb9366c336c927eb246fb38cb')
      assert.equal(hd.toHex(false), '0488b21e03d8ab493700000001f366f48f1ea9f2d1d3fe958c95ca84ea18e4c4ddb9366c336c927eb246fb38cb03a7d1d856deb74c508e05031f9895dab54626251b3806e16b4bd12e781a7df5b9')
      assert.equal(hd.toHex(true), '0488ade403d8ab493700000001f366f48f1ea9f2d1d3fe958c95ca84ea18e4c4ddb9366c336c927eb246fb38cb00704addf544a06e5ee4bea37098463c23613da32020d604506da8c0518e1da4b7')
      assert.equal(hd.toBase58(false), 'xpub6DF8uhdarytz3FWdA8TvFSvvAh8dP3283MY7p2V4SeE2wyWmG5mg5EwVvmdMVCQcoNJxGoWaU9DCWh89LojfZ537wTfunKau47EL2dhHKon')
      assert.equal(hd.toBase58(true), 'xprv9zFnWC6h2cLgpmSA46vutJzBcfJ8yaJGg8cX1e5StJh45BBciYTRXSd25UEPVuesF9yog62tGAQtHjXajPPdbRCHuWS6T8XA2ECKADdw4Ef')

      // m/0/2147483647'/1/2147483646'
      hd = hd.derivePrivate(2147483646)
      assert.equal(b2h(hd.getIdentifier()), '31a507b815593dfc51ffc7245ae7e5aee304246e')
      assert.equal(b2h(hd.getFingerprint()), '31a507b8')
      assert.equal(hd.getAddress().toString(), '15XVotxCAV7sRx1PSCkQNsGw3W9jT9A94R')
      assert.equal(hd.priv.toHex().slice(0, 64), 'f1c7c871a54a804afe328b4c83a1c33b8e5ff48f5087273f04efa83b247d6a2d')
      assert.equal(hd.priv.toWif(), 'L5KhaMvPYRW1ZoFmRjUtxxPypQ94m6BcDrPhqArhggdaTbbAFJEF')
      assert.equal(hd.pub.toHex(), '02d2b36900396c9282fa14628566582f206a5dd0bcc8d5e892611806cafb0301f0')
      assert.equal(b2h(hd.chaincode), '637807030d55d01f9a0cb3a7839515d796bd07706386a6eddf06cc29a65a0e29')
      assert.equal(hd.toHex(false), '0488b21e0478412e3afffffffe637807030d55d01f9a0cb3a7839515d796bd07706386a6eddf06cc29a65a0e2902d2b36900396c9282fa14628566582f206a5dd0bcc8d5e892611806cafb0301f0')
      assert.equal(hd.toHex(true), '0488ade40478412e3afffffffe637807030d55d01f9a0cb3a7839515d796bd07706386a6eddf06cc29a65a0e2900f1c7c871a54a804afe328b4c83a1c33b8e5ff48f5087273f04efa83b247d6a2d')
      assert.equal(hd.toBase58(false), 'xpub6ERApfZwUNrhLCkDtcHTcxd75RbzS1ed54G1LkBUHQVHQKqhMkhgbmJbZRkrgZw4koxb5JaHWkY4ALHY2grBGRjaDMzQLcgJvLJuZZvRcEL')
      assert.equal(hd.toBase58(true), 'xprvA1RpRA33e1JQ7ifknakTFpgNXPmW2YvmhqLQYMmrj4xJXXWYpDPS3xz7iAxn8L39njGVyuoseXzU6rcxFLJ8HFsTjSyQbLYnMpCqE2VbFWc')

      // Chain m/0/2147483647'/1/2147483646'/2
      hd = hd.derive(2)
      assert.equal(b2h(hd.getIdentifier()), '26132fdbe7bf89cbc64cf8dafa3f9f88b8666220')
      assert.equal(b2h(hd.getFingerprint()), '26132fdb')
      assert.equal(hd.getAddress().toString(), '14UKfRV9ZPUp6ZC9PLhqbRtxdihW9em3xt')
      assert.equal(hd.priv.toHex().slice(0, 64), 'bb7d39bdb83ecf58f2fd82b6d918341cbef428661ef01ab97c28a4842125ac23')
      assert.equal(hd.priv.toWif(), 'L3WAYNAZPxx1fr7KCz7GN9nD5qMBnNiqEJNJMU1z9MMaannAt4aK')
      assert.equal(hd.pub.toHex(), '024d902e1a2fc7a8755ab5b694c575fce742c48d9ff192e63df5193e4c7afe1f9c')
      assert.equal(b2h(hd.chaincode), '9452b549be8cea3ecb7a84bec10dcfd94afe4d129ebfd3b3cb58eedf394ed271')
      assert.equal(hd.toHex(false), '0488b21e0531a507b8000000029452b549be8cea3ecb7a84bec10dcfd94afe4d129ebfd3b3cb58eedf394ed271024d902e1a2fc7a8755ab5b694c575fce742c48d9ff192e63df5193e4c7afe1f9c')
      assert.equal(hd.toHex(true), '0488ade40531a507b8000000029452b549be8cea3ecb7a84bec10dcfd94afe4d129ebfd3b3cb58eedf394ed27100bb7d39bdb83ecf58f2fd82b6d918341cbef428661ef01ab97c28a4842125ac23')
      assert.equal(hd.toBase58(false), 'xpub6FnCn6nSzZAw5Tw7cgR9bi15UV96gLZhjDstkXXxvCLsUXBGXPdSnLFbdpq8p9HmGsApME5hQTZ3emM2rnY5agb9rXpVGyy3bdW6EEgAtqt')
      assert.equal(hd.toBase58(true), 'xprvA2nrNbFZABcdryreWet9Ea4LvTJcGsqrMzxHx98MMrotbir7yrKCEXw7nadnHM8Dq38EGfSh6dqA9QWTyefMLEcBYJUuekgW4BYPJcr9E7j')
    })
  })

  describe('network types', function() {
    it('ensures that a mainnet Wallet generates mainnet addresses', function() {
      var wallet = new HDWallet('foobar', 'mainnet')
      assert.equal(wallet.getAddress().toString(), '1JNymexJHEr5u1BndiChMStFkCgPm4EQ6o')
    })

    it('ensures that a testnet Wallet generates testnet addresses', function() {
      var wallet = new HDWallet('foobar', 'testnet')
      assert.equal(wallet.getAddress().toString(), 'mxtw4i3H6GHLg7fQMHB5BN6acCH6kQ7aoY')
    })

    it('throws an excption when unknown network type is passed in', function() {
      assert.throws(function() { new HDWallet("foobar", "doge") })
    })
  })
})
