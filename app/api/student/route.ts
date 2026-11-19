import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawEmail = searchParams.get('email');

    if (!rawEmail) {
      return NextResponse.json({ error: 'Email parameter is required' }, { status: 400 });
    }

    const cleanEmail = rawEmail.trim().toLowerCase();

    const [{ data: setting }, { data: tickets, error }] = await Promise.all([
      supabaseAdmin
        .from('app_settings')
        .select('value')
        .eq('key', 'qr_visible')
        .maybeSingle(),
      supabaseAdmin
        .from('student_tickets')
        .select('*')
        .ilike('email', cleanEmail),
    ]);

    if (error) throw error;

    const ticket =
      tickets?.find((t) => t.email?.trim().toLowerCase() === cleanEmail) ||
      tickets?.[0] ||
      null;

    if (!ticket) {
      return NextResponse.json(
        { error: 'No AnaVITra pass found registered with this email address.' },
        { status: 404 }
      );
    }

    const isQrVisible = setting?.value === 'true';

    return NextResponse.json({
      ticket: {
        ...ticket,
        qr_visible: isQrVisible,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
