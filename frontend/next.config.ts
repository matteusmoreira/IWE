import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

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

const baseConfig: NextConfig = {
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

const withPWA = withPWAInit({
  dest: 'public',
  register: true,
  skipWaiting: true,
  cacheOnFrontEndNav: true,
  fallbacks: {
    document: '/offline',
  },
  disable: process.env.NEXT_PUBLIC_PWA_ENABLE !== 'true',
});

export default withPWA(baseConfig);
