import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function generateRandomTicketHash(regNo: string): string {
  const randomToken = crypto.randomBytes(16).toString('hex');
  return `hecanaff-${regNo.trim()}-${randomToken}`;
}

// GET: Fetch Dashboard Stats, QR Visibility, or Search by Registration Number
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const searchReg = searchParams.get('reg_no');

    // If searching for a specific student by registration number
    if (searchReg) {
      const { data, error } = await supabaseAdmin
        .from('student_tickets')
        .select('*')
        .ilike('reg_no', searchReg.trim())
        .maybeSingle();

      if (error) throw error;
      return NextResponse.json({ student: data });
    }

    // Otherwise fetch total issued, total scanned, and QR visibility status
    const [{ count: totalIssued }, { count: totalScanned }, { data: setting }] = await Promise.all([
      supabaseAdmin.from('student_tickets').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('student_tickets').select('*', { count: 'exact', head: true }).eq('is_scanned', true),
      supabaseAdmin.from('app_settings').select('value').eq('key', 'qr_visible').maybeSingle(),
    ]);

    return NextResponse.json({
      totalIssued: totalIssued || 0,
      totalScanned: totalScanned || 0,
      qrVisible: setting?.value === 'true',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: Bulk CSV, Single Student Add, QR Visibility Toggle, or Manual Volunteer Entry
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    // ACTION 1: Bulk CSV Upload or Single Student Add
    if (action === 'upsert_students') {
      const { students } = body;
      
      const records = students
        .filter((s: any) => s.email && s.name && s.reg_no)
        .map((s: any) => {
          const cleanEmail = s.email.toLowerCase().trim();
          const cleanReg = String(s.reg_no).trim();
          return {
            reg_no: cleanReg,
            full_name: s.name.trim(),
            email: cleanEmail,
            ticket_hash: generateRandomTicketHash(cleanReg),
          };
        });

      const CHUNK_SIZE = 1000;
      let processedCount = 0;

      for (let i = 0; i < records.length; i += CHUNK_SIZE) {
        const chunk = records.slice(i, i + CHUNK_SIZE);
        const { error } = await supabaseAdmin
          .from('student_tickets')
          .upsert(chunk, { onConflict: 'reg_no', ignoreDuplicates: false });

        if (error) throw error;
        processedCount += chunk.length;
      }

      return NextResponse.json({ success: true, count: processedCount });
    }

    // ACTION 2: Toggle Global QR Visibility
    if (action === 'toggle_qr_visibility') {
      const { visible } = body;
      const { error } = await supabaseAdmin
        .from('app_settings')
        .upsert({ key: 'qr_visible', value: visible ? 'true' : 'false' });

      if (error) throw error;
      return NextResponse.json({ success: true, qr_visible: visible });
    }

    // ACTION 3: Volunteer Manual Check-in (If student isn't in list or QR is hidden)
    if (action === 'manual_volunteer_checkin') {
      const { reg_no, full_name, volunteer_name } = body;
      const cleanReg = String(reg_no).trim();

      // Check if student already exists
      const { data: existing } = await supabaseAdmin
        .from('student_tickets')
        .select('*')
        .eq('reg_no', cleanReg)
        .maybeSingle();

      if (existing) {
        if (existing.is_scanned) {
          return NextResponse.json({
            status: 'ALREADY_USED',
            message: 'Student was already checked in!',
            student_name: existing.full_name,
            reg_no: existing.reg_no,
            scanned_at: existing.scanned_at,
            scanned_by: existing.scanned_by,
          });
        }

        await supabaseAdmin
          .from('student_tickets')
          .update({
            is_scanned: true,
            scanned_at: new Date().toISOString(),
            scanned_by: `${volunteer_name} (Manual)`,
          })
          .eq('reg_no', cleanReg);

        return NextResponse.json({
          status: 'VALID',
          message: 'Manual Entry Approved',
          student_name: existing.full_name,
          reg_no: existing.reg_no,
        });
      }

      // If student is NOT in list at all, register & mark scanned immediately
      const placeholderEmail = `${cleanReg.toLowerCase()}@walkin.hecanaff.local`;
      const { error } = await supabaseAdmin.from('student_tickets').insert({
        reg_no: cleanReg,
        full_name: full_name.trim(),
        email: placeholderEmail,
        ticket_hash: generateRandomTicketHash(cleanReg),
        is_scanned: true,
        scanned_at: new Date().toISOString(),
        scanned_by: `${volunteer_name} (Walk-in Manual)`,
      });

      if (error) throw error;

      return NextResponse.json({
        status: 'VALID',
        message: 'Walk-in Student Registered & Approved',
        student_name: full_name.trim(),
        reg_no: cleanReg,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
