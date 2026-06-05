import { auth } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check permission
  const isAuthorized =
    session.user.role === 'superadmin' ||
    session.user.role === 'admin' ||
    session.user.pages?.custos;

  if (!isAuthorized) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const supabase = getSupabaseAdmin();
    
    // Start of today in local system time
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('ai_token_usage')
      .select('tokens_input, tokens_output, estimated_cost_usd')
      .gte('created_at', todayStart.toISOString());

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const LIMIT_USD_DAY = 2.00; // Daily default budget limit in USD

    const totalInput = data?.reduce((sum, r) => sum + (r.tokens_input ?? 0), 0) || 0;
    const totalOutput = data?.reduce((sum, r) => sum + (r.tokens_output ?? 0), 0) || 0;
    const totalCost = data?.reduce((sum, r) => sum + Number(r.estimated_cost_usd ?? 0), 0) || 0;
    const totalTokens = totalInput + totalOutput;

    const remainingCost = Math.max(0, LIMIT_USD_DAY - totalCost);
    const percentSpent = Math.min(100, (totalCost / LIMIT_USD_DAY) * 100);

    return NextResponse.json({
      ok: true,
      today: {
        tokens_input: totalInput,
        tokens_output: totalOutput,
        total_tokens: totalTokens,
        cost_usd: totalCost,
        limit_usd: LIMIT_USD_DAY,
        remaining_usd: remainingCost,
        percent_spent: percentSpent
      }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
