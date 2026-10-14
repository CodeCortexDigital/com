# QuickBrain: Personal Memory & Life-Record App
### Complete Build Document (Web App → Android App on Google Play)

Version 1.0 · Date: 2026-10-14

---

## 1. Purpose

QuickBrain is a **"second brain" for everyday life**. It remembers for you:

- **What was done** and on which date (history)
- **What is due** (school fee last date 15 Oct, bills, installments)
- **What was paid / not paid** (per child, per person, per item)
- **What is coming** (doctor on Monday 8 am)
- **Anything personal**: user-defined events and records of any kind

Design goal: **usable by any age and any type of person**: big text, simple words, few taps, English + Urdu, works offline.

### 1.1 Problems it solves (from the owner's requirements)
| Problem | Solution |
|---|---|
| "Last date was 15 Oct, I forgot, date is over" | Due-date items with countdown and 3-day / 1-day / same-day reminders; Overdue turns red |
| "I paid for one child, don't remember if paid" | Payment ledger per person, with status Paid / Pending / Partial / Overdue |
| "Doctor on Monday 8 am, after that I forget it happened" | Events auto-move to History as Done / Missed, with notes |
| "Where did money go?" | Expense recorder, categories, monthly totals |
| "I want to find anything quickly" | Global search across everything |
| "My own kind of record" | Custom record types (user designs fields) |

---

## 2. Feature List (Modules 1–20 + Custom Records)

| # | Module | Priority |
|---|---|---|
| 1 | Due dates & bills with status (Pending/Paid/Overdue/Partial) and countdown | MVP |
| 2 | Payment record per person/item (history of every payment) | MVP |
| 3 | Expense recorder (amount, category, date, note, method) | MVP |
| 4 | Events & appointments (auto-move to History as Done/Missed) | MVP |
| 5 | Reminders / notifications (3 days, 1 day, same day, custom) | MVP |
| 6 | Recurring items (monthly fee, rent, bill, installment) | MVP |
| 7 | History & search (filter by date, person, category) | MVP |
| 8 | People profiles (child, spouse, parent, etc.) | MVP |
| 9 | Notes on each entry (receipt no., doctor advice) | MVP |
| 10 | Photo / document attach (fee slip, receipt, prescription) | v1.1 |
| 11 | Dashboard: Today / This week / Overdue / Month spend | MVP |
| 12 | Monthly report + PDF / Excel (CSV) export | v1.1 |
| 13 | Daily diary note (free text + mood) | MVP |
| 14 | Backup & restore to Google (date-wise snapshots) | MVP |
| 15 | PIN / fingerprint lock | v1.1 |
| 16 | Budget limits with 80% / 100% warnings | v1.2 |
| 17 | Loans: money lent / borrowed and returned | v1.1 |
| 18 | Documents & expiry dates (passport, ID, insurance, car papers) | v1.1 |
| 19 | English / Urdu (RTL) language switch | MVP |
| 20 | Home-screen widget (today's items) | v1.2 (Android native) |
| 21 | **Custom records**: user builds own record type with own fields | MVP |
| 22 | **Global search** across all modules | MVP |
| 23 | **Login with Firebase** (email/password + Google sign-in) | MVP |

**Quick-brain extras**
- One-tap **Quick Add** (floating "+" button): type a sentence like *"Ali school fee 5000 due 15 Oct"* and the app pre-fills the form (simple text parser).
- **Voice input** for quick add (Web Speech API / Android speech).
- **"What did I miss?"** screen: all overdue and missed items in one list.
- **Timeline view** for any person.

---

## 3. Recommended Architecture

### 3.1 Technology choice

| Layer | Choice | Why |
|---|---|---|
| UI | **React + Vite + TypeScript** (PWA) | Fast, one codebase for web and Android |
| Styling | Tailwind CSS (RTL plugin for Urdu) | Responsive, large-text friendly |
| Local DB | **IndexedDB via Dexie.js** | Works offline, fast, large storage |
| Auth | **Firebase Authentication** (Email + Google) | Requested |
| Cloud data / backup | **Cloud Firestore** + **Firebase Storage** (photos) | Sync + date-wise backup |
| Notifications | Capacitor Local Notifications (Android) + Firebase Cloud Messaging (web) | Reliable reminders |
| Android packaging | **Capacitor** (wraps the web app into a native Android project) | Publish on Play Store; native plugins (camera, biometric, notifications, widget) |
| Hosting (web) | Firebase Hosting | Free tier, HTTPS, same project |
| Export | jsPDF (PDF), CSV generator | Reports |
| Testing | Vitest (unit), Playwright (e2e), real Android phone | |

> Alternative: Flutter (single codebase, strong native feel). React + Capacitor is recommended here because the same code gives a web app, a PWA and an Android app, and it can be tested directly in a mobile browser first.

### 3.2 Offline-first design
1. All reads/writes go to **IndexedDB first** (instant, works with no internet).
2. A **sync engine** pushes changes to Firestore when online (queue with `updatedAt`, `deleted` flags).
3. Conflict rule: **last-write-wins per record** using `updatedAt`; deletes are soft (tombstones).
4. User data path in Firestore: `users/{uid}/...` only readable/writable by that user.

### 3.3 High-level diagram
```
[ UI (React) ]
      |
[ Domain services: bills, payments, events, search, reminders ]
      |
[ Dexie / IndexedDB  <-- sync engine -->  Firestore ]
      |                                      |
[ Local notifications ]            [ Backup snapshots + Storage ]
      |
[ Capacitor Android shell -> Play Store ]
```

---

## 4. Data Model

All records share base fields:
`id (uuid), createdAt, updatedAt, deleted (bool), ownerUid`

### 4.1 Collections

**people**
`name, relation (child/spouse/parent/other), photoUrl?, dob?, notes, color`

**items** (unified "thing with a date": bills, fees, events, custom records)
```
type: 'bill' | 'event' | 'expense' | 'loan' | 'document' | 'custom'
title
personId?            // who it is for
categoryId?
date                 // event date / due date / expense date (ISO)
time?                // for events (HH:mm)
endDate?             // optional range
amount?              // money amount
currency
status               // bill: pending|partial|paid|overdue ; event: upcoming|done|missed|cancelled
recurrence?          // { freq: daily|weekly|monthly|yearly, interval, until? }
reminders[]          // [{ offsetMinutes: 4320 }, { offsetMinutes: 1440 }, { offsetMinutes: 0 }]
notes
attachments[]        // [{ id, localPath, remoteUrl, mime }]
customTypeId?        // when type = custom
customFields{}       // key -> value for custom types
tags[]
```

**payments** (ledger entries linked to a bill/fee/loan)
`itemId, personId?, amount, paidOn, method (cash|bank|online|other), receiptNo, notes, attachments[]`

**customTypes** (user-designed record types)
```
name              // e.g. "Vaccination", "Car Service", "Gym Visit"
icon, color
fields[]          // [{ key, label, kind: text|number|date|time|money|yesno|choice|photo, required, choices? }]
```

**categories**
`name, kind (expense|bill|event), icon, color`

**diary**
`date (unique per day), text, mood (1–5), tags[]`

**budgets**
`categoryId?, month (YYYY-MM), limit`

**settings** (local + synced)
`language, theme, fontScale, pinHash?, biometric, defaultReminders[], currency, weekStart`

**backups_meta**
`id, createdAt, deviceName, counts{}, sizeBytes, storagePath`

### 4.2 Derived logic
- **Bill status**: `paid` if sum(payments) ≥ amount; `partial` if 0 < sum < amount; `overdue` if not paid and `date < today`; else `pending`.
- **Event status**: when `date+time` passes and status is `upcoming` → prompt user "Did it happen?"; unanswered after 24 h → `missed` (editable).
- **Recurring**: generate next occurrence on completion or via a rolling window (create occurrences 60 days ahead).

---

## 5. Screens & Navigation

Bottom tabs (5): **Home · Calendar · + (Quick Add) · History · More**

1. **Home / Dashboard**
   - Greeting + today's date (and Hijri date optional)
   - Cards: *Overdue (red)*, *Today*, *Next 7 days*, *This month spend*
   - "What did I miss?" button
2. **Calendar**: month/week/agenda; dot colors by type; tap a day → list + add
3. **Quick Add**: sheet with type buttons (Bill, Event, Expense, Payment, Note, Custom…) + sentence box + mic
4. **History**: reverse-chronological timeline; filters (date range, person, type, status, category); date-wise grouping
5. **Search** (top bar on every screen): global search (see §8)
6. **People**: list → person page (tabs: Due, Paid, Events, Notes, Documents, Timeline)
7. **Bills & Payments**: list by status; bill detail with payment ledger; "Mark paid" with amount/date/receipt
8. **Expenses**: list, add, monthly chart by category, budget bars
9. **Events**: upcoming/past; mark done/missed; add notes after the event
10. **Loans**: given/taken, outstanding balance per person
11. **Documents**: expiry list sorted by nearest expiry
12. **Custom Types**: create/edit type, add records, list per type
13. **Diary**: day view, write note, mood
14. **Reports**: month picker, totals, paid vs unpaid, export PDF/CSV
15. **Backup & Restore**: see §9
16. **Settings**: language, theme, text size, PIN/biometric, reminders defaults, account, data export/delete
17. **Auth**: login, sign-up, forgot password, Google sign-in

**Accessibility for "every age"**
- Text size slider (up to 200%), high-contrast theme
- Minimum 48×48 dp tap targets
- Icons always paired with words
- Simple wording; confirmations for destructive actions; undo snackbar
- Urdu (RTL) fully mirrored; date format selectable

---

## 6. Authentication (Firebase)

1. Create Firebase project **quickbrain-app**.
2. Enable Authentication providers: **Email/Password** and **Google**.
3. Web: Firebase JS SDK v10 (modular). Android: Capacitor Firebase Authentication plugin (needed for native Google sign-in; add SHA-1 and SHA-256 fingerprints in Firebase console).
4. Flow: first launch → sign up/login → local DB is created and bound to `uid`. Logout clears local DB after confirming backup.
5. Password reset by email. Email verification recommended.
6. **Account deletion** in Settings (required by Google Play): deletes Firestore data, Storage files, then the auth user.

---

## 7. Reminders & Notifications

- Each item with `reminders[]` schedules local notifications on the device (works offline).
- Default reminder set: **3 days before, 1 day before, same day (morning 8:00)**; user can change per item.
- Overdue bills: daily nudge until marked paid or snoozed.
- Android 13+: request `POST_NOTIFICATIONS`; Android 12+: exact alarms permission (`SCHEDULE_EXACT_ALARM`) only if needed; fallback to inexact.
- Re-schedule all after reboot (Capacitor handles via boot receiver) and after restore.
- Web/PWA: Firebase Cloud Messaging for web push (best effort); full reliability is on Android.
- Notification actions: **Mark paid**, **Snooze 1 day**, **Open**.

---

## 8. Global Search

Goal: type anything and find it across all modules instantly.

- Index fields: `title, notes, person name, category, tags, amount, receiptNo, customFields values, diary text`.
- Implementation: **MiniSearch** (or FlexSearch) in-memory index built from IndexedDB at startup and updated incrementally.
- Features: prefix + fuzzy match, Urdu/English, filter chips (type, person, date range, status), results grouped by type and sorted by date.
- Natural queries (phase 2): "Ali fee", "doctor", "unpaid", "last month", "15 oct".
- Recent searches saved locally.

---

## 9. Backup & Restore (date-wise)

### 9.1 Live sync
Continuous Firestore sync (when online) keeps cloud copy current.

### 9.2 Date-wise snapshots
- **Auto backup**: daily/weekly (user choice), when on Wi-Fi + charging optional.
- **Manual backup**: "Back up now".
- Each snapshot = a JSON file (`quickbrain-YYYY-MM-DD-HHmm.json`, compressed) of all collections + a manifest; attachments referenced by Storage path.
- Stored in **Firebase Storage** at `backups/{uid}/{timestamp}.json.gz`; metadata in `backups_meta`.
- Retention: keep last 30 daily + 12 monthly (configurable); older pruned.

### 9.3 Restore
- Screen lists snapshots by **date** with counts ("152 items, 4 people").
- Options: **Restore everything** (replace) or **Merge** (add missing by id; newer `updatedAt` wins).
- Confirmation + automatic pre-restore safety snapshot.
- Re-schedules reminders after restore.

### 9.4 Local export
- Export everything as JSON or CSV file to device (works without cloud); import JSON back.
- Optional: Google Drive export via share sheet.

---

## 10. Security & Privacy

- **Firestore Security Rules**:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```
- **Storage rules**: only `users/{uid}/**` and `backups/{uid}/**` for the matching uid; file size cap (e.g., 10 MB), image/pdf types only.
- App PIN stored as salted hash; biometric via Capacitor Biometric plugin; auto-lock after N minutes.
- HTTPS only; no secrets in the client other than Firebase public config (this is normal; protect with Rules and App Check).
- Enable **Firebase App Check** (Play Integrity on Android, reCAPTCHA on web).
- Optional client-side encryption of backups (passphrase) in v1.2.
- **Privacy Policy** page required (hosted on the website); describes data collected (email, user-entered records, photos), purpose, storage in Firebase, deletion process.

---

## 11. Project Structure

```
quickbrain/
├─ package.json  vite.config.ts  tsconfig.json  capacitor.config.ts
├─ public/  (manifest.webmanifest, icons, offline.html)
├─ src/
│  ├─ main.tsx  App.tsx  router.tsx
│  ├─ firebase/       (init.ts, auth.ts, firestore.ts, storage.ts)
│  ├─ db/             (dexie.ts, schema.ts, migrations.ts)
│  ├─ sync/           (queue.ts, pull.ts, push.ts, conflict.ts)
│  ├─ domain/         (bills.ts, payments.ts, events.ts, recurrence.ts, status.ts)
│  ├─ search/         (index.ts, queryParser.ts)
│  ├─ notifications/  (scheduler.ts, actions.ts)
│  ├─ backup/         (snapshot.ts, restore.ts, retention.ts, exportImport.ts)
│  ├─ reports/        (monthly.ts, pdf.ts, csv.ts)
│  ├─ i18n/           (en.json, ur.json, index.ts)
│  ├─ components/     (Card, Sheet, DatePicker, MoneyInput, PersonChip, Timeline…)
│  ├─ features/       (home, calendar, history, people, bills, expenses, events,
│  │                   loans, documents, custom, diary, reports, backup, settings, auth)
│  └─ styles/
├─ android/           (generated by Capacitor)
├─ firestore.rules  storage.rules  firebase.json
└─ tests/             (unit/, e2e/)
```

---

## 12. Step-by-Step Build Plan

### Phase 0: Setup (Day 1–2)
1. Install Node 20+, Git, Android Studio (for later), Firebase CLI.
2. `npm create vite@latest quickbrain -- --template react-ts`; add Tailwind, Dexie, react-router, MiniSearch, i18next, date-fns.
3. Create Firebase project; register Web app; copy config to `.env.local`.
4. Enable Auth providers, Firestore (production mode), Storage; deploy rules.

### Phase 1: Core offline app (Week 1–2)
5. Dexie schema + base repository functions.
6. People, Items (bill/event/expense), Payments, Categories CRUD.
7. Status engine (bill/event), recurrence generator.
8. Home dashboard, History timeline, Calendar.
9. Diary.
10. i18n English/Urdu + RTL + font scale + themes.

### Phase 2: Auth + Cloud (Week 3)
11. Firebase Auth screens and guards.
12. Sync engine (push/pull, tombstones, conflict rule).
13. Global search index + UI.
14. Backup/restore (snapshots, retention, restore UI).

### Phase 3: Reminders + extras (Week 4)
15. Local notification scheduler (web via FCM best-effort).
16. Custom record types builder.
17. Loans, Documents + expiry, Budgets.
18. Photo attach (camera/gallery), Storage upload.
19. Reports + PDF/CSV export.
20. PIN/biometric lock.

### Phase 4: PWA & mobile testing (Week 5)
21. PWA manifest + service worker (Workbox) for offline.
22. Deploy to Firebase Hosting; **open the HTTPS URL on your phone and "Add to Home screen"**; test.
23. Fix mobile UX issues; performance pass.

### Phase 5: Android app (Week 6)
24. `npm i @capacitor/core @capacitor/cli @capacitor/android`; `npx cap init`; `npx cap add android`.
25. Add plugins: Local Notifications, Camera, Filesystem, Share, Biometric, Firebase Authentication, Splash Screen, App.
26. `npm run build && npx cap sync android`; open in Android Studio; run on a **real phone via USB debugging**.
27. Home-screen widget (native Kotlin `AppWidgetProvider` reading a small JSON of today's items).
28. Release build (see §14).

### Phase 6: QA & launch (Week 7)
29. Test checklist (§13), closed testing on Play Console, fix, then production.

---

## 13. Testing Plan

**Test directly on mobile first**
1. `npm run dev -- --host` and open `http://<laptop-IP>:5173` on the phone (same Wi-Fi), or deploy a preview channel: `firebase hosting:channel:deploy test`.
2. Android real-device debug via USB: `npx cap run android`.
3. Chrome remote debugging (`chrome://inspect`) for the phone WebView.

**Checklist**
| Area | Test |
|---|---|
| Bills | Create fee due 15 Oct → shows countdown; pass date → Overdue; add partial payment → Partial; full → Paid |
| Per child | Two children same fee; pay one; the other stays Pending |
| Events | Monday 8 am doctor → reminder fires; after time → asks Done/Missed → appears in History |
| Recurring | Monthly fee generates next month after payment |
| Offline | Airplane mode: add, edit, search; reconnect → syncs |
| Auth | Sign-up, login, logout, reset password, Google sign-in, delete account |
| Backup | Create snapshot, wipe local data, restore, counts match |
| Search | Finds by title, person, note, receipt number, Urdu text |
| Reminders | Fire after reboot; fire after restore; snooze/mark-paid actions |
| Languages | Urdu RTL layout correct; dates and numbers readable |
| Accessibility | Font 200%, TalkBack basic navigation, contrast |
| Devices | Small phone (5"), large phone, tablet; Android 8–15 |
| Security | Another user cannot read your data (rules test with emulator) |
| Performance | 5,000 items: list scroll smooth, search < 200 ms |

Automated: Vitest for status/recurrence/search/backup; Playwright for key flows; Firebase Emulator Suite for rules.

---

## 14. Google Play Release Guide

You already have a developer account.

1. **App ID**: e.g., `com.codecortex.quickbrain` (cannot change later).
2. **Signing**: use **Play App Signing**. Create an upload keystore:
   `keytool -genkey -v -keystore upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000` and **back it up safely**.
3. In Firebase console add the **SHA-1/SHA-256** of debug, upload and Play signing keys (for Google sign-in).
4. Build **Android App Bundle (.aab)**: Android Studio → Build → Generate Signed Bundle, or `./gradlew bundleRelease`.
5. Target the **latest required API level** (check the Play Console requirement at release time); set `minSdk` 24.
6. Play Console → Create app → fill:
   - Store listing: name, short + full description (English/Urdu), icon 512×512, feature graphic 1024×500, phone screenshots (min 2; recommended 6–8)
   - **Privacy policy URL**
   - **Data safety form**: email, user content (records, photos), collected & stored via Firebase, encrypted in transit, deletion available
   - **App content**: target audience (all ages ⇒ see Families policy; or declare 18+ for simplicity; decide before submitting), ads = none, permissions declaration
   - **Account deletion**: provide in-app + a web URL for deletion request
7. **Testing tracks**: Internal testing → Closed testing. Note: new *personal* developer accounts must run a **closed test with at least 12 testers for 14 days** before production access; check current Play rules. Organization accounts are exempt.
8. Release to production; monitor Crashlytics/Play Vitals.

**Permissions to declare (minimal)**: INTERNET, POST_NOTIFICATIONS, CAMERA (photos), USE_BIOMETRIC, RECEIVE_BOOT_COMPLETED; avoid broad storage permissions (use system photo picker).

---

## 15. Milestones & MVP Definition

**MVP (v1.0, ship first):** Auth, People, Bills + Payments, Events, Expenses, Reminders, Recurring, Dashboard, History, Global Search, Notes, Diary, Custom Records, Backup/Restore, English/Urdu.

**v1.1:** Photos/attachments, Reports + PDF/CSV, PIN/biometric, Loans, Documents expiry.

**v1.2:** Budgets, Widget, encrypted backups, voice quick-add, natural-language search.

| Week | Deliverable |
|---|---|
| 1–2 | Offline core usable on phone browser |
| 3 | Login + sync + search + backup |
| 4 | Reminders + custom types + extras |
| 5 | PWA tested on real phones |
| 6 | Android build on device |
| 7 | Play closed testing |

---

## 16. Cost Estimate (typical personal use)

- Firebase Spark (free) is enough for testing; Blaze (pay-as-you-go) is needed for Cloud Functions and larger Storage. For one family, cost is near zero.
- Play Console: one-time fee already paid.
- Domain/hosting: Firebase Hosting free tier.

---

## 17. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Reminders killed by phone battery savers | In-app guide to disable battery optimization; also show Overdue on Dashboard |
| Data loss | Daily auto-backup, local export, pre-restore snapshot |
| Sync conflicts | Per-record last-write-wins + soft deletes |
| Play policy rejection | Privacy policy, account deletion, honest Data safety form, minimal permissions |
| App too complex for older users | "Simple mode" with large buttons and only Bills/Events/Notes; progressive disclosure |
| Lost upload key | Play App Signing + keystore backed up in two places |

---

## 18. Next Actions

1. Confirm: app name (QuickBrain or other), package ID, English + Urdu.
2. Create the Firebase project and share the **web config** (public keys only; never share service-account files).
3. Decide: scaffold the project in this repository under `quickbrain/`, or a new separate repository (recommended: separate repo, since this repo is a company website).
4. Begin Phase 0–1 and ship the first phone-testable build.
