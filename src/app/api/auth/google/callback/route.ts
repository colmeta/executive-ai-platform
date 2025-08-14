import { google } from 'googleapis';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const homeUrl = process.env.NODE_ENV === 'production' ? process.env.NEXT_PUBLIC_APP_URL! : 'http://localhost:3001';

  if (!code) { return NextResponse.redirect(`${homeUrl}/?auth=error&details=missing_code`); }
  
  const redirectUri = process.env.NODE_ENV === 'production'
    ? `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`
    : 'http://localhost:3001/api/auth/google/callback';

  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID!,
      process.env.GOOGLE_CLIENT_SECRET!,
      redirectUri
    );
    const { tokens } = await oauth2Client.getToken(code);
    
    const { error: saveError } = await supabase.from('accounts').upsert({
      user_id: process.env.TEST_USER_ID!,
      provider: 'google',
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
    }, { onConflict: 'user_id, provider' });
    if (saveError) throw saveError;
    
    return NextResponse.redirect(`${homeUrl}/?auth=success`);
  } catch (error: any) {
    console.error('Error in callback:', error);
    return NextResponse.redirect(`${homeUrl}/?auth=error&details=token_exchange_failed`);
  }
}