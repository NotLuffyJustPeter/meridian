import path from 'node:path';
import type { NextConfig } from 'next';

const apiOrigin = process.env.API_ORIGIN ?? 'http://127.0.0.1:3001';

const nextConfig: NextConfig = {
  output: 'standalone',

  // Meridian es un monorepo.
  // Permite que Next trace también dependencias del node_modules
  // ubicado en la raíz del workspace.
  outputFileTracingRoot: path.join(process.cwd(), '../..'),

  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${apiOrigin}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;