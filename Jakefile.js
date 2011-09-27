var pkginfo = require('pkginfo')(module);
var minify = require('jake-uglify').minify;

var headerJS = "\
/**\n\
 * BitcoinJS-lib v"+exports.version+"-default\n\
 * Copyright (c) 2011 BitcoinJS Project\n\
 * \n\
 * This program is free software; you can redistribute it and/or modify\n\
 * it under the terms of the MIT license.\n\
 */";

task({'default': [
  'build/bitcoinjs-min.js',
  'build/bitcoinjs-exit-min.js'
]});

desc('General-purpose build containing most features');
minify({'build/bitcoinjs-min.js': [
  'src/crypto-js/crypto.js',
  'src/crypto-js/sha256.js',
  'src/crypto-js/ripemd160.js',
  'src/jsbn/prng4.js',
  'src/jsbn/rng.js',
  'src/jsbn/jsbn.js',
  'src/jsbn/jsbn2.js',

  'src/jsbn/ec.js',
  'src/jsbn/sec.js',
  'src/events/eventemitter.js',
  'src/bitcoin.js',
  'src/util.js',
  'src/base58.js',
  
  'src/address.js',
  'src/ecdsa.js',
  'src/eckey.js',
  'src/opcode.js',
  'src/script.js',
  'src/transaction.js',

  'src/wallet.js',
  'src/txdb.js'
]}, {
  header: headerJS
});

desc('Exit node client implementation');
minify({'build/bitcoinjs-exit-min.js': [
  'src/exit/client.js'
]}, {
  header: headerJS
});
