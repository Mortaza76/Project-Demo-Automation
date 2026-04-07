import { DateTime } from 'luxon';
import {
  enqueueJob,
  getLeadById,
  markJobDone,
  markJobFailed,
  setLeadEvent,
  updateLeadStatus,
} from '../db';
import { config } from '../config';
import { sendEmail } from './mailer';
import { createCalendarEvent, getBusySlotsForDay, isCalendarSlotAvailable } from './calendar';
import { availabilityRequestTemplate, confirmationTemplate } from '../templates/email';

export const queueSendAvailabilityEmail = (leadId: number) => enqueueJob(leadId, 'SEND_AVAILABILITY_EMAIL');

export const queueCreateEventAndConfirm = (leadId: number) => enqueueJob(leadId, 'CREATE_EVENT_AND_CONFIRM');

export const processJob = async (job: any) => {
  try {
    if (job.type === 'SEND_AVAILABILITY_EMAIL') {
      await sendAvailabilityEmail(job.lead_id);
    } else if (job.type === 'CREATE_EVENT_AND_CONFIRM') {
      await createEventAndConfirm(job.lead_id);
    } else {
      throw new Error(`Unknown job type: ${job.type}`);
    }
    markJobDone(job.id);
  } catch (err) {
    markJobFailed(job, (err as Error).message);
    const lead = getLeadById(job.lead_id) as any;
    if (lead && job.attempts + 1 >= job.max_attempts) {
      updateLeadStatus(job.lead_id, 'FAILED', `Job ${job.type} failed permanently`, { error: (err as Error).message });
    }
    throw err;
  }
};

const sendAvailabilityEmail = async (leadId: number) => {
  const lead = getLeadById(leadId) as any;
  if (!lead) throw new Error('Lead not found');
  if (lead.status !== 'NEW') return;

  const responseLink = `${config.appBaseUrl}/respond/${lead.response_token}`;
  const products: string[] = JSON.parse(lead.products_json);
  const tpl = availabilityRequestTemplate({
    fullName: lead.full_name,
    products,
    responseLink,
  });
// making use of await and async fucntions inside the fucntions of agents to make use of these features
  await sendEmail({ to: lead.email, subject: tpl.subject, text: tpl.text });
  updateLeadStatus(leadId, 'EMAIL_SENT', 'Availability request sent');
};

const createEventAndConfirm = async (leadId: number) => {
  const lead = getLeadById(leadId) as any;
  if (!lead) throw new Error('Lead not found');
  if (!lead.requested_date || !lead.requested_time) throw new Error('No requested slot found');

  if (lead.google_event_id) {
    updateLeadStatus(leadId, 'EVENT_CREATED', 'Event already existed; idempotent continuation');
  } else {
    const products = JSON.parse(lead.products_json) as string[];
    const start = DateTime.fromISO(`${lead.requested_date}T${lead.requested_time}`, { zone: lead.timezone });
    const end = start.plus({ minutes: 30 });
    const startIso = start.toISO() ?? '';
    const endIso = end.toISO() ?? '';

    const isAvailable = await isCalendarSlotAvailable({
      startIso,
      endIso,
      timezone: lead.timezone,
    });

    if (!isAvailable) {
      const responseLink = `${config.appBaseUrl}/respond/${lead.response_token}`;
      const busySlots = await getBusySlotsForDay({
        dayIsoDate: lead.requested_date,
        timezone: lead.timezone,
      });
      const businessStart = DateTime.fromISO(`${lead.requested_date}T00:00:00`, { zone: lead.timezone }).set({
        hour: config.businessStartHour,
        minute: 0,
        second: 0,
        millisecond: 0,
      });
      const businessEnd = DateTime.fromISO(`${lead.requested_date}T00:00:00`, { zone: lead.timezone }).set({
        hour: config.businessEndHour,
        minute: 0,
        second: 0,
        millisecond: 0,
      });
      const formattedBusySlots =
        busySlots.length > 0
          ? busySlots
              .map((slot) => {
                const startLocal = DateTime.fromISO(slot.start).setZone(lead.timezone);
                const endLocal = DateTime.fromISO(slot.end).setZone(lead.timezone);

                // Exclude all-day style blocks and malformed windows.
                const durationHours = endLocal.diff(startLocal, 'hours').hours;
                if (!startLocal.isValid || !endLocal.isValid || durationHours <= 0 || durationHours >= 23.5) {
                  return null;
                }

                // Show only overlap with configured business hours.
                const clippedStart = startLocal < businessStart ? businessStart : startLocal;
                const clippedEnd = endLocal > businessEnd ? businessEnd : endLocal;
                if (clippedEnd <= clippedStart) return null;

                return `- ${clippedStart.toFormat('hh:mm a')} to ${clippedEnd.toFormat('hh:mm a')} (${lead.timezone})`;
              })
              .filter((line): line is string => Boolean(line))
              .join('\n')
          : '- Busy slot details are unavailable for this date.';
      const rescheduleMessage = `Dear ${lead.full_name},

Thank you for your interest in BellMedEx.

Mr. Ameer Mortaza is unavailable at the selected date and time due to prior commitments.
Below are the time windows that are already booked on ${lead.requested_date}:

${formattedBusySlots}

We kindly request that you choose another slot for your demo meeting by using the secure scheduling link below:

${responseLink}

Requested demo products: ${products.join(', ')}
Duration: 30 minutes

We appreciate your understanding and look forward to connecting with you.

Regards,
BellMedEx Sales Team`;

      await sendEmail({
        to: lead.email,
        subject: 'BellMedEx Demo Reschedule Request',
        text: rescheduleMessage,
      });
      updateLeadStatus(
        leadId,
        'RESCHEDULE_REQUESTED',
        'Selected slot unavailable; reschedule email sent with response link',
      );
      return;
    }

    const event = await createCalendarEvent({
      summary: `Project Demo of ${products.join(', ')}`,
      description: `Demo products: ${products.join(', ')}`,
      attendeeEmails: [lead.email, config.internalEmail],
      startIso,
      endIso,
      timezone: lead.timezone,
      idempotencyKey: lead.event_idempotency_key,
    });

    setLeadEvent(leadId, event.id, event.meetLink);
    updateLeadStatus(leadId, 'EVENT_CREATED', 'Calendar event created', event);
  }

  const freshLead = getLeadById(leadId) as any;
  const confirmation = confirmationTemplate({
    fullName: freshLead.full_name,
    products: JSON.parse(freshLead.products_json),
    isoStart: `${freshLead.requested_date} ${freshLead.requested_time}`,
    timezone: freshLead.timezone,
    meetLink: freshLead.google_meet_link,
  });

  await sendEmail({
    to: `${freshLead.email}, ${config.internalEmail}`,
    subject: confirmation.subject,
    text: confirmation.text,
  });

  updateLeadStatus(leadId, 'CONFIRMED', 'Confirmation email sent');
};
