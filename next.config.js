/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    images: {
      domains: ['ipfs.io', 'gateway.pinata.cloud', 'via.placeholder.com'],
      unoptimized: true,
    },
    output: 'export',
    basePath: process.env.NODE_ENV === 'production' ? '/AdrianAuctions' : '',
    trailingSlash: true,
  };
  
  module.exports = nextConfig;