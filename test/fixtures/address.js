module.exports = {
  "valid": [
    {
      "description": "pubKeyHash",
      "network": "bitcoin",
      "version": 0,
      "hex": "751e76e8199196d454941c45d1b3a323f1433bd6",
      "base58check": "1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH",
      "script": "76a914751e76e8199196d454941c45d1b3a323f1433bd688ac"
    },
    {
      "description": "scriptHash",
      "network": "bitcoin",
      "version": 5,
      "hex": "cd7b44d0b03f2d026d1e586d7ae18903b0d385f6",
      "base58check": "3LRW7jeCvQCRdPF8S3yUCfRAx4eqXFmdcr",
      "script": "a914cd7b44d0b03f2d026d1e586d7ae18903b0d385f687"
    },
    {
      "description": "pubKeyHash",
      "network": "testnet",
      "version": 111,
      "hex": "751e76e8199196d454941c45d1b3a323f1433bd6",
      "base58check": "mrCDrCybB6J1vRfbwM5hemdJz73FwDBC8r",
      "script": "76a914751e76e8199196d454941c45d1b3a323f1433bd688ac"
    },
    {
      "description": "scriptHash",
      "network": "testnet",
      "version": 196,
      "hex": "cd7b44d0b03f2d026d1e586d7ae18903b0d385f6",
      "base58check": "2NByiBUaEXrhmqAsg7BbLpcQSAQs1EDwt5w",
      "script": "a914cd7b44d0b03f2d026d1e586d7ae18903b0d385f687"
    }
  ],
  "invalid": {
    "toScriptPubKey": [
      {
        "description": "Unknown Address version",
        "version": 153,
        "hex": "751e76e8199196d454941c45d1b3a323f1433bd6"
      }
    ]
  }
}