/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    images: {
      domains: ['ipfs.io', 'gateway.pinata.cloud', 'via.placeholder.com'],
      unoptimized: true,
    },
    output: 'export',
    basePath: process.env.NODE_ENV === 'production' ? '/AdrianAuctions' : '',
    assetPrefix: process.env.NODE_ENV === 'production' ? '/AdrianAuctions/' : '',
    trailingSlash: true,
    transpilePackages: ['ethers'],
    experimental: {
      scrollRestoration: true,
    },
    // Configuración para personalizar las rutas de exportación estática
    exportPathMap: async function() {
      return {
        '/': { page: '/' },
        '/explore': { page: '/explore' },
        '/myauctions': { page: '/myauctions' },
        '/404': { page: '/404' },
      };
    },
    // Optimización de webpack para mejor compatibilidad con GitHub Pages
    webpack: (config, { isServer }) => {
      if (!isServer) {
        // Resolver problemas con módulos de Node.js en el navegador
        config.resolve.fallback = { 
          ...config.resolve.fallback,
          fs: false,
          net: false,
          tls: false,
          crypto: require.resolve('crypto-browserify'),
          stream: require.resolve('stream-browserify'),
          path: require.resolve('path-browserify'),
          os: require.resolve('os-browserify/browser'),
        };
      }
      return config;
    },
  };
  
  module.exports = nextConfig;