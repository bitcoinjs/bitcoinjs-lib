# bitcoinjs-lib

A library containing Bitcoin client-side functionality in JavaScript,
most notably ECDSA signing and verification.

[Website](http://bitcoinjs.org/) • [Mailing List](https://groups.google.com/group/bitcoinjs) • [Twitter](https://twitter.com/bitcoinjs)

# Status

This is currently pretty raw code. We're planning to clean it up,
convert everything into CommonJS modules and put a flexible build
system in place.

Prototype software, use at your own peril.

# How to use

* Run `npm run-script compile` to compile to a browser-friendly minified
file. Once in the browser, the global Bitcoin object will contain everything
you need.
* To use in NodeJS, install this package as you would any other and
put in `var Bitcoin = require('bitcoinjs-lib')`.

# License

This library is free and open-source software released under the MIT
license.

# Copyright

BitcoinJS (c) 2011-2012 Stefan Thomas  
Released under MIT license  
http://bitcoinjs.org/

JSBN (c) 2003-2005 Tom Wu  
Released under BSD license  
http://www-cs-students.stanford.edu/~tjw/jsbn/

CryptoJS (c) 2009–2012 by Jeff Mott  
Released under New BSD license  
http://code.google.com/p/crypto-js/
