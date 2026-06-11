const isExport = process.env.EXPORT === 'true';

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(isExport ? { output: 'export', trailingSlash: true, images: { unoptimized: true } } : {}),
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3', 'bcryptjs'],
  },
}

module.exports = nextConfig
