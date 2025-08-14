import { google } from 'googleapis';
import { NextResponse } from 'next/server';

export async function GET() {
  const redirectUri = process.env.NODE_ENV === 'production'
    ? `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`
    : 'http://localhost:3001/api/auth/google/callback';

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );

  const scopes = ['https://www.googleapis.com/auth/calendar'];
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline', scope: scopes, prompt: 'consent'
  });
  return NextResponse.redirect(url);
}