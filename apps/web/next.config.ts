import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@cinewave/shared'],
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '*.supabase.co' }],
  },
};

export default nextConfig;
