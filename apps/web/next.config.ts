import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // @solar/* workspace packages ship TS source; let Next transpile them.
  transpilePackages: ['@solar/api-contracts', '@solar/db'],
  // pg is a CJS driver with dynamic requires — keep it out of the server bundle.
  serverExternalPackages: ['pg'],
};

export default nextConfig;
