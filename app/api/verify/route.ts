import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function extractCandidate(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';

  // If JSON payload, pull ticket_hash or reg_no
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object') {
      const val =
        parsed.ticket_hash ||
        parsed.ticketHash ||
        parsed.hash ||
        parsed.reg_no ||
        parsed.regNo;
      if (val) return String(val).trim();
    }
  } catch {
    // Not JSON
  }

  // If URL with query param, pull hash/ticket/reg_no if present
  try {
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      const url = new URL(trimmed);
      const param =
        url.searchParams.get('ticket_hash') ||
        url.searchParams.get('hash') ||
        url.searchParams.get('ticket') ||
        url.searchParams.get('reg_no');
      if (param) return param.trim();
    }
  } catch {
    // Not URL
  }

  return trimmed;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawQr =
      typeof body?.qrData === 'string'
        ? body.qrData
        : typeof body?.ticket_hash === 'string'
        ? body.ticket_hash
        : '';

    const scannedBy =
      typeof body?.scannedBy === 'string' && body.scannedBy.trim()
        ? body.scannedBy.trim()
        : 'Gate Volunteer 1';

    const candidate = extractCandidate(rawQr);
    if (!candidate) {
      return NextResponse.json(
        { success: false, error: 'Empty QR hash.' },
        { status: 400 }
      );
    }

    // 1. Exact match on ticket_hash
    let { data: ticket, error: fetchError } = await supabaseAdmin
      .from('student_tickets')
      .select('*')
      .eq('ticket_hash', candidate)
      .maybeSingle();

    if (fetchError) {
      return NextResponse.json(
        { success: false, error: `DB error: ${fetchError.message}` },
        { status: 500 }
      );
    }

    // 2. Case-insensitive match on ticket_hash
    if (!ticket) {
      const { data: ilikeHash, error: ilikeErr } = await supabaseAdmin
        .from('student_tickets')
        .select('*')
        .ilike('ticket_hash', candidate)
        .maybeSingle();

      if (ilikeErr) {
        return NextResponse.json(
          { success: false, error: `DB error: ${ilikeErr.message}` },
          { status: 500 }
        );
      }
      ticket = ilikeHash;
    }

    // 3. Fallback match on reg_no
    if (!ticket) {
      const { data: byReg, error: regErr } = await supabaseAdmin
        .from('student_tickets')
        .select('*')
        .ilike('reg_no', candidate)
        .maybeSingle();

      if (regErr) {
        return NextResponse.json(
          { success: false, error: `DB error: ${regErr.message}` },
          { status: 500 }
        );
      }
      ticket = byReg;
    }

    if (!ticket) {
      return NextResponse.json(
        {
          success: false,
          error: `Hash not found in student_tickets: ${candidate}`,
        },
        { status: 404 }
      );
    }

    // Already scanned -> Duplicate Entry
    if (ticket.is_scanned) {
      const prevTime = ticket.scanned_at
        ? new Date(ticket.scanned_at).toLocaleString()
        : 'earlier';
      return NextResponse.json(
        {
          success: false,
          duplicateEntry: true,
          student: ticket,
          error: `Duplicate entry — scanned at ${prevTime} by ${
            ticket.scanned_by || 'Gate Scanner'
          }.`,
        },
        { status: 409 }
      );
    }

    // Fresh ticket -> Log scan time & volunteer name in student_tickets
    const scannedAt = new Date().toISOString();
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('student_tickets')
      .update({
        is_scanned: true,
        scanned_at: scannedAt,
        scanned_by: scannedBy,
      })
      .eq('id', ticket.id)
      .select('*')
      .single();

    if (updateError) {
      return NextResponse.json(
        { success: false, error: `Failed to log scan: ${updateError.message}` },
        { status: 500 }
      );
    }

    const finalTicket = updated || {
      ...ticket,
      is_scanned: true,
      scanned_at: scannedAt,
      scanned_by: scannedBy,
    };

    return NextResponse.json({
      success: true,
      message: `Checked in by ${scannedBy} at ${new Date(scannedAt).toLocaleTimeString()}.`,
      student: finalTicket,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Verification failed.' },
      { status: 500 }
    );
  }
}
