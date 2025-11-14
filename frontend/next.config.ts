import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

function getSupabaseHostname() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    console.error('NEXT_PUBLIC_SUPABASE_URL não configurado');
    return 'localhost';
  }
  try {
    const u = new URL(url);
    return u.hostname;
  } catch {
    console.error('NEXT_PUBLIC_SUPABASE_URL inválido');
    return 'localhost';
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
  // Headers de segurança para produção
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains'
          }
        ]
      }
    ];
  }
};

const withPWA = withPWAInit({
  dest: 'public',
  register: true,
  cacheOnFrontEndNav: true,
  fallbacks: {
    document: '/offline',
  },
  disable: process.env.NEXT_PUBLIC_PWA_ENABLE !== 'true',
  workboxOptions: {
    skipWaiting: true,
    clientsClaim: true,
  },
});

export default withPWA(baseConfig);
