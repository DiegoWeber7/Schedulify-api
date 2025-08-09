// Helper to convert time string like "7:00 AM" to minutes since midnight
function timeToMinutes(timeStr) {
  const [time, modifier] = timeStr.split(' ');
  let [hours, minutes] = time.split(':').map(Number);
  if (modifier === 'PM' && hours !== 12) hours += 12;
  if (modifier === 'AM' && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

// Helper to calculate total blocked minutes from fixed commitments and recurring events
function calculateBlockedMinutes(commitments, recurringEvents) {
  // commitments format example: [{ start: "9:00 AM", end: "10:00 AM" }, ...]
  // recurringEvents format example: [{ description, schedule: "9:00 AM - 10:00 AM" }, ...]

  let totalBlocked = 0;

  // Calculate minutes blocked by commitments
  if (commitments && commitments.length) {
    for (const c of commitments) {
      totalBlocked += timeToMinutes(c.end) - timeToMinutes(c.start);
    }
  }

  // Calculate minutes blocked by recurring events
  if (recurringEvents && recurringEvents.length) {
    for (const ev of recurringEvents) {
      // assume schedule format "9:00 AM - 10:00 AM"
      const [start, end] = ev.schedule.split(' - ');
      totalBlocked += timeToMinutes(end) - timeToMinutes(start);
    }
  }

  return totalBlocked;
}

// Main function to build AI prompt
export function buildAIPrompt({
  work,
  school,
  startTime,
  sleepTime,
  commitments = [],
  recurringEvents = [],
  recentManualTasks = [],
  dayOfWeek, // e.g. "Monday", "Tuesday"
  timezone = "UTC" // default timezone if not provided
}) {
  const targetDay = dayOfWeek || "today";

  // Calculate total day minutes and blocked minutes
  const dayStart = timeToMinutes(startTime);
  const dayEnd = timeToMinutes(sleepTime);
  const totalAvailableMinutes = dayEnd > dayStart ? dayEnd - dayStart : (24 * 60 - dayStart) + dayEnd;

  const blockedMinutes = calculateBlockedMinutes(commitments, recurringEvents);
  const freeMinutes = totalAvailableMinutes - blockedMinutes;

  // Convert free minutes to hours with 1 decimal place
  const hoursPerDay = (freeMinutes / 60).toFixed(1);

  // Format commitments for prompt display
  const commitmentsDisplay = commitments.length
    ? commitments.map(c => `${c.start} - ${c.end}`).join("; ")
    : "None";

  let prompt = `You are a highly intelligent and practical AI scheduling assistant.
Your job is to create a realistic, productive schedule for **${targetDay} only**.
The schedule should fit the user's constraints, respect recurring events, avoid conflicts, and make smart use of available time.

The user is in the ${timezone} timezone.

User information:
- Employment status: ${work}
- School status: ${school}
- Day starts at: ${startTime}
- Day ends at (sleep time): ${sleepTime}
- Available hours for tasks on ${targetDay}: ${hoursPerDay}
- Fixed commitments: ${commitmentsDisplay}
`;

  if (recurringEvents.length > 0) {
    prompt += `- Recurring events: ${recurringEvents
      .map(ev => `${ev.description} (${ev.schedule})`)
      .join("; ")}\n`;
  } else {
    prompt += `- Recurring events: None\n`;
  }

  if (recentManualTasks.length > 0) {
    prompt += `- Recent manual tasks: ${recentManualTasks
      .map(task => `${task.name} at ${task.time || "unspecified time"}`)
      .join("; ")}\n`;
  } else {
    prompt += `- Recent manual tasks: None\n`;
  }

  prompt += `
Scheduling rules:
1. Only create a schedule for **${targetDay}** (not the whole week).
2. Use **12-hour AM/PM time format** for all times — do not use 24-hour/military time.
3. Include both start and end times for each activity.
4. Respect fixed commitments and recurring events — they cannot be moved.
5. If recurring events overlap, prioritize based on time order.
6. Fill free time with productive work, study, or rest based on context (work/school).
7. If there's unused time, suggest beneficial activities (exercise, reading, breaks).
8. Use realistic time blocks — avoid impossible overlaps.
9. Keep the tone concise and professional.
10. Keep the response under 500 words.

Output format:
Output the schedule as a chronological list with start and end times in 12-hour AM/PM format, for example:
7:00 AM - 7:30 AM: Wake up and morning routine
7:30 AM - 8:00 AM: Breakfast
8:00 AM - 10:00 AM: Work on project
...etc.
`;

  return prompt;
}