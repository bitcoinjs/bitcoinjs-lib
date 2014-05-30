Description
------------

This directory contains data-driven tests for various aspects of Bitcoin.


Bitcoinjs-lib notes
-------------------

This directory does not contain all the Bitcoin core tests.
Missing core test data includes:

* `alertTests.raw`
	Bitcoin-js does not interact with the Bitcoin network directly.

* `tx_invalid.json`
	Bitcoin-js can not evaluate Scripts, making testing this irrelevant.
	It can decode valid Transactions, therefore `tx_valid.json` remains.

* `script*.json`
	Bitcoin-js can not evaluate Scripts, making testing this irrelevant.


License
--------

The data files in this directory are

    Copyright (c) 2012-2014 The Bitcoin Core developers
    Distributed under the MIT/X11 software license, see the accompanying
    file COPYING or http://www.opensource.org/licenses/mit-license.php.
