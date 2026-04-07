export const availabilityRequestTemplate = (args: {
  fullName: string;
  products: string[];
  responseLink: string;
}) => ({
  subject: 'BellMedEx Demo Availability Request',
  text: `Dear ${args.fullName},\n\nThank you for your interest in BellMedEx (${args.products.join(', ')}).\n\nPlease confirm your preferred demo date/time using this secure link:\n${args.responseLink}\n\nMeeting duration: 30 minutes.\n\nRegards,\nBellMedEx Sales Team`,
});

export const confirmationTemplate = (args: {
  fullName: string;
  products: string[];
  isoStart: string;
  timezone: string;
  meetLink: string;
}) => ({
  subject: 'BellMedEx Demo Meeting Confirmation',
  text: `Dear ${args.fullName},\n\nYour online demo meeting is confirmed with a BellMedEx Sales Team representative.\n\nDemo Products: ${args.products.join(', ')}\nDate/Time: ${args.isoStart} (${args.timezone})\nDuration: 30 minutes\nGoogle Meet Link: ${args.meetLink}\n\nRegards,\nBellMedEx Sales Team`,
});
