/** @type {import('next').NextConfig} */
const nextConfig = {
  // Isključi Turbopack – koristi klasični webpack
  experimental: {
    turbopack: false,
  },

  // Ignoriši Supabase Edge Functions folder (Deno kod)
  webpack(config) {
    config.module.rules.push({
      test: /supabase[\\/]functions[\\/].*/,
      loader: 'null-loader',
    })
    return config
  },
}

export default nextConfig