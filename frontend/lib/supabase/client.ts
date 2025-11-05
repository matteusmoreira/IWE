import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export const supabase = createClientComponentClient({
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
});

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          auth_user_id: string | null;
          email: string;
          name: string;
          phone: string | null;
          role: 'superadmin' | 'admin' | 'user';
          is_active: boolean;
          avatar_url: string | null;
          metadata: any;
          created_at: string;
          updated_at: string;
        };
      };
      tenants: {
        Row: {
          id: string;
          name: string;
          slug: string;
          status: boolean;
          settings: any;
          created_at: string;
          updated_at: string;
        };
      };
      submissions: {
        Row: {
          id: string;
          tenant_id: string;
          form_definition_id: string;
          data: any;
          polo: string | null;
          payment_status: 'PENDENTE' | 'PAGO' | 'CANCELADO' | 'REEMBOLSADO';
          payment_provider: 'mercadopago' | 'manual';
          payment_reference: string | null;
          payment_external_id: string | null;
          payment_amount: number | null;
          payment_date: string | null;
          metadata: any;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      form_definitions: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          slug: string;
          description: string | null;
          redirect_url_after_flow: string | null;
          is_active: boolean;
          settings: any;
          created_at: string;
          updated_at: string;
        };
      };
    };
  };
};
