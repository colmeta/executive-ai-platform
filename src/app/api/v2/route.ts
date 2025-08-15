// Inside src/app/api/v2/route.ts, this is the new, multi-skilled meetingAgent
async function meetingAgent(prompt: string, userId: string, supabase: SupabaseClient, openai: OpenAI): Promise<string> {
  try {
    const { data: account } = await supabase.from('accounts').select('access_token, refresh_token').eq('user_id', userId).eq('provider', 'google').single();
    if (!account) return "Google Calendar not connected.";

    const oauth2Client = new google.auth.OAuth2(config.google.clientId, config.google.clientSecret);
    oauth2Client.setCredentials({ access_token: account.access_token, refresh_token: account.refresh_token });
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // --- NEW BRAIN: INTENT CLASSIFICATION ---
    const intentSystemPrompt = `Classify the user's intent based on their prompt. Respond with only a single word: READ or WRITE. For example, "what's on my calendar" is READ. "schedule a meeting" or "book an appointment" is WRITE.`;
    const intentResponse = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo', // Use a faster, cheaper model for this simple task
      messages: [{ role: 'system', content: intentSystemPrompt }, { role: 'user', content: prompt }],
    });
    const intent = intentResponse.choices[0].message.content?.trim().toUpperCase();
    console.log('Classified Intent:', intent);

    // --- NEW LOGIC: PERFORM ACTION BASED ON INTENT ---
    if (intent === 'WRITE') {
      // --- WRITE SKILL ---
      const detailsSystemPrompt = `You are an intelligent assistant that parses meeting requests. Analyze the user's prompt and extract the following information in a JSON format: summary (title), description (details), startTime (ISO 8601 format), and endTime (ISO 8601 format). Assume the current date is ${new Date().toISOString()}. The meeting should be 30 minutes long if no duration is specified.`;
      const detailsResponse = await openai.chat.completions.create({
        model: 'gpt-4-turbo',
        messages: [{ role: 'system', content: detailsSystemPrompt }, { role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      });
      const details = JSON.parse(detailsResponse.choices[0].message.content!);
      if (!details.summary || !details.startTime || !details.endTime) { return "I couldn't understand the meeting details. Please be more specific."; }
      
      const event = await calendar.events.insert({
          calendarId: 'primary',
          requestBody: {
              summary: details.summary, description: details.description,
              start: { dateTime: details.startTime }, end: { dateTime: details.endTime },
          },
      });
      return `✅ Meeting scheduled! I've added "${details.summary}" to your calendar. View it here: ${event.data.htmlLink}`;

    } else if (intent === 'READ') {
      // --- READ SKILL ---
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
    
    } else {
      return "I'm not sure if you wanted to read from or write to the calendar. Please be more specific.";
    }

  } catch (err: any) {
    console.error('Error in Meeting Agent:', err);
    return 'Error connecting to calendar.';
  }
}