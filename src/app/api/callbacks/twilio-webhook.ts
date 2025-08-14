// src/app/api/callbacks/twilio-webhook.ts
// This is the core logic for our AI Callback feature.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// IMPORTANT: This file has new dependencies.
// You must run 'npm install twilio' in your terminal.
import Twilio from 'twilio';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const twilioClient = Twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// This is the main function that runs when Twilio sends a webhook.
export async function POST(req: NextRequest) {
  console.log('Twilio webhook received!');
  
  try {
    const formData = await req.formData();
    const from = formData.get('From') as string; // The person who called
    const to = formData.get('To') as string;     // Your Twilio number

    if (!from || !to) {
      return NextResponse.json({ error: 'Missing From or To field' }, { status: 400 });
    }

    // For now, our AI logic is simple. In the future, this will be much smarter.
    const messageToSend = `Hi! This is the virtual assistant for the business you just called. Sorry we missed you. An agent will get back to you shortly.`;

    // Send an SMS back to the person who called.
    await twilioClient.messages.create({
      body: messageToSend,
      from: to, // Send from the Twilio number they called
      to: from,   // Send to the person who called
    });

    // TODO: In the future, we will log this to the 'leads' and 'callbacks' tables.
    console.log(`Successfully sent SMS to ${from}`);
    
    return new NextResponse('SMS Sent', { status: 200 });

  } catch (error: any) {
    console.error('Error in Twilio webhook:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
