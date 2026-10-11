# Appointly — Appointment Booking

## Product scope

Build a focused appointment-booking web application where a visitor can enter contact details, choose an available date and time, submit a validated booking, see a confirmation, review existing appointments, and cancel an appointment after confirmation. Persistent appointment records live in the managed MySQL database and the server enforces slot uniqueness so two bookings cannot occupy the same date/time.

## Implementation approach

- Use the initialized React + Express + tRPC + Drizzle starter.
- Add an `appointments` table with an explicit unique constraint on `appointmentDate` + `appointmentTime`, status, and timestamps.
- Expose public tRPC procedures for listing appointments, creating an appointment, and cancelling one. Create validation is duplicated at the server boundary with Zod and surfaced as field-level client errors.
- Treat the database constraint as the final duplicate-booking guard; map duplicate-key errors to a friendly slot conflict message.
- Scope appointment viewing and cancellation to the authenticated Manus user so one account cannot enumerate another account's personal details or cancel their booking.
- Keep booking and appointment management on one responsive page with clear anchor navigation rather than adding unnecessary routes.
- Use the managed database for durable state; the current product direction requires Manus OAuth before the booking flow.
- The current product direction now requires Manus OAuth at the start of the experience; appointment procedures are protected and records are scoped to the authenticated user's `openId`.
- Email and WhatsApp confirmations are intended for both the booker and the site owner, but external delivery remains gated on Gmail authorization and Meta WhatsApp Cloud API credentials.

## Project structure

- `client/src/pages/Home.tsx`: page composition, booking form, availability presentation, appointments list, confirmation and cancellation dialog.
- `client/src/index.css`: visual system, responsive layout, editorial surfaces, form states and motion.
- `server/routers.ts`: appointment tRPC procedures and server validation.
- `server/db.ts`: appointment queries and database error handling helpers.
- `drizzle/schema.ts`: appointment table and indexes.
- `drizzle/`: generated migration for the appointment table.
- `public/manus-routes.json`: page-route manifest for the single-page `/` experience.
- `TODO.md`: source acceptance criteria and outcome tracking.

## Design direction

### Design Movement

Calm editorial scheduling: a modern magazine-like interface translated into a practical utility, with warm paper neutrals, generous whitespace, and precise dark-green typography.

### Core Principles

1. **Reassuring clarity** — the next action and the selected slot are always obvious.
2. **Warm precision** — soft surfaces and serif headlines paired with crisp form controls.
3. **Quiet confidence** — restrained color, minimal chrome, and meaningful status labels.
4. **Respectful density** — enough structure for scheduling without feeling like an admin grid.

### Color Philosophy

Use a paper-like cream background to make the experience feel personal rather than clinical. Deep evergreen is the signature brand color: grounded, legible, and ownable. Muted sage and sand accents distinguish availability and confirmation without turning the page into a traffic-light dashboard. Coral is reserved for destructive cancellation states.

### Layout Paradigm

A split editorial canvas: a left-side welcome/brand rail establishes context and trust, while the right side carries the live booking workspace. On smaller screens the rail becomes a compact header, and the form/list stack vertically. Appointment records sit below the booking workspace as a separate “your schedule” chapter rather than a generic data table.

### Signature Elements

- A small circular mark made from two offset arcs, suggesting a clock face and an open calendar page.
- Hairline section rules and eyebrow labels that create a printed-editorial rhythm.
- Pill-shaped time slots with a selected evergreen state and a subtle “open” indicator.

### Interaction Philosophy

Every interaction should reduce uncertainty: dates show available counts, time slots distinguish open and selected states, validation appears near the relevant field, and successful booking transitions to a concise confirmation card. Cancellation requires an explicit confirmation step. Focus rings are visible and keyboard navigation remains natural.

### Animation

Use short, low-amplitude transitions: form sections fade and rise 160ms on mount, selected time slots ease their background and border changes, the confirmation card uses a 220ms scale/fade, and the cancel dialog uses a restrained opacity transition. Respect `prefers-reduced-motion` by disabling transforms.

### Typography System

Use Newsreader for display headlines and section titles; use a clean system sans stack for labels, body copy, inputs, and controls. Headlines are large but compact with tight line-height. Eyebrow labels use uppercase, letter spacing, and small size. Body copy stays around 15–16px for comfortable reading.

### Brand Essence

Appointly is a calm, human scheduling desk for people who want to book a time without wrestling with a calendar system. Personality: **considered, warm, dependable**.

### Brand Voice

Headlines are direct and reassuring; CTAs are active but unhurried; microcopy explains what will happen next.

- Example headline: “Make time for what matters.”
- Example microcopy: “Choose a day, then pick a quiet 30-minute window.”

### Wordmark & Logo

The wordmark pairs a lowercase “appointly” with a small open-circle clock mark aligned to the baseline. The mark should be implemented as a simple CSS/inline SVG motif rather than a stock icon.

### Signature Brand Color

`#243B35` evergreen — used for the primary action, selected slots, logo mark, and confirmation accents.

## Behavior notes

- Required fields: full name, email, appointment date, and appointment time. Phone and note are optional but validated when present.
- Email must be valid; date must not be in the past; time must be one of the offered slots.
- The server rejects duplicate date/time combinations even under concurrent requests.
- List appointments in chronological order and show status.
- Cancellation changes the record to `cancelled` so the slot becomes available again without losing the audit trail.
- A visitor key stored in the browser scopes the public list and cancellation flow to that browser's own appointments.
- After cancellation, refresh available counts and list state.
