import 'server-only';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('admin_report_preferences')
    .select('*')
    .maybeSingle();
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data || { enabled: false });
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const supabase = createAdminClient();
    
    const { data: existing } = await supabase
      .from('admin_report_preferences')
      .select('id')
      .maybeSingle();
    
    if (existing && existing.id) {
      const { error } = await supabase
        .from('admin_report_preferences')
        .update({
          enabled: body.enabled,
          frequency: body.frequency,
          day_of_week: body.day_of_week,
          day_of_month: body.day_of_month,
          recipients: body.recipients,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);
      
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    } else {
      const { error } = await supabase
        .from('admin_report_preferences')
        .insert({
          id: '00000000-0000-0000-0000-000000000001',
          enabled: body.enabled,
          frequency: body.frequency,
          day_of_week: body.day_of_week,
          day_of_month: body.day_of_month,
          recipients: body.recipients,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
