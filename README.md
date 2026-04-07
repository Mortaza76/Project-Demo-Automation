# Demo Workflow

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

