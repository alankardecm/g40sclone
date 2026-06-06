import { NextResponse } from 'next/server';

const APP_NAME = 'am-os-business-os';
const APP_ENV = process.env.APP_ENV || 'parallel';
const APP_PORT = Number(process.env.PORT || 4100);

export async function GET() {
  return NextResponse.json({
    ok: true,
    app: APP_NAME,
    env: APP_ENV,
    port: APP_PORT,
    timestamp: new Date().toISOString(),
  });
}
