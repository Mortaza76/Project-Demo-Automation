# BellMedEx Demo Workflow

A VS Code runnable backend prototype for BellMedEx that automates demo scheduling from lead intake to meeting confirmation.

This project is designed to be reliable and demo-ready:

- deterministic workflow state machine
- persistent SQLite storage
- retryable background jobs
- SMTP email integration (or simulation fallback)
- Google Calendar + Meet integration (or simulation fallback)
- conflict handling with reschedule flow
- live dashboard for status tracking

## What I built (easy explanation)

- I used a state machine so each lead has clear progress status.
- I used a background worker + retry queue for email/calendar reliability.
- I added idempotency to avoid duplicate calendar events.
- I saved audit logs of every status transition for transparency.
- If credentials are missing, system runs in simulation mode for demo safety.
- I added Google Calendar conflict handling with reschedule email guidance.

## Workflow statuses

- `NEW` - lead record created
- `EMAIL_SENT` - availability request sent
- `SLOT_RECEIVED` - client selected date/time
- `RESCHEDULE_REQUESTED` - selected slot conflicts; reschedule email sent
- `EVENT_CREATED` - Google Calendar event + Meet link created
- `CONFIRMED` - confirmation email sent
- `FAILED` - background job exhausted retries

Typical successful path:

`NEW -> EMAIL_SENT -> SLOT_RECEIVED -> EVENT_CREATED -> CONFIRMED`

Conflict path:

`NEW -> EMAIL_SENT -> SLOT_RECEIVED -> RESCHEDULE_REQUESTED`

## Project structure

```text
Forms-checker/
  public/
    index.html
    dashboard.html
  src/
    config.ts
    server.ts
    types.ts
    db/
      index.ts
    routes/
      intake.ts
      respond.ts
      admin.ts
    services/
      workflow.ts
      worker.ts
      mailer.ts
      calendar.ts
    templates/
      email.ts
    utils/
      logger.ts
      validation.ts
  .env.example
  README.md
```

## Quick start

```bash
npm install
cp .env.example .env
npm run dev
```

## Environment configuration

Configure `.env` using `.env.example`:

- App: `PORT`, `APP_BASE_URL`
- Validation/timezone: `DEFAULT_TIMEZONE`, `BUSINESS_START_HOUR`, `BUSINESS_END_HOUR`
- SMTP: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `FROM_EMAIL`, `INTERNAL_EMAIL`
- Google: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `GOOGLE_CALENDAR_ID`

If SMTP or Google env vars are empty, the corresponding integration runs in simulation mode.

## URLs

- Intake form: [http://localhost:3000](http://localhost:3000)
- Dashboard: [http://localhost:3000/dashboard.html](http://localhost:3000/dashboard.html)
- Health: [http://localhost:3000/health](http://localhost:3000/health)
- Leads list: [http://localhost:3000/api/leads](http://localhost:3000/api/leads)
- Lead details: `http://localhost:3000/api/leads/:id`
- Client response page: `http://localhost:3000/respond/:token`

## API endpoints

- `POST /api/intake` -> creates lead and queues availability email
- `GET /respond/:token` -> renders slot selection form
- `POST /respond/:token` -> saves slot and queues meeting workflow
- `GET /api/leads` -> returns all leads
- `GET /api/leads/:id` -> returns lead + full transition history

## Calendar and Meet behavior

When Google credentials are configured:

1. Selected slot is checked via `freebusy.query`.
2. If available:
   - creates event titled `Project Demo of <selected products>`
   - includes client + internal email as attendees
   - generates Google Meet link
   - enables guest invite permissions
3. If unavailable:
   - sends formal reschedule email
   - includes busy windows for the selected date
   - busy windows are filtered to business hours and exclude all-day blocks

## Dashboard behavior

`public/dashboard.html`:

- auto-refreshes every 4 seconds
- shows current lead status and last update time
- provides details panel with transitions and links
- reflects conflict/reschedule states live

## Security before public push

- Never commit `.env` to GitHub.
- Keep secrets only in local environment or a secret manager.
- Rotate credentials if they were ever exposed.
- Use `.env.example` with placeholders only.

Recommended check before push:

```bash
git status
git diff -- .env
```

Make sure `.env` is ignored and not staged.

## Test cases (review checklist)

Use this section to track what is already covered and what to add next.

### A) Setup and health

- [ ] App starts successfully with `npm run dev` or `npm start`.
- [ ] `GET /health` returns `{"ok": true}`.
- [ ] Intake form loads at `/`.
- [ ] Dashboard loads at `/dashboard.html`.

### B) Intake validation

- [ ] Valid intake payload creates lead and returns `201`.
- [ ] Missing `fullName` returns `400`.
- [ ] Invalid `email` returns `400`.
- [ ] Empty `products` array returns `400`.
- [ ] Lead appears in `GET /api/leads` after successful intake.

### C) Status progression (happy path)

- [ ] On intake, lead status becomes `NEW`.
- [ ] Availability job sends email and status becomes `EMAIL_SENT`.
- [ ] Client selects valid slot and status becomes `SLOT_RECEIVED`.
- [ ] Calendar event is created and status becomes `EVENT_CREATED`.
- [ ] Confirmation email is sent and status becomes `CONFIRMED`.

### D) Slot validation rules

- [ ] Past date/time is rejected.
- [ ] Time outside business hours is rejected.
- [ ] Non-30-minute slot (for example `10:15`) is rejected.
- [ ] Invalid date format is rejected.
- [ ] Invalid timezone string is rejected or safely handled.

### E) Conflict/reschedule behavior

- [ ] If selected slot is busy on Google Calendar, event is not created.
- [ ] Status becomes `RESCHEDULE_REQUESTED`.
- [ ] Reschedule email is sent to client.
- [ ] Email includes secure response link `/respond/:token`.
- [ ] Email includes busy windows for the selected day.
- [ ] Busy windows shown are limited to business-hour overlap.
- [ ] All-day blocks are excluded from displayed busy windows.

### F) Calendar/Meet integration

- [ ] Event title format is `Project Demo of <selected products>`.
- [ ] Attendees include client email + internal email.
- [ ] `guestsCanInviteOthers` is enabled.
- [ ] Google Meet link is generated and stored.
- [ ] `google_event_id` and `google_meet_link` are persisted.

### G) Idempotency and retries

- [ ] Retried event creation does not create duplicate meetings.
- [ ] Transient failure is retried with exponential backoff.
- [ ] After max retry attempts, status becomes `FAILED`.
- [ ] `FAILED` transition includes error payload for debugging.

### H) Dashboard behavior

- [ ] Dashboard auto-refreshes and shows latest statuses.
- [ ] Last update timestamp changes as transitions happen.
- [ ] Lead details panel shows selected lead data correctly.
- [ ] Transition timeline reflects all status changes in order.
- [ ] Response link on dashboard opens correct token page.

### I) Simulation mode behavior

- [ ] With SMTP creds missing, system simulates email send without crashing.
- [ ] With Google creds missing, system simulates event creation.
- [ ] Status flow still works in simulation mode for demo safety.

### J) Security and release checks

- [ ] `.env` is ignored and not committed.
- [ ] `.env.example` contains placeholders only.
- [ ] No secrets appear in README or source files.
- [ ] Database files (`demo.sqlite*`) are ignored.
- [ ] Rotate credentials if they were shared during testing.

### K) Suggested future test additions

- [ ] Unit tests for `normalizeSlot` and timezone edge cases.
- [ ] Unit tests for business-hour clipping of busy slots.
- [ ] Integration tests for workflow transitions from intake to confirm.
- [ ] Mocked Google API tests for free/busy and event insert failures.
- [ ] End-to-end UI test for form + response link + dashboard updates.
