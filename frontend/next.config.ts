import type { NextConfig } from "next";

function getSupabaseHostname() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return 'bhbnkleaepzdjqgmbyhe.supabase.co';
  try {
    const u = new URL(url);
    return u.hostname;
  } catch {
    return 'bhbnkleaepzdjqgmbyhe.supabase.co';
  }
}

const nextConfig: NextConfig = {
  eslint: {
    // Revertido: falhar build em erros de lint (padrão Next.js). Avisos continuam não bloqueando.
    ignoreDuringBuilds: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: getSupabaseHostname(),
      },
    ],
  },
  compress: true,
  experimental: {
    optimizePackageImports: ['lucide-react', 'sonner'],
  },
};

export default nextConfig;
