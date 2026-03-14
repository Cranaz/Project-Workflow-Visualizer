/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['unzipper', '@babel/parser', '@babel/traverse'],
  outputFileTracingRoot: __dirname,
  typescript: {
    ignoreBuildErrors: false,
  },
};

module.exports = nextConfig;
