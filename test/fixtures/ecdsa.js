// Test Vectors for RFC 6979 ECDSA, secp256k1, SHA-256
module.exports = [
  {
    "privateKey": "0000000000000000000000000000000000000000000000000000000000000001",
    "k": "8f8a276c19f4149656b280621e358cce24f5f52542772691ee69063b74f15d15",
    "message": "Satoshi Nakamoto",
    "signature": "934b1ea10a4b3c1757e2b0c017d0b6143ce3c9a7e6a4a49860d7a6ab210ee3d82442ce9d2b916064108014783e923ec36b49743e2ffa1c4496f01a512aafd9e5"
  },
  {
    "privateKey": "0000000000000000000000000000000000000000000000000000000000000001",
    "k": "38aa22d72376b4dbc472e06c3ba403ee0a394da63fc58d88686c611aba98d6b3",
    "message": "All those moments will be lost in time, like tears in rain. Time to die...",
    "signature": "8600dbd41e348fe5c9465ab92d23e3db8b98b873beecd930736488696438cb6b547fe64427496db33bf66019dacbf0039c04199abb0122918601db38a72cfc21"
  },
  {
    "privateKey": "FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364140",
    "k": "33a19b60e25fb6f4435af53a3d42d493644827367e6453928554f43e49aa6f90",
    "message": "Satoshi Nakamoto",
    "signature": "fd567d121db66e382991534ada77a6bd3106f0a1098c231e47993447cd6af2d06b39cd0eb1bc8603e159ef5c20a5c8ad685a45b06ce9bebed3f153d10d93bed5"
  },
  {
    "privateKey": "f8b8af8ce3c7cca5e300d33939540c10d45ce001b8f252bfbc57ba0342904181",
    "k": "525a82b70e67874398067543fd84c83d30c175fdc45fdeee082fe13b1d7cfdf1",
    "message": "Alan Turing",
    "signature": "7063ae83e7f62bbb171798131b4a0564b956930092b33b07b395615d9ec7e15c58dfcc1e00a35e1572f366ffe34ba0fc47db1e7189759b9fb233c5b05ab388ea"
  },
  {
    "privateKey": "e91671c46231f833a6406ccbea0e3e392c76c167bac1cb013f6f1013980455c2",
    "k": "1f4b84c23a86a221d233f2521be018d9318639d5b8bbd6374a8a59232d16ad3d",
    "message": "There is a computer disease that anybody who works with computers knows about. It's a very serious disease and it interferes completely with the work. The trouble with computers is that you 'play' with them!",
    "signature": "b552edd27580141f3b2a5463048cb7cd3e047b97c9f98076c32dbdf85a68718b279fa72dd19bfae05577e06c7c0c1900c371fcd5893f7e1d56a37d30174671f6"
  },
  {
    "privateKey": "0000000000000000000000000000000000000000000000000000000000000001",
    "k": "ec633bd56a5774a0940cb97e27a9e4e51dc94af737596a0c5cbb3d30332d92a5",
    "message": "Everything should be made as simple as possible, but not simpler.",
    "signature": "33a69cd2065432a30f3d1ce4eb0d59b8ab58c74f27c41a7fdb5696ad4e6108c96f807982866f785d3f6418d24163ddae117b7db4d5fdf0071de069fa54342262"
  },
  {
    "privateKey": "fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364140",
    "k": "9dc74cbfd383980fb4ae5d2680acddac9dac956dca65a28c80ac9c847c2374e4",
    "message": "Equations are more important to me, because politics is for the present, but an equation is something for eternity.",
    "signature": "54c4a33c6423d689378f160a7ff8b61330444abb58fb470f96ea16d99d4a2fed07082304410efa6b2943111b6a4e0aaa7b7db55a07e9861d1fb3cb1f421044a5"
  },
  {
    "privateKey": "fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364140",
    "k": "fd27071f01648ebbdd3e1cfbae48facc9fa97edc43bbbc9a7fdc28eae13296f5",
    "message": "Not only is the Universe stranger than we think, it is stranger than we can think.",
    "signature": "ff466a9f1b7b273e2f4c3ffe032eb2e814121ed18ef84665d0f515360dab3dd06fc95f5132e5ecfdc8e5e6e616cc77151455d46ed48f5589b7db7771a332b283"
  }
]
