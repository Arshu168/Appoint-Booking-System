import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { AppointmentRecord, TIME_SLOTS, formatSlot, getLocalToday, isValidISODate } from "@shared/appointments";
import { format, parseISO } from "date-fns";
import {
  ArrowRight,
  CalendarCheck2,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Loader2,
  Mail,
  MessageSquareText,
  Phone,
  ShieldCheck,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const initialForm = {
  fullName: "",
  email: "",
  phone: "",
  note: "",
  appointmentDate: getLocalToday(),
  appointmentTime: "",
};

type FormState = typeof initialForm;
type FormErrors = Partial<Record<keyof FormState, string>>;

type BookingConfirmation = AppointmentRecord;

function formatDate(value: string | Date) {
  const date = typeof value === "string" ? parseISO(value) : value;
  return format(date, "EEE, MMM d, yyyy");
}

function getSlotMinutes(slot: string) {
  const [hour, minute] = slot.split(":").map(Number);
  return hour * 60 + minute;
}

function isPastSlot(date: string, slot: string) {
  if (date !== getLocalToday()) return false;
  const now = new Date();
  return getSlotMinutes(slot) <= now.getHours() * 60 + now.getMinutes();
}

function validateForm(form: FormState, bookedSlots: string[]) {
  const errors: FormErrors = {};
  if (form.fullName.trim().length < 2) errors.fullName = "Please enter your full name.";
  if (form.fullName.trim().length > 160) errors.fullName = "Keep your name under 160 characters.";
  if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) errors.email = "Enter a valid email address.";
  if (form.email.trim().length > 320) errors.email = "Keep your email under 320 characters.";
  if (form.phone.trim() && !/\d{7,}/.test(form.phone.trim())) errors.phone = "Enter a valid phone number.";
  if (form.phone.trim().length > 32) errors.phone = "Keep your phone number under 32 characters.";
  if (form.note.trim().length > 500) errors.note = "Keep your note under 500 characters.";
  if (!form.appointmentDate) errors.appointmentDate = "Choose a date.";
  if (form.appointmentDate && !isValidISODate(form.appointmentDate)) errors.appointmentDate = "Choose a real calendar date.";
  if (form.appointmentDate < getLocalToday()) errors.appointmentDate = "Choose today or a future date.";
  if (!form.appointmentTime) errors.appointmentTime = "Choose a time.";
  if (bookedSlots.includes(form.appointmentTime)) errors.appointmentTime = "That time is no longer available.";
  if (isPastSlot(form.appointmentDate, form.appointmentTime)) errors.appointmentTime = "Choose a later time today.";
  return errors;
}

function FieldError({ children }: { children?: string }) {
  if (!children) return null;
  return <p className="field-error" role="alert">{children}</p>;
}

function AppointmentCard({ appointment, onCancel }: { appointment: AppointmentRecord; onCancel: (appointment: AppointmentRecord) => void }) {
  const isCancelled = appointment.status === "cancelled";
  return (
    <article className={`appointment-card ${isCancelled ? "appointment-card--cancelled" : ""}`}>
      <div className="appointment-card__date">
        <span>{format(parseISO(appointment.appointmentDate), "MMM")}</span>
        <strong>{format(parseISO(appointment.appointmentDate), "dd")}</strong>
      </div>
      <div className="appointment-card__body">
        <div className="appointment-card__topline">
          <div>
            <p className="appointment-card__eyebrow">{format(parseISO(appointment.appointmentDate), "EEEE")}</p>
            <h3>{formatSlot(appointment.appointmentTime)}</h3>
          </div>
          <span className={`status-pill ${isCancelled ? "status-pill--cancelled" : "status-pill--booked"}`}>
            <span className="status-dot" />
            {isCancelled ? "Cancelled" : "Booked"}
          </span>
        </div>
        <div className="appointment-card__details">
          <span><UserRound size={14} /> {appointment.fullName}</span>
          <span><Mail size={14} /> {appointment.email}</span>
        </div>
        {appointment.note ? <p className="appointment-card__note">“{appointment.note}”</p> : null}
      </div>
      {!isCancelled ? (
        <Button type="button" variant="ghost" className="cancel-button" onClick={() => onCancel(appointment)}>
          Cancel <X size={15} />
        </Button>
      ) : null}
    </article>
  );
}

export default function Home() {
  const today = getLocalToday();
  const { loading: authLoading, user, logout } = useAuth();
  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [confirmation, setConfirmation] = useState<BookingConfirmation | null>(null);
  const [cancelTarget, setCancelTarget] = useState<AppointmentRecord | null>(null);

  const utils = trpc.useUtils();
  const appointmentsQuery = trpc.appointments.list.useQuery(undefined, { enabled: Boolean(user) });
  const bookedSlotsQuery = trpc.appointments.bookedSlots.useQuery(
    { appointmentDate: form.appointmentDate },
    { enabled: Boolean(user && form.appointmentDate) },
  );
  const bookMutation = trpc.appointments.book.useMutation({
    onSuccess: result => {
      setConfirmation(result.appointment as BookingConfirmation);
      setForm(current => ({ ...current, fullName: "", email: "", phone: "", note: "", appointmentTime: "" }));
      setErrors({});
      if (!result.notifications.email.sent || result.notifications.whatsapp.sent < result.notifications.whatsapp.attempted) {
        toast.warning("Appointment saved, but one or more notifications could not be delivered. Check the notification setup.");
      }
      void utils.appointments.list.invalidate();
      void utils.appointments.bookedSlots.invalidate();
      window.setTimeout(() => document.getElementById("confirmation")?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
    },
    onError: error => {
      if (error.data?.code === "CONFLICT") {
        setErrors(current => ({ ...current, appointmentTime: error.message }));
        void utils.appointments.bookedSlots.invalidate();
      } else {
        const errorData = error.data as { zodError?: { fieldErrors?: Record<string, string[]> } } | undefined;
        const fieldErrors = errorData?.zodError?.fieldErrors;
        if (fieldErrors && Object.keys(fieldErrors).length > 0) {
          const nextErrors: FormErrors = {};
          for (const [field, messages] of Object.entries(fieldErrors)) {
            if (field in initialForm && messages[0]) nextErrors[field as keyof FormState] = messages[0];
          }
          setErrors(current => ({ ...current, ...nextErrors }));
          const firstInvalid = Object.keys(nextErrors)[0];
          if (firstInvalid) document.getElementById(`field-${firstInvalid}`)?.focus();
        } else {
          toast.error(error.message || "We could not save that appointment.");
        }
      }
    },
  });
  const cancelMutation = trpc.appointments.cancel.useMutation({
    onSuccess: result => {
      setCancelTarget(null);
      toast.success("Appointment cancelled. The time is open again.");
      if (!result.notifications.email.sent || result.notifications.whatsapp.sent < result.notifications.whatsapp.attempted) {
        toast.warning("Cancellation saved, but one or more notifications could not be delivered.");
      }
      void utils.appointments.list.invalidate();
      void utils.appointments.bookedSlots.invalidate();
    },
    onError: error => toast.error(error.message || "We could not cancel that appointment."),
  });

  const bookedSlots = bookedSlotsQuery.data ?? [];
  const activeAppointments = useMemo(
    () => (appointmentsQuery.data ?? []).filter(appointment => appointment.status === "booked"),
    [appointmentsQuery.data],
  );
  const cancelledAppointments = useMemo(
    () => (appointmentsQuery.data ?? []).filter(appointment => appointment.status === "cancelled"),
    [appointmentsQuery.data],
  );
  const availableSlotCount = TIME_SLOTS.filter(slot => !bookedSlots.includes(slot) && !isPastSlot(form.appointmentDate, slot)).length;

  const updateField = (field: keyof FormState, value: string) => {
    setForm(current => ({ ...current, [field]: value }));
    setErrors(current => ({ ...current, [field]: undefined }));
    if (field === "appointmentDate") {
      setForm(current => ({ ...current, appointmentDate: value, appointmentTime: "" }));
      setErrors(current => ({ ...current, appointmentDate: undefined, appointmentTime: undefined }));
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validateForm(form, bookedSlots);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      const firstInvalid = Object.keys(nextErrors)[0];
      document.getElementById(`field-${firstInvalid}`)?.focus();
      return;
    }
    bookMutation.mutate({
      fullName: form.fullName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      note: form.note.trim(),
      appointmentDate: form.appointmentDate,
      appointmentTime: form.appointmentTime as (typeof TIME_SLOTS)[number],
    });
  };

  if (authLoading) {
    return <div className="auth-gate"><div className="auth-gate__card"><span className="brand-mark"><span /><span /></span><Loader2 size={18} className="spin" /><p>Preparing your private booking desk…</p></div></div>;
  }

  if (!user) {
    return <div className="auth-gate"><div className="auth-gate__card"><a className="brand auth-gate__brand" href="#"><span className="brand-mark"><span /><span /></span><span>appointly</span></a><p className="eyebrow"><ShieldCheck size={14} /> Private scheduling</p><h1>Make time for what matters.</h1><p className="auth-gate__lede">Sign in to book a focused appointment, keep your schedule private, and manage your time windows in one calm place.</p><Button type="button" size="lg" className="primary-cta auth-gate__button" onClick={() => startLogin()}><ArrowRight size={17} /> Sign in to continue</Button><span className="auth-gate__fineprint">Secure sign-in powered by Manus OAuth</span></div><div className="auth-gate__quote">“The best meetings leave a little more clarity than they found.”</div></div>;
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#booking" aria-label="Appointly home">
          <span className="brand-mark"><span /><span /></span>
          <span>appointly</span>
        </a>
        <nav className="topnav" aria-label="Primary navigation">
          <a href="#booking">Book a time</a>
          <a href="#appointments">Your appointments</a>
        </nav>
        <div className="topbar__account"><span className="live-dot" /> {user.name || user.email || "Signed in"}<button type="button" onClick={() => void logout()}>Sign out</button></div>
      </header>

      <main>
        <section className="hero-section" id="booking">
          <div className="hero-copy">
            <p className="eyebrow"><Sparkles size={14} /> A little room in the day</p>
            <h1>Make time for what matters.</h1>
            <p className="hero-lede">Choose a quiet window for a focused conversation. No back-and-forth, no crowded calendar — just a time that works.</p>
            <div className="hero-meta">
              <div><ShieldCheck size={18} /><span><strong>Simple by design</strong><small>Book in under a minute</small></span></div>
              <div><Clock3 size={18} /><span><strong>30 minutes</strong><small>Thoughtful, focused sessions</small></span></div>
            </div>
          </div>
          <div className="hero-aside" aria-label="Booking note">
            <div className="hero-aside__ring"><CalendarCheck2 size={28} /></div>
            <p>“The best meetings leave a little more clarity than they found.”</p>
            <span>— Appointly principle</span>
          </div>
        </section>

        <section className="booking-layout" aria-label="Book an appointment">
          <div className="booking-form-panel">
            <div className="section-heading">
              <div><p className="eyebrow">01 / Your details</p><h2>Tell us who’s joining.</h2></div>
              <span className="required-note">* Required</span>
            </div>
            <form onSubmit={handleSubmit} noValidate>
              <div className="form-grid form-grid--two">
                <div className="field-group">
                  <label htmlFor="field-fullName">Full name <span>*</span></label>
                  <div className="input-wrap"><UserRound size={17} /><Input id="field-fullName" maxLength={160} value={form.fullName} onChange={event => updateField("fullName", event.target.value)} placeholder="Alex Morgan" aria-invalid={Boolean(errors.fullName)} /></div>
                  <FieldError>{errors.fullName}</FieldError>
                </div>
                <div className="field-group">
                  <label htmlFor="field-email">Email address <span>*</span></label>
                  <div className="input-wrap"><Mail size={17} /><Input id="field-email" type="email" maxLength={320} value={form.email} onChange={event => updateField("email", event.target.value)} placeholder="alex@example.com" aria-invalid={Boolean(errors.email)} /></div>
                  <FieldError>{errors.email}</FieldError>
                </div>
              </div>
              <div className="form-grid form-grid--two">
                <div className="field-group">
                  <label htmlFor="field-phone">Phone <small>Optional</small></label>
                  <div className="input-wrap"><Phone size={17} /><Input id="field-phone" type="tel" maxLength={32} value={form.phone} onChange={event => updateField("phone", event.target.value)} placeholder="+1 555 012 3456" aria-invalid={Boolean(errors.phone)} /></div>
                  <FieldError>{errors.phone}</FieldError>
                </div>
                <div className="field-group">
                  <label htmlFor="field-note">What’s on your mind? <small>Optional</small></label>
                  <div className="input-wrap"><MessageSquareText size={17} /><Input id="field-note" maxLength={500} value={form.note} onChange={event => updateField("note", event.target.value)} placeholder="A little context helps" aria-invalid={Boolean(errors.note)} /></div>
                  <FieldError>{errors.note}</FieldError>
                </div>
              </div>

              <div className="section-heading section-heading--date">
                <div><p className="eyebrow">02 / Choose a window</p><h2>Find a time that feels right.</h2></div>
                <span className="availability-note"><span className="status-dot status-dot--open" /> {availableSlotCount} open today</span>
              </div>
              <div className="date-picker-row">
                <div className="field-group date-field">
                  <label htmlFor="field-appointmentDate">Date <span>*</span></label>
                  <div className="input-wrap"><CalendarDays size={17} /><Input id="field-appointmentDate" type="date" min={today} value={form.appointmentDate} onChange={event => updateField("appointmentDate", event.target.value)} aria-invalid={Boolean(errors.appointmentDate)} /></div>
                  <FieldError>{errors.appointmentDate}</FieldError>
                </div>
                <div className="selected-date-copy">
                  <span>Selected day</span>
                  <strong>{form.appointmentDate ? formatDate(form.appointmentDate) : "Choose a date"}</strong>
                </div>
              </div>
              <div className="time-picker" aria-labelledby="time-label">
                <div className="time-picker__label" id="time-label"><span>Time <em>*</em></span>{bookedSlotsQuery.isFetching ? <span className="loading-inline"><Loader2 size={13} className="spin" /> Updating availability</span> : <span>{availableSlotCount} windows open</span>}</div>
                <div className="slot-grid">
                  {TIME_SLOTS.map(slot => {
                    const isBooked = bookedSlots.includes(slot);
                    const isPast = isPastSlot(form.appointmentDate, slot);
                    const isSelected = form.appointmentTime === slot;
                    return <button key={slot} type="button" className={`slot-button ${isSelected ? "slot-button--selected" : ""} ${isBooked || isPast ? "slot-button--unavailable" : ""}`} disabled={isBooked || isPast} onClick={() => updateField("appointmentTime", slot)} aria-pressed={isSelected}>
                      {isSelected ? <Check size={15} /> : <Clock3 size={15} />}{formatSlot(slot)}{isBooked ? <span className="slot-status">Taken</span> : isPast ? <span className="slot-status">Past</span> : null}
                    </button>;
                  })}
                </div>
                <FieldError>{errors.appointmentTime}</FieldError>
              </div>
              <div className="submit-row">
                <p>By booking, you’ll receive a clear confirmation of your chosen window.</p>
                <Button type="submit" size="lg" className="primary-cta" disabled={bookMutation.isPending}>{bookMutation.isPending ? <Loader2 size={17} className="spin" /> : <ArrowRight size={17} />} {bookMutation.isPending ? "Saving your time" : "Book this time"}</Button>
              </div>
            </form>
          </div>
          <aside className="booking-aside">
            <div className="aside-card aside-card--sage">
              <p className="eyebrow">Before you book</p>
              <h3>Make it a good one.</h3>
              <ul><li>Bring one question you want to leave clearer.</li><li>Give yourself a minute to arrive.</li><li>You can cancel or change your mind anytime.</li></ul>
            </div>
            <div className="aside-card aside-card--line"><span className="aside-card__number">02</span><p>Choose a date, then an open 30-minute window.</p></div>
            <div className="aside-card aside-card--line"><span className="aside-card__number">03</span><p>We’ll hold your place and show the details below.</p></div>
          </aside>
        </section>

        {confirmation ? (
          <section className="confirmation-card" id="confirmation" aria-live="polite">
            <div className="confirmation-icon"><CheckCircle2 size={24} /></div>
            <div className="confirmation-copy"><p className="eyebrow">You’re all set</p><h2>Your time is held.</h2><p>{formatDate(confirmation.appointmentDate)} at <strong>{formatSlot(confirmation.appointmentTime)}</strong> for {confirmation.fullName}. A confirmation has been saved for {confirmation.email}.</p></div>
            <button type="button" className="confirmation-dismiss" onClick={() => setConfirmation(null)} aria-label="Dismiss confirmation"><X size={18} /></button>
          </section>
        ) : null}

        <section className="appointments-section" id="appointments">
          <div className="section-heading section-heading--appointments"><div><p className="eyebrow">Your schedule</p><h2>Existing appointments.</h2></div><div className="appointments-count">{activeAppointments.length} active</div></div>
          {appointmentsQuery.isLoading ? <div className="loading-state"><Loader2 size={20} className="spin" /> Loading your appointments…</div> : activeAppointments.length === 0 ? <div className="empty-state"><div className="empty-state__icon"><CalendarDays size={22} /></div><div><h3>No appointments yet.</h3><p>Your next good conversation can start above.</p></div><a href="#booking">Book a time <ArrowRight size={15} /></a></div> : <div className="appointments-list">{activeAppointments.map(appointment => <AppointmentCard key={appointment.id} appointment={appointment as AppointmentRecord} onCancel={setCancelTarget} />)}</div>}
          {cancelledAppointments.length > 0 ? <details className="cancelled-details"><summary>Show {cancelledAppointments.length} cancelled {cancelledAppointments.length === 1 ? "appointment" : "appointments"}</summary><div className="appointments-list appointments-list--cancelled">{cancelledAppointments.map(appointment => <AppointmentCard key={appointment.id} appointment={appointment as AppointmentRecord} onCancel={setCancelTarget} />)}</div></details> : null}
        </section>
      </main>

      <footer className="footer"><div className="brand brand--footer"><span className="brand-mark"><span /><span /></span><span>appointly</span></div><p>A calmer way to make room.</p><span>© {new Date().getFullYear()}</span></footer>

      <Dialog open={Boolean(cancelTarget)} onOpenChange={open => !open && setCancelTarget(null)}>
        <DialogContent className="cancel-dialog"><DialogHeader><p className="eyebrow">A quick check</p><DialogTitle>Cancel this appointment?</DialogTitle><DialogDescription>{cancelTarget ? `${formatDate(cancelTarget.appointmentDate)} at ${formatSlot(cancelTarget.appointmentTime)} for ${cancelTarget.fullName}.` : ""} This will open the time for someone else.</DialogDescription></DialogHeader><DialogFooter><Button type="button" variant="outline" onClick={() => setCancelTarget(null)}>Keep appointment</Button><Button type="button" variant="destructive" onClick={() => cancelTarget && cancelMutation.mutate({ id: cancelTarget.id })} disabled={cancelMutation.isPending}>{cancelMutation.isPending ? <Loader2 size={15} className="spin" /> : null} Yes, cancel</Button></DialogFooter></DialogContent>
      </Dialog>
    </div>
  );
}
