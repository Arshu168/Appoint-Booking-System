# Appointly outcome todo

## Booking form and input validation

- [x] Users can enter their details in an appointment form, including full name and email, with optional phone number and note fields.
- [x] The form validates required fields before submission, validates email format, validates optional phone format when present, and shows helpful field-level error messages without losing entered values.
- [x] The server repeats the same business validation so invalid requests cannot create records by bypassing the browser.
- [x] Server validation rejects impossible calendar dates (for example, February 31) as well as dates in the past.

## Login and authenticated access

- [x] A login/authentication page appears before the booking experience and uses the starter’s real Manus OAuth flow.
- [x] Appointment list, booking, availability, and cancellation procedures require authentication and scope records to the signed-in user.

## Date, time and duplicate prevention

- [x] Users can select a date that is not in the past and select a time from clearly presented available slots.
- [x] Availability reflects existing active bookings for the selected date.
- [x] The application prevents duplicate bookings for the same date and time, including concurrent requests, and shows a friendly slot-conflict message when a slot is no longer available.

## Booking confirmation and persistence

- [x] A valid booking is saved as a persistent appointment record and the UI shows a confirmation with the finalized name, date, time, and contact details.
- [x] Appointments remain available across page refreshes and server restarts through the managed database.

## Existing appointments and cancellation

- [x] Users can view existing appointments in chronological order with their date, time, attendee details, status, and notes when present.
- [x] Users can cancel an existing appointment only after an explicit confirmation step.
- [x] Cancellation updates the appointment status, removes it from active availability, refreshes the list, and makes the slot available for a future booking.
- [x] Public appointment viewing and cancellation are scoped to an unguessable browser-held booking key so one visitor cannot enumerate or cancel another visitor’s appointment.

## Responsive editorial interface

- [x] The interface follows the approved Calm Editorial direction: warm paper-like neutrals, evergreen signature color, generous whitespace, Newsreader display typography, crisp controls, and a split editorial desktop layout that stacks cleanly on mobile.
- [x] The single-page route is declared in `public/manus-routes.json` and the app provides a working preview on the configured port.

## Notifications

- [x] Booking and cancellation mutations invoke the Gmail SMTP and Meta WhatsApp delivery adapters and return delivery status to the UI instead of silently ignoring notification failures.
- [ ] Complete Gmail SMTP authorization/app-password setup and correct the Meta phone-number ID/access token so real booking and cancellation messages reach both the booker’s contact details and the site owner’s configured Gmail/WhatsApp contacts.
