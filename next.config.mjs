/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async redirects() {
    return [
      { source: '/basic-search', destination: '/?view=browse', permanent: true },
      { source: '/internal-resources', destination: '/?view=browse', permanent: true },
      { source: '/external-resources', destination: '/?view=browse', permanent: true },
      { source: '/favorites', destination: '/?view=saved', permanent: true },
    ]
  },
}

export default nextConfig