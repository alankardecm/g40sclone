import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isSupabaseConfigured } from '@/lib/supabase';
import mysql from 'mysql2/promise';

export async function GET() {
  const status: {
    timestamp: string;
    services: Record<string, { status: string; message: string | null }>;
  } = {
    timestamp: new Date().toISOString(),
    services: {
      supabase: { status: 'unknown', message: null },
      mysql: { status: 'unknown', message: null },
      openai: { status: 'unknown', message: null },
    },
  };

  // 1. Test Supabase
  if (isSupabaseConfigured()) {
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      
      const { data, error } = await supabase.from('_health_check_dummy_').select('*').limit(0);
      const connectionError = error && (error.message.includes('fetch') || error.message.includes('Invalid API key'));
      
      status.services.supabase.status = connectionError ? 'error' : 'ok';
      if (connectionError) status.services.supabase.message = error.message;
    } catch (e: any) {
      status.services.supabase.status = 'error';
      status.services.supabase.message = e.message;
    }
  } else {
    status.services.supabase.status = 'disabled';
    status.services.supabase.message = 'Supabase nao configurado (modo G4OS local habilitado)';
  }

  // 2. Test MySQL
  try {
    const connection = await mysql.createConnection({
      host: process.env.MYSQL_HOST,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE,
      connectTimeout: 5000,
    });
    await connection.ping();
    await connection.end();
    status.services.mysql.status = 'ok';
  } catch (e: any) {
    status.services.mysql.status = 'error';
    status.services.mysql.message = e.message;
  }

  // 3. Test OpenAI (Simple model list check)
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
    });
    status.services.openai.status = response.ok ? 'ok' : 'error';
    if (!response.ok) {
      const errorData = await response.json();
      status.services.openai.message = errorData.error?.message || 'Failed to connect to OpenAI';
    }
  } catch (e: any) {
    status.services.openai.status = 'error';
    status.services.openai.message = e.message;
  }

  const overallOk = Object.values(status.services).every(s => s.status === 'ok');

  return NextResponse.json({
    status: overallOk ? 'healthy' : 'degraded',
    ...status
  }, { status: overallOk ? 200 : 207 });
}
