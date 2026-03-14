/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['unzipper', '@babel/parser', '@babel/traverse'],
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
};

module.exports = nextConfig;
