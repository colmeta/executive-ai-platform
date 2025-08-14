// src/config.ts
// FINAL PRODUCTION-SAFE VERSION
const isDevelopment = process.env.NODE_ENV === 'development';

let localSecrets: any = {};
if (isDevelopment && typeof window === 'undefined') {
  try {
    localSecrets = require('./secrets').localSecrets;
  } catch (e) { /* ignore */ }
}

export const config = {
  google: {
    clientId: isDevelopment ? localSecrets.google?.clientId : process.env.GOOGLE_CLIENT_ID!,
    clientSecret: isDevelopment ? localSecrets.google?.clientSecret : process.env.GOOGLE_CLIENT_SECRET!,
  },
  supabase: {
    url: isDevelopment ? localSecrets.supabase?.url : process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey: isDevelopment ? localSecrets.supabase?.serviceRoleKey : process.env.SUPABASE_SERVICE_ROLE_KEY!,
  },
  testUserId: isDevelopment ? localSecrets.testUserId : process.env.TEST_USER_ID!,
  redirectUri: {
    local: 'http://localhost:3001/api/auth/google/callback',
    production: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`
  }
};