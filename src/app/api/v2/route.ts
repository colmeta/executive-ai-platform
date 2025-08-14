// src/app/api/v2/route.ts
// FINAL DIAGNOSTIC VERSION
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { config } from '@/config';

async function meetingAgent(prompt: string, userId: string, supabase: SupabaseClient): Promise<string> {
  try {
    const { data: account } = await supabase.from('accounts').select('access_token, refresh_token').eq('user_id', userId).eq('provider', 'google').single();
    if (!account) return "Google Calendar not connected.";

    const oauth2Client = new google.auth.OAuth2(config.google.clientId, config.google.clientSecret);
    oauth2Client.setCredentials({ access_token: account.access_token, refresh_token: account.refresh_token });
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    const timeMin = new Date();
    const timeMax = new Date();
    timeMax.setDate(timeMax.getDate() + 7);

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      maxResults: 20,
      singleEvents: true,
      orderBy: 'startTime',
    });
    
    const events = response.data.items;
    if (!events || events.length === 0) return 'No upcoming events in the next 7 days.';
    
    const eventList = events.map(event => {
        const start = event.start?.dateTime || event.start?.date;
        const eventDate = new Date(start!);
        const isAllDay = !!event.start?.date;
        const formattedDate = isAllDay 
            ? eventDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
            : eventDate.toLocaleString(undefined, { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric' });
        return `- ${event.summary} (on ${formattedDate})`;
    }).join('\n');

    // THIS IS THE ONLY CHANGE - OUR FINGERPRINT
    return `--- DIAGNOSTIC FINGERPRINT v3 --- This is the new agent. The correct code is running. Events for the next 7 days:\n${eventList}`;
  
  } catch (err: any) {
    console.error('Error in Meeting Agent:', err);
    return 'Error connecting to calendar.';
  }
}

async function generalAgent(prompt: string, openai: OpenAI): Promise<string> {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4-turbo',
    messages: [{ role: 'system', content: 'You are an elite executive assistant.' }, { role: 'user', content: prompt }],
  });
  return completion.choices[0].message.content || 'No response from AI.';
}

export async function POST(req: NextRequest) {
  const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey);
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  try {
    const body = await req.json();
    const { prompt } = body;
    if (!prompt) return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });

    let agentResponse: string;
    const lowerCasePrompt = prompt.toLowerCase();
    
    if (lowerCasePrompt.includes('calendar') || lowerCasePrompt.includes('meeting')) {
      agentResponse = await meetingAgent(prompt, config.testUserId, supabase);
    } else {
      agentResponse = await generalAgent(prompt, openai);
    }
    
    return NextResponse.json({ success: true, response: agentResponse }, {
      headers: { 'Cache-Control': 'no-store' }
    });
  } catch (error: any) {
    console.error('An error occurred:', error);
    return NextResponse.json({ error: 'An internal server error occurred.' }, { status: 500 });
  }
}