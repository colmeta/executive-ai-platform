// Inside src/app/api/v2/route.ts, this is the final diagnostic version
async function meetingAgent(prompt: string, userId: string, supabase: SupabaseClient, openai: OpenAI): Promise<string> {
  try {
    console.log("--- Meeting Agent START ---");
    const { data: account } = await supabase.from('accounts').select('access_token, refresh_token').eq('user_id', userId).eq('provider', 'google').single();
    if (!account) return "Google Calendar not connected.";
    console.log("Step 1: Tokens retrieved successfully.");

    const oauth2Client = new google.auth.OAuth2(config.google.clientId, config.google.clientSecret);
    oauth2Client.setCredentials({ access_token: account.access_token, refresh_token: account.refresh_token });
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    console.log("Step 2: Google client created.");

    const intentSystemPrompt = `Classify the user's intent. Respond with a single word: READ or WRITE.`;
    const intentResponse = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'system', content: intentSystemPrompt }, { role: 'user', content: prompt }],
    });
    const intent = intentResponse.choices[0].message.content?.trim().toUpperCase();
    console.log(`Step 3: Intent classified as: ${intent}`);

    if (intent === 'WRITE') {
      console.log("Entering WRITE branch...");
      const detailsSystemPrompt = `Parse the user's prompt into a JSON object with keys: "summary", "description", "startTime", "endTime". Assume current date is ${new Date().toISOString()}. The meeting should be 30 minutes if no duration is specified. Respond with only the JSON object.`;
      const detailsResponse = await openai.chat.completions.create({
        model: 'gpt-4-turbo',
        messages: [{ role: 'system', content: detailsSystemPrompt }, { role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      });
      const details = JSON.parse(detailsResponse.choices[0].message.content!);
      console.log("Step 4: Details parsed:", details);

      if (!details.summary || !details.startTime || !details.endTime) { throw new Error("Missing required details from OpenAI parse."); }
      
      const event = await calendar.events.insert({
          calendarId: 'primary',
          requestBody: { summary: details.summary, description: details.description, start: { dateTime: details.startTime }, end: { dateTime: details.endTime } },
      });
      console.log("Step 5: Event created.");
      return `✅ Meeting scheduled! I've added "${details.summary}" to your calendar. View it here: ${event.data.htmlLink}`;

    } else if (intent === 'READ') {
      console.log("Entering READ branch...");
      const timeMin = new Date();
      const timeMax = new Date();
      timeMax.setDate(timeMax.getDate() + 30); // Let's check a month for "next month"
      const response = await calendar.events.list({
        calendarId: 'primary', timeMin: timeMin.toISOString(), timeMax: timeMax.toISOString(),
        maxResults: 20, singleEvents: true, orderBy: 'startTime',
      });
      const events = response.data.items;
      console.log(`Step 4: Found ${events?.length || 0} events.`);
      if (!events || events.length === 0) return 'No upcoming events in the next month.';
      
      const eventList = events.map(e => `- ${e.summary} (on ${new Date(e.start!.dateTime!).toLocaleString()})`).join('\n');
      return `Here are your upcoming events for the next month:\n${eventList}`;
    
    } else {
      throw new Error(`Unrecognized intent: ${intent}`);
    }

  } catch (err: any) {
    // THIS IS THE CRITICAL PART - IT WILL TELL US THE REAL ERROR
    console.error('--- Meeting Agent FAILED ---');
    console.error('Error Name:', err.name);
    console.error('Error Message:', err.message);
    console.error('Full Error Object:', err);
    return 'I encountered a critical error. Please check the server logs for details.';
  }
}