const webpack = require('webpack');

module.exports = {
  entry: './src/index.js',
  mode: 'production',
  output: {
    libraryTarget: 'umd',
    filename: 'bitcoinjs-browser.js',
  },
  plugins: [
    new webpack.ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer'],
    }),
  ],
};
