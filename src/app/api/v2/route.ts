// src/app/api/v2/route.ts
// FINAL VERSION WITH GPT-3.5
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { config } from '@/config';

async function meetingAgent(prompt: string, userId: string, supabase: SupabaseClient, openai: OpenAI): Promise<string> {
  try {
    const { data: account } = await supabase.from('accounts').select('access_token, refresh_token').eq('user_id', userId).eq('provider', 'google').single();
    if (!account) return "Google Calendar not connected.";

    const oauth2Client = new google.auth.OAuth2(config.google.clientId, config.google.clientSecret);
    oauth2Client.setCredentials({ access_token: account.access_token, refresh_token: account.refresh_token });
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const intentSystemPrompt = `Classify the user's intent. Respond with a single word: READ or WRITE.`;
    const intentResponse = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'system', content: intentSystemPrompt }, { role: 'user', content: prompt }],
    });
    const intent = intentResponse.choices[0].message.content?.trim().toUpperCase();

    if (intent === 'WRITE') {
      const detailsSystemPrompt = `Parse prompt into a JSON object with keys: "summary", "description", "startTime", "endTime". Assume current date is ${new Date().toISOString()}. Default meeting duration is 30 mins. Respond with only JSON.`;
      const detailsResponse = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo', // Using 3.5 for this as well
        messages: [{ role: 'system', content: detailsSystemPrompt }, { role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      });
      const details = JSON.parse(detailsResponse.choices[0].message.content!);
      if (!details.summary || !details.startTime || !details.endTime) { return "I couldn't understand the meeting details."; }
      
      const event = await calendar.events.insert({
          calendarId: 'primary',
          requestBody: { summary: details.summary, description: details.description, start: { dateTime: details.startTime }, end: { dateTime: details.endTime } },
      });
      return `✅ Meeting scheduled! I've added "${details.summary}" to your calendar. View it here: ${event.data.htmlLink}`;
    } else { // Default to READ
      const timeMin = new Date();
      const timeMax = new Date();
      timeMax.setDate(timeMax.getDate() + 7);
      const response = await calendar.events.list({
        calendarId: 'primary', timeMin: timeMin.toISOString(), timeMax: timeMax.toISOString(),
        maxResults: 20, singleEvents: true, orderBy: 'startTime',
      });
      const events = response.data.items;
      if (!events || events.length === 0) return 'No upcoming events in the next 7 days.';
      const eventList = events.map(e => `- ${e.summary} (on ${new Date(e.start!.dateTime!).toLocaleString()})`).join('\n');
      return `Here are your upcoming events for the next 7 days:\n${eventList}`;
    }
  } catch (err: any) {
    console.error('Error in Meeting Agent:', err);
    return 'Error connecting to calendar or processing request.';
  }
}

async function generalAgent(prompt: string, openai: OpenAI): Promise<string> {
  const completion = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo', // Using 3.5 for consistency
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
    
    if (lowerCasePrompt.includes('calendar') || lowerCasePrompt.includes('meeting') || lowerCasePrompt.includes('schedule') || lowerCasePrompt.includes('appointment')) {
      agentResponse = await meetingAgent(prompt, config.testUserId, supabase, openai);
    } else {
      agentResponse = await generalAgent(prompt, openai);
    }
    
    return NextResponse.json({ success: true, response: agentResponse });
  } catch (error: any) {
    console.error('An error occurred:', error);
    return NextResponse.json({ error: 'An internal server error occurred.' }, { status: 500 });
  }
}