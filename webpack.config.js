const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: {
    index: './src/index.tsx',
  },
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.(png|svg|jpg|jpeg|gif)$/i,
        type: 'asset/resource',
      }
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/index.html',
      inject: 'body',
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: 'assets', to: path.resolve(__dirname, 'dist/assets') },
        {
          from: path.resolve(__dirname, 'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.mjs'),
          to: 'ort-wasm-simd-threaded.jsep.mjs',
        },
        {
          from: path.resolve(__dirname, 'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.wasm'),
          to: 'ort-wasm-simd-threaded.jsep.wasm',
        },
      ],
    }),
  ],
};