Plant Tracker is a production-ready, highly aesthetic gardening management SaaS application. It compiles cleanly with Next.js App Router, TypeScript, and Tailwind CSS. The app features complete bilingual (English/Thai) support with Thai (TH) configured as the default language for landing, login/registration pages, and new user profiles. It also includes light/dark theme synchronization, unified client/server services, and custom SVG charting widgets.

---

## Thai Language Default Configuration
- **Initial Context**: The default language for the entire workspace is set to **Thai (`th`)**. 
- **Sign-Up Defaulting**: Newly registered user profiles (via Supabase or mock LocalStorage auth) are initialized with `language: "th"` by default.
- **Language Switcher**: A switcher remains fully functional in the navigation sidebar, allowing seamless toggling between English (EN) and Thai (TH) at any time.
- **Full Localization**: All page elements, form inputs, toasts, empty state placeholders, and activities have been translated to Thai to ensure a complete, native experience.

## Features Completed & Delivered

### 1. Unified Authentication Service (`src/services/auth.ts`)
- **Dual Mode**: Connects to Supabase Auth when `.env.local` keys are provided. Automatically falls back to high-fidelity browser `LocalStorage` auth sessions if variables are absent.
- **Support**: Form logins, signups, Google authentication simulation, password resets, and user preference sync.

### 2. Unified Database Service (`src/services/db.ts`)
- **Gardens**: CRUD operations grouped by name, descriptions, and cover image bindings.
- **Plants**: CRUD operations featuring status trackers (`healthy`, `flowering`, `fruiting`, `dormant`, `sick`), locations, planting dates, and archiving mechanisms.
- **Activities & timeline**: Activity snap logs for Waterings, Fertilizations, Prunings, Repottings, Pest Controls, and Observations. Updates scheduler parameters in real time.
- **Schedules calculation**: Automatically computes Next Due Dates (`last_performed` + `interval_days`) and dynamic statuses (`overdue`, `due today`, `upcoming`, `pending`).
- **Notifications**: Dashboard notifications scanning schedules for due/overdue items with unread counts and clear buttons.
- **Global Search**: Search indexing matching plant titles, species, and notes, complete with quick click redirections.
- **Sample data**: Auto-populates the database with realistic sample plants (Rose, Holy Basil, Basil, Chili, Tomato) and scheduler lines in Local Demo Mode.

### 3. Localization Dictionary Context (`src/context/LanguageContext.tsx`)
- Context hooks (`useTranslation`) serving nested JSON localization maps (`src/locales/en.ts`, `src/locales/th.ts`) for all headers, charts, calendar months, and inputs.

### 4. Layout Theme Engine (`src/context/ThemeContext.tsx` & `src/app/globals.css`)
- Persistent light/dark/system selectors syncing custom Tailwind CSS v4 variables with transition durations.

### 5. Application Modules & Pages
- **Welcome Page** ([page.tsx](file:///Users/sorleeheen.yus/.gemini/antigravity-ide/scratch/plant-tracker/src/app/page.tsx)): Highly stylized features splash page prompting login redirects.
- **Dashboard** ([dashboard/page.tsx](file:///Users/sorleeheen.yus/.gemini/antigravity-ide/scratch/plant-tracker/src/app/dashboard/page.tsx)): Aggregate metric cards, SVG Status and monthly activities bar charts, today's schedule checklist, upcoming items, and recent care log timelines.
- **Plants & Gardens** ([plants/page.tsx](file:///Users/sorleeheen.yus/.gemini/antigravity-ide/scratch/plant-tracker/src/app/plants/page.tsx)): Multi-modal forms containing garden lists, plant filters, and tab panels showing plant profiles, care records, growth calendars, and growth stats.
- **Care History Logs** ([activities/page.tsx](file:///Users/sorleeheen.yus/.gemini/antigravity-ide/scratch/plant-tracker/src/app/activities/page.tsx)): Scrollable timeline of care events with plant selectors.
- **Planner Calendar** ([calendar/page.tsx](file:///Users/sorleeheen.yus/.gemini/antigravity-ide/scratch/plant-tracker/src/app/calendar/page.tsx)): Dynamic month calendar cell mapping task checklists.
- **Photos Gallery Comparison** ([photos/page.tsx](file:///Users/sorleeheen.yus/.gemini/antigravity-ide/scratch/plant-tracker/src/app/photos/page.tsx)): Chronological snapshot grid with an interactive slide comparison handler.
- **Settings Preferences** ([settings/page.tsx](file:///Users/sorleeheen.yus/.gemini/antigravity-ide/scratch/plant-tracker/src/app/settings/page.tsx)): Profile editor syncing details to the DB.

### 6. Production Database migration script
- [schema.sql](file:///Users/sorleeheen.yus/.gemini/antigravity-ide/scratch/plant-tracker/schema.sql) PostgreSQL script containing profile auto-creation trigger hooks on signup.

---

## Validation & Build Verification Results

We verified compiling states by triggering standard optimization builds:
```bash
npm run build
```
- **Prerender metrics**: All pages compile successfully under Turbopack as pure static content.
- **Type Checking**: Clean TypeScript type checking output without errors.
- **Bundle optimizations**: Clean styles compilation with Tailwind PostCSS.

---

## Instructions for Local Run & Live Deployment

### A. How to Run Locally Right Now
1. Open the directory `/Users/sorleeheen.yus/.gemini/antigravity-ide/scratch/plant-tracker` as your active IDE workspace.
2. In your terminal, run the following:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:3000` in your browser.
4. Experience the app in **Local Demo Mode** by logging in or registering. Click "+ Add Plant" or mark a task complete on the dashboard to test the real-time scheduler updates!

### B. How to Connect to your Supabase Project
1. Create a database in your Supabase console and execute the SQL script in [schema.sql](file:///Users/sorleeheen.yus/.gemini/antigravity-ide/scratch/plant-tracker/schema.sql) in the **SQL Editor**.
2. Create a file named `.env.local` inside `/Users/sorleeheen.yus/.gemini/antigravity-ide/scratch/plant-tracker`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
   ```
3. Restart your development server (`npm run dev`). The client will automatically transition from LocalStorage to fetch records directly from your Supabase DB!
