(function (exports, Bitcoin, io, $, global) {

  /**
   * Expose constructor.
   */

  exports.ExitNode = ExitNode;

  function ExitNode(host, port, secure) {
    this.setUri(host, port, secure);

    this.unique = 1;
    this.connected = false;

    this.callbacks = [];
  };

  Bitcoin.EventEmitter.augment(ExitNode);

  ExitNode.prototype.setUri = function (host, port, secure) {
    this.uri = (secure ? "https://" : "http://")+host+":"+port;
  };

  ExitNode.prototype.connect = function (wallet) {
    this.wallet = wallet;

    // Workaround for socket.io not properly allowing disconnecting and reconnecting
    delete io.sockets[this.uri];
    io.j = [];

    this.socket = io.connect(this.uri);
    this.socket.on('connect', $.proxy(this.handleConnect, this));
    this.socket.on('error', function () {
      console.log('error, test');
    });
    this.socket.on('message', $.proxy(this.handleMessage, this));
    this.socket.on('disconnect', $.proxy(this.handleDisconnect, this));
  };

  ExitNode.prototype.disconnect = function () {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
    }

    this.trigger('connectStatus', {status: 'unknown'});
  };

  /**
   * Make RPC call.
   */
  ExitNode.prototype.call = function (method, argObj, callback) {
    this.socket.send($.toJSON({
      "method": method,
      "params": [argObj],
      "id": this.unique
    }));
    if (callback) this.callbacks[this.unique] = callback;
    this.unique++;
  };

  ExitNode.prototype.handleConnect = function () {
    var self = this;

    this.connected = true;
  };

  ExitNode.prototype.listen = function (addrs) {
    self.call("pubkeysRegister", {
      keys: addrs.join(',')
    }, function (err, result) {
      if (err) {
        console.error("Could not register public keys");
        return;
      }

      self.call("pubkeysListen", {
        handle: result.handle
      }, function (err, result) {
        // Communicate the block height
        self.trigger('blockInit', {height: result.height});

        // Pass on the newly downloaded transactions
        self.trigger('txData', {
          confirmed: true,
          txs: result.txs
        });

        // TODO: Download more transactions

        self.trigger('connectStatus', {status: 'ok'});
      });

      self.call("pubkeysUnconfirmed", {
        handle: result.handle
      }, function (err, result) {
        // Pass on the newly downloaded transactions
        self.trigger('txData', {
          confirmed: false,
          txs: result.txs
        });
      });
    });
  };


  ExitNode.prototype.handleMessage = function (data) {
    // Handle JSON-RPC result messages
    if ("undefined" !== typeof data.result &&
        "function" == typeof this.callbacks[data.id]) {
      this.callbacks[data.id](data.error, data.result);

      // Handle JSON-RPC request messages
    } else if ("undefined" !== typeof data.method) {
      // Create an event
      this.trigger(data.method, data.params[0]);
    }
  };


  ExitNode.prototype.handleDisconnect = function () {
    // TODO: Attempt reconnect (unless disconnect was intended)
  };

  ExitNode.prototype.query = function (api, params, jsonp,  callback) {
    if ("function" === typeof jsonp) {
      callback = jsonp;
      jsonp = false;
    }

    params = params || {};
    callback = "function" === typeof callback ? callback : function () {};

    var url = this.uri + '/' + api;
    if (jsonp) {
      url += "?callback=?";
    }

    $.getJSON(url, params, callback);
  };
})(
  'undefined' != typeof Bitcoin ? Bitcoin : module.exports,
  'undefined' != typeof Bitcoin ? Bitcoin : require('bitcoinjs-lib'),
  'undefined' != typeof io ? io : require('io'),
  jQuery, // TODO: Add Node.js equivalent
  this
);
