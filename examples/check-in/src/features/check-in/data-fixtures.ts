export const demoOrganizer = { id: "organizer-ada", name: "Ada Organizer" } as const;

export const organizers = [demoOrganizer, { id: "organizer-ben", name: "Ben Organizer" }] as const;

export const events = [
  { id: "event-summit", name: "Workers Summit", organizerId: demoOrganizer.id },
  { id: "event-private", name: "Private Workshop", organizerId: "organizer-ben" },
] as const;

export const tickets = [
  {
    attendeeName: "Ada Lovelace",
    code: "SUMMIT-ADA",
    eventId: "event-summit",
    id: "ticket-ada",
  },
  {
    attendeeName: "Grace Hopper",
    code: "SUMMIT-GRACE",
    eventId: "event-summit",
    id: "ticket-grace",
  },
  {
    attendeeName: "Ben Bitdiddle",
    code: "PRIVATE-BEN",
    eventId: "event-private",
    id: "ticket-ben",
  },
] as const;

export type Event = (typeof events)[number];
export type Ticket = (typeof tickets)[number];
