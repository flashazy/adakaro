import 'server-only';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('admin_report_preferences')
      .select('*')
      .maybeSingle();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data || { enabled: false });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const supabase = createAdminClient();
    const dbBody = {
      enabled: body.enabled,
      frequency: body.frequency,
      day_of_week: body.day_of_week,
      day_of_month: body.day_of_month,
      recipients: body.recipients,
      updated_at: new Date().toISOString()
    };
    const { data, error } = await supabase
      .from('admin_report_preferences')
      .upsert(dbBody)
      .select()
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error('PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
