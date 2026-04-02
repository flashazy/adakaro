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
    
    // Get the existing row to get the ID
    const { data: existing, error: fetchError } = await supabase
      .from('admin_report_preferences')
      .select('id')
      .maybeSingle();
    
    if (fetchError && fetchError.code !== 'PGRST116') {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }
    
    const dbBody = {
      id: existing?.id || '00000000-0000-0000-0000-000000000001',
      enabled: body.enabled,
      frequency: body.frequency,
      day_of_week: body.day_of_week,
      day_of_month: body.day_of_month,
      recipients: body.recipients,
      updated_at: new Date().toISOString()
    };
    
    const { data, error } = await (supabase
      .from('admin_report_preferences') as any)
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
