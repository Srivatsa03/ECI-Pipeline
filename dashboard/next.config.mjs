/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['pg'],
  experimental: {
    serverComponentsExternalPackages: ['pg'],
  },
};

export default nextConfig;
