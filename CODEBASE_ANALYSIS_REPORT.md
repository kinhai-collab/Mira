# Mira Project - Comprehensive Codebase Analysis Report

**Generated:** Analysis of complete project structure, file connections, data flow, and architecture

---

## 📁 PROJECT STRUCTURE OVERVIEW

```
Mira/
├── MIRA_MVP0/
│   ├── frontend/          # Next.js 15.5.5 (React 19.1.0) Application
│   ├── backend/           # FastAPI Python Backend
│   └── package.json       # Root-level dependencies (react-icons)
├── amplify.yml            # AWS Amplify deployment config
└── README.md              # Project documentation
```

---

## 🏗️ ARCHITECTURE OVERVIEW

### **Technology Stack**

**Frontend:**
- **Framework:** Next.js 15.5.5 with App Router
- **React:** 19.1.0
- **Language:** TypeScript 5
- **Styling:** TailwindCSS 4
- **Build:** Static export (`output: 'export'`)
- **Deployment:** AWS Amplify

**Backend:**
- **Framework:** FastAPI 0.119.0
- **Language:** Python 3.10+
- **Deployment:** AWS Lambda (via Mangum adapter)
- **Database:** Supabase (PostgreSQL)
- **Server:** Uvicorn (local development)

**External Services:**
- **Supabase:** Authentication + Database
- **Google APIs:** Gmail, Calendar OAuth
- **Microsoft Graph API:** Outlook/Calendar OAuth
- **OpenAI:** Whisper (STT), GPT-4o-mini (Chat)
- **ElevenLabs:** Text-to-Speech

---

## 🔗 FILE CONNECTIONS & DATA FLOW

### **1. BACKEND ENTRY POINTS**

#### **main.py** - Central FastAPI Application
- **Location:** `MIRA_MVP0/backend/main.py`
- **Purpose:** Main FastAPI app initialization
- **Connections:**
  - Imports and registers all routers:
    - `auth_router` from `auth.py`
    - `greetings_router` from `greetings.py`
    - `tts_router` from `tts_server.py`
    - `gmail_events` from `gmail_events.py`
    - `voice_router` from `voice/voice_generation.py` (prefix: `/api`)
    - `settings` from `settings.py`
    - `outlook_events` from `outlook_events.py`
    - Google Calendar API via `register_google_calendar()` from `Google_Calendar_API/__init__.py`
- **CORS Configuration:**
  - `http://localhost:3000` (local dev)
  - `https://main.dd480r9y8ima.amplifyapp.com` (production)
- **Environment:** Loads `.env` via `load_dotenv()`

#### **lambda_handler.py** - AWS Lambda Entry Point
- **Location:** `MIRA_MVP0/backend/lambda_handler.py`
- **Purpose:** Wraps FastAPI app for AWS Lambda deployment
- **Connection:** Imports `app` from `main.py`, wraps with Mangum

---

### **2. AUTHENTICATION & USER MANAGEMENT**

#### **auth.py** - Authentication Router
- **Location:** `MIRA_MVP0/backend/auth.py`
- **Endpoints:**
  - `POST /signup` - User registration via Supabase
  - `POST /signin` - User login via Supabase
  - `GET /me` - Get current user profile
  - `POST /profile_update` - Update user metadata
  - `POST /onboarding_save` - Save onboarding data to Supabase `onboarding` table
  - `GET /onboarding_status` - Check if user completed onboarding
  - `GET /onboarding_data` - Get full onboarding data
  - `GET /gmail/auth` - Start Gmail OAuth flow
  - `GET /gmail/auth/callback` - Handle Gmail OAuth callback
  - `GET /microsoft/auth` - Start Microsoft OAuth flow
  - `GET /microsoft/auth/callback` - Handle Microsoft OAuth callback
  - `GET /test` - Health check
  - `GET /debug/env` - Environment debug endpoint
- **Connections:**
  - **Supabase Auth API:** Direct HTTP calls to Supabase auth endpoints
  - **Google OAuth:** Redirects to Google consent screen, exchanges tokens
  - **Microsoft Graph API:** OAuth flow for Outlook/Calendar
  - **Environment Variables:** Reads from `.env` (SUPABASE_URL, SUPABASE_KEY, GOOGLE_CLIENT_ID, etc.)
- **Data Flow:**
  1. User signs up/logs in → Supabase Auth → Returns JWT token
  2. Token stored in frontend localStorage
  3. Token validated on backend via Supabase `/auth/v1/user` endpoint
  4. Onboarding data stored in Supabase `public.onboarding` table

---

### **3. FRONTEND STRUCTURE**

#### **Root Layout**
- **Location:** `MIRA_MVP0/frontend/src/app/layout.tsx`
- **Purpose:** Root layout with global styling and components
- **Connections:**
  - Imports `ConditionalSidebar` component
  - Imports `MainContent` component
  - Uses Google Font (Outfit)

#### **ConditionalSidebar.tsx**
- **Location:** `MIRA_MVP0/frontend/src/components/ConditionalSidebar.tsx`
- **Purpose:** Conditionally renders sidebar based on route
- **Logic:** Hides sidebar on `/login`, `/signup`, `/onboarding/*`, `/auth/*`, `/landing`
- **Connection:** Imports and renders `Sidebar` component

#### **Page Structure:**
```
src/app/
├── page.tsx              # Home page (dashboard entry)
├── layout.tsx            # Root layout
├── globals.css           # Global styles
├── login/page.tsx        # Login page
├── signup/page.tsx       # Signup page
├── auth/callback/page.tsx # OAuth callback handler
├── landing/page.tsx      # Landing page
├── dashboard/
│   ├── page.tsx          # Main dashboard
│   ├── profile/page.tsx  # User profile
│   ├── remainder/page.tsx # Reminders
│   └── settings/page.tsx # Settings (most complex)
└── onboarding/
    ├── step1/page.tsx    # Terms & Tools selection
    ├── step2/page.tsx    # Name collection
    ├── step3/page.tsx    # Email integration (Gmail/Outlook)
    ├── step4/page.tsx    # Calendar integration
    └── step5/page.tsx    # Permissions
```

---

### **4. API COMMUNICATION FLOW**

#### **Frontend → Backend Communication**

**Base URL Configuration:**
- Environment variable: `NEXT_PUBLIC_API_URL`
- Default: `http://127.0.0.1:8000`
- Production: `https://ytm2meewyf.execute-api.us-east-2.amazonaws.com/dev` (from amplify.yml)

**Key API Calls:**

1. **Authentication:**
   - `POST /signin` - Login (from `login/page.tsx`)
   - `POST /signup` - Registration (from `signup/page.tsx`)
   - `GET /me` - Get user profile (from multiple pages)

2. **Onboarding:**
   - `POST /onboarding_save` - Save onboarding data (from onboarding steps)
   - `GET /onboarding_status` - Check completion (from `page.tsx` home)
   - `GET /onboarding_data` - Load data (from `settings/page.tsx`)

3. **Profile:**
   - `POST /profile_update` - Update profile (from settings)
   - `GET /greeting` - Personalized greeting (from dashboard)

4. **Email/Calendar:**
   - `GET /gmail/events` - Fetch Gmail calendar events (from `gmail_events.py`)
   - `GET /outlook/emails` - Fetch Outlook email ICS (from `outlook_events.py`)
   - `GET /outlook/calendar` - Fetch Outlook calendar (from `outlook_events.py`)
   - `POST /gmail/events/rsvp` - RSVP to Gmail event
   - `POST /outlook/events/rsvp` - RSVP to Outlook event

5. **Google Calendar API:**
   - `GET /google/calendar/events` - List events (from `Google_Calendar_API/api_router.py`)
   - `POST /google/calendar/events` - Create event
   - `PATCH /google/calendar/events/{id}` - Update event
   - `DELETE /google/calendar/events/{id}` - Delete event
   - `POST /google/calendar/watch` - Start webhook watch
   - `GET /google/calendar/oauth/start` - OAuth start (from `oauth_router.py`)
   - `GET /google/calendar/oauth/callback` - OAuth callback

6. **Voice/TTS:**
   - `GET /tts/tts` - Text-to-speech (from `tts_server.py`)
   - `GET /api/voice` - Voice generation (from `voice/voice_generation.py`)

---

### **5. UTILITIES & HELPERS**

#### **Frontend Utilities**

**auth.ts** - Authentication Utilities
- **Location:** `MIRA_MVP0/frontend/src/utils/auth.ts`
- **Functions:**
  - `extractTokenFromUrl()` - Extracts JWT from URL hash
  - `extractUserDataFromToken()` - Parses JWT to extract user info
  - `storeAuthToken()` - Stores token and user data in localStorage
  - `getStoredToken()` - Retrieves token from localStorage
  - `getStoredUserData()` - Gets user data from localStorage
  - `clearAuthTokens()` - Clears all auth data
  - `isAuthenticated()` - Checks if user is logged in
  - `requireAuth()` - Redirects to login if not authenticated
  - `refreshUserData()` - Fetches fresh user data from `/me` endpoint
- **Data Storage:** Uses localStorage keys:
  - `access_token` / `token`
  - `mira_email`
  - `mira_full_name`
  - `mira_username`
  - `mira_profile_picture`
  - `mira_provider`
  - `mira_conversation` (voice chat history)

**supabaseClient.ts** - Supabase Client
- **Location:** `MIRA_MVP0/frontend/src/utils/supabaseClient.ts`
- **Purpose:** Creates Supabase client instance
- **Environment:** Uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Note:** Currently imported but usage unclear (may be legacy)

**Voice Utilities:**
- **voice.ts** - Voice playback functions
  - `playVoice(text)` - Calls backend TTS endpoint, plays audio
  - `stopVoice()` - Stops current audio playback
- **voiceHandler.ts** - Voice conversation handler
  - `startMiraVoice()` - Starts continuous voice conversation loop
  - `stopMiraVoice()` - Stops conversation
  - `setMiraMute()` - Global mute control
  - Records audio → Sends to `/api/voice` → Plays response

---

#### **Backend Utilities**

**settings.py** - User Settings Router
- **Location:** `MIRA_MVP0/backend/settings.py`
- **Purpose:** User profile and preferences management
- **Endpoints:**
  - `POST /user_profile_save` - Save name/email
  - `POST /user_preferences_save` - Save language/timezone/voice
  - `POST /user_notifications_save` - Save notification settings
  - `POST /user_privacy_save` - Save connected emails/calendars
  - `POST /user_subscription_save` - Save subscription plan
- **Database:** Stores in Supabase `user_profile` table
- **Auth:** Uses Supabase client to extract UID from Bearer token

**greetings.py** - Personalized Greetings
- **Location:** `MIRA_MVP0/backend/greetings.py`
- **Endpoint:** `POST /greeting`
- **Purpose:** Returns personalized greeting based on user's name and time of day
- **Data Source:** Fetches name from `onboarding` table via email
- **Logic:** Determines "morning/afternoon/evening" from local time

---

### **6. EMAIL & CALENDAR INTEGRATIONS**

#### **Gmail Integration (gmail_events.py)**
- **Purpose:** Extract calendar events from Gmail (.ics attachments)
- **Endpoints:**
  - `GET /gmail/events` - Fetch events from Gmail
  - `POST /gmail/events/rsvp` - RSVP to calendar event
- **Flow:**
  1. Queries Gmail API for messages with `.ics` attachments
  2. Downloads and parses ICS files
  3. Extracts event details (organizer, subject, start, end, location, description)
  4. RSVP flow: Finds event in Google Calendar → Updates attendee status
- **Dependencies:** 
  - Gmail API (OAuth access token required)
  - Google Calendar API
  - BeautifulSoup (HTML parsing)
  - icalendar (ICS parsing)

#### **Outlook Integration (outlook_events.py)**
- **Purpose:** Extract events from Outlook/Exchange
- **Endpoints:**
  - `GET /outlook/emails` - Fetch ICS from Outlook emails
  - `GET /outlook/calendar` - Fetch calendar events directly
  - `POST /outlook/events/rsvp` - RSVP to Outlook event
- **Flow:**
  1. Uses Microsoft Graph API
  2. Fetches messages with calendar attachments OR direct calendar events
  3. Parses ICS or native event format
  4. RSVP via Graph API endpoints (`/accept`, `/decline`, `/tentativelyAccept`)
- **Dependencies:**
  - Microsoft Graph API (OAuth access token required)
  - icalendar
  - BeautifulSoup

#### **Google Calendar API Module**
- **Location:** `MIRA_MVP0/backend/Google_Calendar_API/`
- **Structure:**
  - `__init__.py` - Registers routers
  - `oauth_router.py` - OAuth flow (PKCE)
  - `api_router.py` - Calendar CRUD operations
  - `service.py` - Core calendar service logic
  - `settings.py` - Configuration
  - `supa.py` - Supabase client wrapper
  - `rate_limit.py` - Token bucket rate limiting
  - `sql_migration.sql` - Database schema
- **OAuth Flow:**
  1. User clicks connect → `/google/calendar/oauth/start`
  2. Generates PKCE verifier + state → Stores in Supabase `oauth_pkce_state`
  3. Redirects to Google OAuth
  4. Callback → `/google/calendar/oauth/callback`
  5. Exchanges code for tokens → Stores in `google_calendar_credentials`
- **Calendar Operations:**
  - List events (with pagination, time filters)
  - Create events
  - Update events (PATCH)
  - Delete events
  - Watch for changes (webhook notifications)
- **Rate Limiting:**
  - Token bucket algorithm
  - Configurable: `GCALENDAR_RATE_LIMIT_MAX` (default: 1000)
  - Window: `GCALENDAR_RATE_LIMIT_WINDOW_SEC` (default: 100s)
- **Database Tables:**
  - `google_calendar_credentials` - Stores OAuth tokens, sync tokens, webhook channels
  - `oauth_pkce_state` - Temporary OAuth state storage
  - Row Level Security (RLS) enabled - backend only access

---

### **7. VOICE & TTS SYSTEM**

#### **Frontend Voice Flow**

**route.ts** (Next.js API Route)
- **Location:** `MIRA_MVP0/frontend/src/app/api/voice/route.ts`
- **Purpose:** Server-side voice processing endpoint
- **Flow:**
  1. Receives audio file (WebM format) via POST
  2. Saves to temporary file
  3. Sends to OpenAI Whisper for transcription (STT)
  4. Generates response using GPT-4o-mini
  5. Calls backend TTS endpoint (`/tts/tts`) for audio generation
  6. Returns text + base64 audio
- **Dependencies:**
  - OpenAI API (Whisper + GPT-4o-mini)
  - Backend TTS service
- **Environment:** `OPENAI_API_KEY` required

**voiceHandler.ts** - Client-side Voice Handler
- **Location:** `MIRA_MVP0/frontend/src/utils/voice/voiceHandler.ts`
- **Flow:**
  1. `startMiraVoice()` starts conversation loop
  2. Records audio (5-second chunks, WebM format)
  3. Sends to `/api/voice` endpoint
  4. Receives transcription + response text + audio
  5. Plays audio response
  6. Maintains conversation history in localStorage
- **Storage:** Conversation history stored as `mira_conversation` in localStorage

#### **Backend TTS Services**

**tts_server.py** - Text-to-Speech Server
- **Location:** `MIRA_MVP0/backend/tts_server.py`
- **Endpoint:** `GET /tts/tts?text=...&mood=...`
- **Purpose:** Converts text to speech using ElevenLabs
- **Features:**
  - Unicode normalization
  - Markdown/styling removal
  - Text chunking (800 char max per chunk)
  - Mood-based voice settings (excited, calm, neutral, happy, serious, whisper)
  - Multilingual support (`eleven_multilingual_v2` model)
- **Response:** Base64-encoded MP3 audio
- **Environment:** `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`

**voice_generation.py** - Alternative Voice Endpoint
- **Location:** `MIRA_MVP0/backend/voice/voice_generation.py`
- **Endpoint:** `GET /api/voice`
- **Purpose:** Streams audio directly (StreamingResponse)
- **Model:** `eleven_turbo_v2`
- **Format:** MP3 44100Hz 128kbps

---

### **8. DATABASE SCHEMA (Supabase)**

#### **Tables:**

1. **auth.users** (Supabase Auth)
   - Managed by Supabase
   - Contains: id, email, user_metadata, app_metadata

2. **public.onboarding**
   - Stores onboarding completion data
   - Fields: email, consents, selectedTools, firstName, middleName, lastName, connectedEmails, connectedCalendars, pushNotifications, microphoneAccess, wakeWordDetection
   - Access: Via backend service role key

3. **public.user_profile**
   - User profile and preferences
   - Fields: uid (FK to auth.users), email, firstName, middleName, lastName, language, time_zone, voice, pushNotifications, microphoneAccess, wakeWordDetection, connectedEmails, connectedCalendars, subscriptionPlan

4. **public.google_calendar_credentials**
   - Google Calendar OAuth tokens
   - Fields: uid, email, access_token, refresh_token, expiry, scope, token_type, next_sync_token, channel_id, resource_id, channel_expiration
   - RLS: Backend-only access

5. **public.oauth_pkce_state**
   - Temporary OAuth state storage
   - Fields: state (PK), code_verifier, uid, created_at
   - RLS: Backend-only access

---

### **9. ENVIRONMENT VARIABLES**

#### **Frontend (.env or amplify.yml)**
```
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000 (or production URL)
NEXT_PUBLIC_SUPABASE_URL=<supabase_project_url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase_anon_key>
OPENAI_API_KEY=<openai_api_key> (for /api/voice route)
```

#### **Backend (.env)**
```
# Supabase
SUPABASE_URL=<supabase_project_url>
SUPABASE_KEY=<supabase_anon_key>
SUPABASE_SERVICE_ROLE_KEY=<supabase_service_role_key>

# Google OAuth
GOOGLE_CLIENT_ID=<google_client_id>
GOOGLE_CLIENT_SECRET=<google_client_secret>
GOOGLE_REDIRECT_URI=<callback_url>
GOOGLE_WEBHOOK_URL=<webhook_url>

# Google Calendar Sync
GCALENDAR_INITIAL_SYNC_MONTHS_BACK=12
GCALENDAR_INITIAL_SYNC_MONTHS_FWD=18
GCALENDAR_RATE_LIMIT_MAX=1000
GCALENDAR_RATE_LIMIT_WINDOW_SEC=100.0

# Microsoft OAuth
MICROSOFT_CLIENT_ID=<microsoft_client_id>
MICROSOFT_CLIENT_SECRET=<microsoft_client_secret>
MICROSOFT_REDIRECT_URI=<callback_url>

# ElevenLabs TTS
ELEVENLABS_API_KEY=<elevenlabs_api_key>
ELEVENLABS_VOICE_ID=<elevenlabs_voice_id>

# Server Configuration
REDIRECT_URI=<gmail_oauth_callback_url>
FRONTEND_URL=<frontend_url>
```

---

### **10. DEPLOYMENT CONFIGURATION**

#### **AWS Amplify (amplify.yml)**
- **Location:** Root directory
- **Build Process:**
  1. `cd MIRA_MVP0/frontend`
  2. `npm ci` - Install dependencies
  3. `npm run build` - Build Next.js (static export)
- **Environment:**
  - `NEXT_PUBLIC_API_URL` set to AWS Lambda API Gateway URL
- **Artifacts:**
  - Output directory: `MIRA_MVP0/frontend/out`
  - Static files only (no server-side rendering)

#### **AWS Lambda (Backend)**
- **Handler:** `lambda_handler.handler` (via Mangum)
- **Deployment:** Serverless Framework (package.json scripts)
- **API Gateway:** REST API endpoint
- **Production URL:** `https://ytm2meewyf.execute-api.us-east-2.amazonaws.com/dev`

---

### **11. DATA FLOW DIAGRAMS**

#### **Authentication Flow:**
```
User → Frontend (login/page.tsx)
  → POST /signin → Backend (auth.py)
    → Supabase Auth API
      → Returns JWT token
        → Frontend stores in localStorage
          → Redirects to home/dashboard
```

#### **Gmail OAuth Flow:**
```
User clicks "Connect Gmail"
  → GET /gmail/auth → Backend (auth.py)
    → Redirects to Google OAuth
      → User authorizes
        → GET /gmail/auth/callback
          → Backend exchanges code for token
            → Redirects to frontend /onboarding/step3?gmail_connected=true&access_token=...
              → Frontend stores token
```

#### **Voice Conversation Flow:**
```
User starts voice (startMiraVoice())
  → Records audio (5s chunks)
    → POST /api/voice → Frontend API route (route.ts)
      → Saves audio file
        → OpenAI Whisper (transcription)
          → GPT-4o-mini (response generation)
            → GET /tts/tts → Backend (tts_server.py)
              → ElevenLabs API (TTS)
                → Returns audio
                  → Frontend plays audio
                    → Loop continues
```

#### **Google Calendar Sync Flow:**
```
User connects calendar
  → GET /google/calendar/oauth/start
    → Generates PKCE verifier + state
      → Stores in Supabase (oauth_pkce_state)
        → Redirects to Google
          → User authorizes
            → GET /google/calendar/oauth/callback
              → Exchanges code (with verifier)
                → Stores tokens in Supabase (google_calendar_credentials)
                  → Initial sync (list_events)
                    → Stores events
                      → Sets up webhook (POST /google/calendar/watch)
                        → Google sends notifications to /google/calendar/notifications
```

---

### **12. KEY DEPENDENCIES**

#### **Frontend (package.json)**
```json
{
  "next": "15.5.5",
  "react": "19.1.0",
  "react-dom": "19.1.0",
  "@supabase/supabase-js": "^2.76.1",
  "date-fns": "^4.1.0",
  "lucide-react": "^0.545.0",
  "tailwindcss": "^4",
  "typescript": "^5"
}
```

#### **Backend (requirements.txt)**
```
fastapi==0.119.0
uvicorn[standard]==0.37.0
mangum==0.17.0
python-dotenv==1.1.1
requests==2.32.5
supabase>=2.5.1
openai
elevenlabs==2.18.0
google-api-python-client
google-auth-oauthlib
icalendar
beautifulsoup4
python-dateutil
pytz
```

---

### **13. SECURITY CONSIDERATIONS**

1. **Authentication:**
   - JWT tokens stored in localStorage (vulnerable to XSS)
   - Tokens validated via Supabase on backend
   - Service role key used for backend database access

2. **OAuth:**
   - Google: Uses PKCE for Google Calendar (secure)
   - Gmail: Uses standard OAuth (client_secret required)
   - Microsoft: Standard OAuth flow

3. **CORS:**
   - Configured for specific origins only
   - Credentials allowed

4. **Database:**
   - Row Level Security (RLS) enabled
   - Service role key for backend access (no direct client access)

5. **Environment Variables:**
   - Sensitive keys should not be exposed
   - Frontend uses `NEXT_PUBLIC_*` prefix (exposed to browser)

---

### **14. CONFIGURATION ISSUES & NOTES**

1. **Next.js Static Export:**
   - `output: 'export'` in `next.config.ts`
   - No server-side rendering
   - API routes work only in development (not in static export)
   - `/api/voice` route may not work in production static build

2. **Backend URL Hardcoding:**
   - Some files reference `http://127.0.0.1:8000` as default
   - Should rely on environment variables consistently

3. **Frontend API Route:**
   - `/api/voice` uses filesystem (`fs`, `path`)
   - May not work in serverless environments (AWS Lambda/Amplify)
   - Should use in-memory processing or external storage

4. **Database Access:**
   - Multiple ways to access Supabase:
     - Direct HTTP calls (auth.py)
     - Supabase Python client (settings.py, Google Calendar API)
     - Frontend Supabase client (supabaseClient.ts - unused?)

5. **Environment Variable Loading:**
   - Backend uses `load_dotenv()` in multiple files
   - Frontend uses `process.env.NEXT_PUBLIC_*` (build-time)

---

### **15. INTEGRATION POINTS**

**Supabase:**
- Authentication: `/auth/v1/*` endpoints
- Database: `/rest/v1/*` endpoints (onboarding, user_profile)
- Service role key for admin operations

**Google APIs:**
- Gmail API: Read emails, extract ICS
- Calendar API: CRUD operations, webhooks
- OAuth 2.0: Authorization code flow

**Microsoft Graph API:**
- Mail API: Read messages, extract attachments
- Calendar API: List/create/update events, RSVP

**OpenAI:**
- Whisper API: Speech-to-text
- GPT-4o-mini: Chat completion

**ElevenLabs:**
- Text-to-Speech API: Voice synthesis

---

## 📊 SUMMARY

**Architecture Type:** Full-stack monorepo with separate frontend/backend

**Frontend:** Next.js static site, client-side routing, API calls to backend

**Backend:** FastAPI REST API, serverless-ready (Lambda), Supabase integration

**Data Storage:** Supabase (PostgreSQL) + localStorage (client-side)

**External Integrations:** Google (Gmail/Calendar), Microsoft (Outlook/Calendar), OpenAI, ElevenLabs

**Deployment:**
- Frontend: AWS Amplify (static hosting)
- Backend: AWS Lambda (serverless)

**Key Features:**
- User authentication & onboarding
- Email/calendar integration (Gmail, Outlook)
- Voice conversation (STT + LLM + TTS)
- Calendar event management
- RSVP functionality

---

**End of Report**

