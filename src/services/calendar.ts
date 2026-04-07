import { google } from 'googleapis';
import { DateTime } from 'luxon';
import { config } from '../config';
import { logger } from '../utils/logger';

type CreateEventInput = {
  summary: string;
  description: string;
  attendeeEmails: string[];
  startIso: string;
  endIso: string;
  timezone: string;
  idempotencyKey: string;
};

type AvailabilityInput = {
  startIso: string;
  endIso: string;
  timezone: string;
};

type BusySlotsForDayInput = {
  dayIsoDate: string;
  timezone: string;
};

const hasGoogleCreds = Boolean(
  config.googleClientId && config.googleClientSecret && config.googleRefreshToken && config.googleCalendarId,
);

export const createCalendarEvent = async (input: CreateEventInput) => {
  if (!hasGoogleCreds) {
    logger.warn('Google credentials not configured. Simulating event creation.');
    return {
      id: `simulated-event-${input.idempotencyKey}`,
      meetLink: `https://meet.google.com/sim-${input.idempotencyKey.slice(0, 8)}`,
    };
  }

  const oauth2Client = new google.auth.OAuth2(config.googleClientId, config.googleClientSecret);
  oauth2Client.setCredentials({ refresh_token: config.googleRefreshToken });

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  const event = await calendar.events.insert({
    calendarId: config.googleCalendarId,
    conferenceDataVersion: 1,
    requestBody: {
      summary: input.summary,
      description: input.description,
      start: { dateTime: input.startIso, timeZone: input.timezone },
      end: { dateTime: input.endIso, timeZone: input.timezone },
      attendees: input.attendeeEmails.map((email) => ({ email })),
      guestsCanInviteOthers: true,
      guestsCanSeeOtherGuests: true,
      conferenceData: {
        createRequest: {
          requestId: input.idempotencyKey,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
      visibility: 'private',
    },
  });

  const meetLink = event.data.hangoutLink || '';
  return { id: event.data.id ?? '', meetLink };
};

export const isCalendarSlotAvailable = async (input: AvailabilityInput) => {
  if (!hasGoogleCreds) {
    logger.warn('Google credentials not configured. Simulating slot availability as true.');
    return true;
  }

  const oauth2Client = new google.auth.OAuth2(config.googleClientId, config.googleClientSecret);
  oauth2Client.setCredentials({ refresh_token: config.googleRefreshToken });
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  let freeBusy;
  try {
    freeBusy = await calendar.freebusy.query({
      requestBody: {
        timeMin: input.startIso,
        timeMax: input.endIso,
        timeZone: input.timezone,
        items: [{ id: config.googleCalendarId }],
      },
    });
  } catch (error: any) {
    logger.error(
      {
        message: error?.message,
        responseData: error?.response?.data,
      },
      'Google freebusy availability check failed',
    );
    throw error;
  }

  const calendarData = freeBusy.data.calendars?.[config.googleCalendarId ?? ''];
  const busySlots = calendarData?.busy ?? [];
  return busySlots.length === 0;
};

export const getBusySlotsForDay = async (input: BusySlotsForDayInput) => {
  if (!hasGoogleCreds) {
    logger.warn('Google credentials not configured. Unable to fetch real busy slots.');
    return [] as Array<{ start: string; end: string }>;
  }

  const oauth2Client = new google.auth.OAuth2(config.googleClientId, config.googleClientSecret);
  oauth2Client.setCredentials({ refresh_token: config.googleRefreshToken });
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  const dayStart = DateTime.fromISO(input.dayIsoDate, { zone: input.timezone }).startOf('day');
  const dayEnd = DateTime.fromISO(input.dayIsoDate, { zone: input.timezone }).endOf('day');
  if (!dayStart.isValid || !dayEnd.isValid) {
    logger.warn({ dayIsoDate: input.dayIsoDate, timezone: input.timezone }, 'Invalid day for busy-slot lookup');
    return [] as Array<{ start: string; end: string }>;
  }

  const dayStartIso = dayStart.toISO();
  const dayEndIso = dayEnd.toISO();
  if (!dayStartIso || !dayEndIso) {
    logger.warn({ dayIsoDate: input.dayIsoDate, timezone: input.timezone }, 'Unable to serialize busy-slot bounds');
    return [] as Array<{ start: string; end: string }>;
  }

  let freeBusy;
  try {
    freeBusy = await calendar.freebusy.query({
      requestBody: {
        timeMin: dayStartIso,
        timeMax: dayEndIso,
        timeZone: input.timezone,
        items: [{ id: config.googleCalendarId }],
      },
    });
  } catch (error: any) {
    logger.error(
      {
        message: error?.message,
        responseData: error?.response?.data,
        dayStartIso,
        dayEndIso,
        timezone: input.timezone,
      },
      'Google busy-slot lookup failed',
    );
    throw error;
  }

  const calendarData = freeBusy.data.calendars?.[config.googleCalendarId ?? ''];
  const busySlots = calendarData?.busy ?? [];
  return busySlots
    .filter((slot) => slot.start && slot.end)
    .map((slot) => ({ start: slot.start as string, end: slot.end as string }));
};
