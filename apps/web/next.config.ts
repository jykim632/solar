import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // @solar/* workspace packages ship TS source; let Next transpile them.
  transpilePackages: ['@solar/api-contracts'],
};

export default nextConfig;
