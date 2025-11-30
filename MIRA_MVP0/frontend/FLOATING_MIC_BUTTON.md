# Floating Microphone Button Feature

## Overview

Added a beautiful floating action button (FAB) for the microphone on all dashboard pages, making voice commands easily accessible from anywhere in the application.

## Design

The floating mic button features:

- **Position**: Fixed in bottom-right corner (responsive positioning)
  - Desktop: `bottom-8 right-8`
  - Mobile: `bottom-6 right-6`

- **Visual States**:
  - **Inactive**: Purple-indigo gradient background
  - **Active**: Purple-pink gradient with pulse animation
  - **Hover**: Scales up (110%) with enhanced shadow

- **Animations**:
  - Smooth transitions (300ms)
  - Scale effects on hover and click
  - Pulsing animation when active
  - Inner circle ping effect when listening

- **Size**: 64x64px (w-16 h-16)
- **Z-index**: 50 (always on top)

## User Experience

### Interaction Flow

1. **Click to Start**:
   - User clicks the floating mic button
   - Button turns purple-pink and starts pulsing
   - Voice assistant activates
   - User can speak commands

2. **Click to Stop**:
   - User clicks again to deactivate
   - Button returns to purple-indigo gradient
   - Voice assistant stops listening

### Visual Feedback

- **Inactive State**: 
  - Solid gradient (purple to indigo)
  - Static microphone icon
  - Shadow on hover

- **Active State**:
  - Animated gradient (purple to pink)
  - Pulsing animation
  - Inner ping circle effect
  - Indicates "listening"

## Implementation

### Files Modified

1. **`/app/dashboard/page.tsx`** - Main dashboard
2. **`/app/dashboard/emails/page.tsx`** - Email list page
3. **`/app/dashboard/calendar/page.tsx`** - Calendar page

### Code Structure

Each dashboard page now includes:

```typescript
// Voice control state
const [isVoiceActive, setIsVoiceActive] = useState(false);

// Toggle function
const toggleVoice = () => {
  if (isVoiceActive) {
    stopMiraVoice();
    setIsVoiceActive(false);
  } else {
    startMiraVoice();
    setIsVoiceActive(true);
  }
};
```

### Button Component

```tsx
<button
  onClick={toggleVoice}
  className={`fixed bottom-6 right-6 md:bottom-8 md:right-8 w-16 h-16 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 z-50 hover:scale-110 active:scale-95 ${
    isVoiceActive 
      ? 'bg-gradient-to-br from-purple-500 to-pink-500 animate-pulse' 
      : 'bg-gradient-to-br from-purple-600 to-indigo-600 hover:shadow-purple-500/50'
  }`}
  aria-label={isVoiceActive ? "Stop voice assistant" : "Start voice assistant"}
>
  {/* SVG microphone icon with conditional states */}
</button>
```

## Accessibility

- **ARIA Label**: Descriptive labels for screen readers
  - Inactive: "Start voice assistant"
  - Active: "Stop voice assistant"

- **Keyboard Accessible**: Can be activated via keyboard navigation
- **Visual Indicators**: Clear active/inactive states
- **High Contrast**: Visible on all backgrounds

## Integration with Voice System

The floating mic button integrates seamlessly with:

1. **Voice Handler** (`voiceHandler.ts`):
   - `startMiraVoice()` - Activates voice listening
   - `stopMiraVoice()` - Deactivates voice listening

2. **Voice Navigation** (`navigationHandler.ts`):
   - Navigation commands work when voice is active
   - "Show mail list", "Open calendar", etc.

3. **WebSocket Connection**:
   - Maintains connection while active
   - Handles reconnection automatically

## Usage Examples

### Activating Voice Commands

1. Click the floating mic button (bottom-right)
2. Button pulses with purple-pink gradient
3. Say your command:
   - "Show mail list" → Navigate to emails
   - "Open calendar" → Navigate to calendar
   - "Show me my emails" → Display email summary
   - "What's on my calendar?" → Display calendar events

4. Click again to deactivate

### Visual States

```
INACTIVE:  🎤 (purple-indigo, static)
           ↓ [click]
ACTIVE:    🎤 (purple-pink, pulsing)
           ↓ [speaking]
LISTENING: 🎤 (with ping animation)
           ↓ [click]
INACTIVE:  🎤 (back to purple-indigo)
```

## Technical Details

### CSS Classes Used

- **Positioning**: `fixed bottom-6 right-6 md:bottom-8 md:right-8`
- **Size**: `w-16 h-16`
- **Shape**: `rounded-full`
- **Shadow**: `shadow-2xl`
- **Gradient (Inactive)**: `bg-gradient-to-br from-purple-600 to-indigo-600`
- **Gradient (Active)**: `bg-gradient-to-br from-purple-500 to-pink-500`
- **Animation**: `animate-pulse` (active state)
- **Z-index**: `z-50`
- **Transitions**: `transition-all duration-300`
- **Hover**: `hover:scale-110`
- **Active**: `active:scale-95`

### SVG Icon

Standard microphone SVG with:
- Width/height: 28px (w-7 h-7)
- Stroke width: 2
- White color
- Conditional ping circle when active

## Mobile Responsiveness

- Positioned to avoid bottom navigation bar
- Touch-friendly size (64x64px)
- Responsive positioning adjusts for mobile/desktop
- No conflicts with mobile bottom nav

## Browser Support

- All modern browsers (Chrome, Firefox, Safari, Edge)
- CSS Grid and Flexbox support required
- Tailwind CSS classes
- SVG support required

## Future Enhancements

Potential improvements:
- Voice waveform animation while speaking
- Haptic feedback on mobile
- Voice level indicator
- Quick actions menu on long press
- Customizable position (left/right)
- Drag to reposition
- Different themes/colors

## Related Features

- **Voice Navigation** - Navigate dashboard with voice commands
- **Voice Pipeline** - Backend WebSocket voice processing
- **Email/Calendar Summary** - Voice-activated summaries
- **Calendar Actions** - Voice commands for scheduling

## Testing

To test the feature:

1. Navigate to any dashboard page
2. Look for floating mic button (bottom-right)
3. Click to activate
4. Verify:
   - Button changes to purple-pink gradient
   - Button pulses
   - Can speak commands
   - Navigation works
5. Click again to deactivate
6. Verify button returns to inactive state

## Notes

- The main page (`/app/page.tsx`) already has a FooterBar with voice controls, so it doesn't need the floating button
- The floating button is specifically for dashboard pages where the FooterBar isn't present
- Voice state is managed locally in each page component
- No global state management needed (each page is independent)

