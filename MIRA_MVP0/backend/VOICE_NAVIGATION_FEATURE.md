# Voice Navigation Feature

## Overview

The Voice Navigation feature allows users to navigate between different dashboard sections using natural voice commands. This feature works seamlessly with the existing voice pipeline and provides an intuitive way to control the application hands-free.

## Supported Voice Commands

Users can say any of the following commands while on the dashboard:

### Email Navigation
- "Show mail list"
- "Open emails"
- "View my inbox"
- "Go to emails"
- "Display email list"
- "Navigate to emails"

**Navigates to:** `/dashboard/emails`

### Calendar Navigation
- "Show calendar"
- "Open my calendar"
- "View calendar"
- "Go to calendar"
- "Display my schedule"
- "Navigate to calendar"

**Navigates to:** `/dashboard/calendar`

### Settings Navigation
- "Open settings"
- "Show settings"
- "Go to settings"
- "View preferences"
- "Navigate to settings"

**Navigates to:** `/dashboard/settings`

### Reminders Navigation
- "Show reminders"
- "Open reminders"
- "View my tasks"
- "Go to reminders"
- "Display reminders"

**Navigates to:** `/dashboard/remainder`

### Profile Navigation
- "Show profile"
- "Open my profile"
- "View profile"
- "Go to account"
- "Display my profile"

**Navigates to:** `/dashboard/profile`

### Homepage Navigation
- "Go to homepage"
- "Open homepage"
- "Show homepage"
- "Navigate to homepage"

**Navigates to:** `/` (actual home page with Mira assistant)

### Dashboard Navigation
- "Go to dashboard"
- "Back to dashboard"
- "Return to main"
- "Open dashboard"
- "Navigate to dashboard"

**Navigates to:** `/dashboard` (dashboard overview)

## Technical Implementation

### Backend (`voice_generation.py`)

The backend detects navigation commands using regex patterns and processes them **before** email/calendar viewing commands:

```python
nav_patterns = {
    "emails": re.compile(r"(show|open|view|go to|display|navigate to).*(mail list|email list|emails|inbox)", re.I),
    "calendar": re.compile(r"(show|open|view|go to|display|navigate to).*(calendar|my calendar|schedule)", re.I),
    "settings": re.compile(r"(show|open|view|go to|display|navigate to).*(setting|settings|preferences)", re.I),
    "reminders": re.compile(r"(show|open|view|go to|display|navigate to).*(reminder|reminders|tasks)", re.I),
    "profile": re.compile(r"(show|open|view|go to|display|navigate to).*(profile|account|my profile)", re.I),
    "homepage": re.compile(r"(go to|open|show|navigate to).*(home\s*page|homepage)", re.I),
    "dashboard": re.compile(r"(go to|open|show|back to|return to|navigate to).*(dashboard|main)", re.I),
}

# Check homepage first (more specific) before dashboard
```

When a navigation command is detected:
1. The command is mapped to a route
2. A friendly confirmation message is generated
3. TTS audio is generated for the response
4. A WebSocket message with action `dashboard_navigate` is sent to the client

**Message Format:**
```json
{
  "message_type": "response",
  "text": "Opening your email list.",
  "userText": "show mail list",
  "action": "dashboard_navigate",
  "actionData": {
    "route": "/dashboard/emails",
    "destination": "emails"
  },
  "audio": "<base64_encoded_mp3>"
}
```

### Frontend (`navigationHandler.ts`)

A reusable hook `useVoiceNavigation()` handles the navigation event:

```typescript
export function useVoiceNavigation() {
  const router = useRouter();

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      
      if (detail.route) {
        console.log("🧭 Voice navigation command received:", detail.route);
        router.push(detail.route);
      }
    };

    window.addEventListener("miraDashboardNavigate", handler);
    return () => window.removeEventListener("miraDashboardNavigate", handler);
  }, [router]);
}
```

### Integration Points

The `useVoiceNavigation()` hook is integrated into:
- `/app/page.tsx` (main dashboard home)
- `/app/dashboard/page.tsx` (dashboard overview)
- `/app/dashboard/emails/page.tsx`
- `/app/dashboard/calendar/page.tsx`
- All other dashboard pages

This ensures navigation works from **any** page in the application.

## User Experience Flow

1. **User speaks:** "Hey Mira, show mail list"
2. **Backend detects:** Navigation command to emails
3. **Backend responds:** Sends confirmation message with audio
4. **Frontend plays:** "Opening your email list." (audio)
5. **Frontend navigates:** Routes to `/dashboard/emails`
6. **User sees:** Email list page loads

**Total Time:** ~1-2 seconds from speech to navigation

## Advantages

1. **Hands-Free Control:** Navigate without touching keyboard/mouse
2. **Natural Language:** Multiple phrasings work (e.g., "show emails", "open inbox", "go to mail list")
3. **Instant Feedback:** Audio confirmation before navigation
4. **Universal:** Works from any dashboard page
5. **Non-Blocking:** Fast response time (~1-2s total)

## Error Handling

- If navigation fails, the system logs the error but doesn't crash
- If TTS generation fails, navigation still proceeds (audio is optional)
- If route mapping fails, defaults to `/dashboard`
- Connection issues are handled by existing WebSocket reconnection logic

## Future Enhancements

Potential improvements:
- Context-aware navigation (e.g., "go back" returns to previous page)
- Multi-step commands (e.g., "show emails from today")
- Voice-controlled filtering (e.g., "show unread emails only")
- Navigation history ("where was I?")
- Quick actions (e.g., "open first email", "schedule next meeting")

## Testing

To test the feature:

1. Start the backend: `uvicorn main:app --reload`
2. Start the frontend: `npm run dev`
3. Navigate to any dashboard page
4. Enable voice mode (click microphone icon)
5. Say any of the supported commands
6. Observe:
   - Audio confirmation plays
   - Page navigates to correct destination
   - Console logs show the navigation event

**Example Test Commands:**
- "Show mail list" → Should navigate to `/dashboard/emails`
- "Open calendar" → Should navigate to `/dashboard/calendar`
- "Go to settings" → Should navigate to `/dashboard/settings`
- "Go to homepage" → Should navigate to `/` (actual home page)
- "Go to dashboard" → Should navigate to `/dashboard`

## Related Files

**Backend:**
- `MIRA_MVP0/backend/voice/voice_generation.py` - Navigation detection logic

**Frontend:**
- `MIRA_MVP0/frontend/src/utils/voice/navigationHandler.ts` - Navigation hook
- `MIRA_MVP0/frontend/src/utils/voice/voiceHandler.ts` - WebSocket message handler
- `MIRA_MVP0/frontend/src/app/page.tsx` - Main page integration
- `MIRA_MVP0/frontend/src/app/dashboard/**/*.tsx` - All dashboard pages

**Documentation:**
- `MIRA_MVP0/backend/VOICE_PIPELINE_FIXES.md` - Voice pipeline stability fixes
- `MIRA_MVP0/backend/VOICE_NAVIGATION_FEATURE.md` - This document

