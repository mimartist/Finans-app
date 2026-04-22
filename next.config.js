/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: true,
})

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=self, microphone=(), geolocation=()' },
]

const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      { source: '/(.*)', headers: [...securityHeaders, { key: 'Cache-Control', value: 'no-cache, must-revalidate' }] },
      { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }] },
      { source: '/_next/static/(.*)', headers: [{ key: 'Cache-Control', value: 'no-cache, must-revalidate' }] },
    ]
  },
}

module.exports = withPWA(nextConfig)
