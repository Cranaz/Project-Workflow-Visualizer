/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  serverExternalPackages: ['unzipper', '@babel/parser', '@babel/traverse'],
  outputFileTracingRoot: __dirname,
  typescript: {
    ignoreBuildErrors: false,
  },
  webpack: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.modules = [
      path.resolve(__dirname, 'node_modules'),
      ...(config.resolve.modules || []),
    ];
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      'framer-motion': require.resolve('framer-motion'),
    };
    return config;
  },
};

module.exports = nextConfig;
