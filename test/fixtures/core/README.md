Description
------------

This directory contains data-driven tests for various aspects of Groestlcoin.


Groestlcoinjs-lib notes
-------------------

This directory does not contain all the Groestlcoin core tests.
Missing core test data includes:

* `alertTests.raw`
	Groestlcoin-js does not interact with the Groestlcoin network directly.

* `tx_invalid.json`
	Groestlcoin-js can not evaluate Scripts, making testing this irrelevant.
	It can decode valid Transactions, therefore `tx_valid.json` remains.

* `script*.json`
	Groestlcoin-js can not evaluate Scripts, making testing this irrelevant.


License
--------

The data files in this directory are

    Copyright (c) 2012-2014 The Bitcoin Core developers
    Distributed under the MIT/X11 software license, see the accompanying
    file COPYING or http://www.opensource.org/licenses/mit-license.php.
