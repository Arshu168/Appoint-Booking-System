import { COOKIE_NAME } from "@shared/const";
import { isValidISODate, TIME_SLOTS } from "@shared/appointments";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { cancelAppointment, createAppointment, getBookedSlots, listAppointments } from "./db";
import { dispatchAppointmentNotifications } from "./notifications";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

const phonePattern = /\d{7,}/;

function getLocalToday() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const dateSchema = z.string().refine(isValidISODate, "Choose a real calendar date.");

const appointmentInput = z
  .object({
    fullName: z.string().trim().min(2, "Please enter your full name.").max(160, "Keep your name under 160 characters."),
    email: z.string().trim().email("Enter a valid email address.").max(320, "Keep your email under 320 characters."),
    phone: z
      .string()
      .trim()
      .max(32, "Keep your phone number under 32 characters.")
      .refine(value => value.length === 0 || phonePattern.test(value), "Enter a valid phone number.")
      .optional()
      .or(z.literal("")),
    note: z.string().trim().max(500, "Keep your note under 500 characters.").optional().or(z.literal("")),
    appointmentDate: dateSchema,
    appointmentTime: z.enum(TIME_SLOTS),
  })
  .superRefine((value, ctx) => {
    const today = getLocalToday();
    if (value.appointmentDate < today) {
      ctx.addIssue({ code: "custom", path: ["appointmentDate"], message: "Choose today or a future date." });
    }
    if (value.appointmentDate === today) {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const [hour, minute] = value.appointmentTime.split(":").map(Number);
      if (hour * 60 + minute <= currentMinutes) {
        ctx.addIssue({ code: "custom", path: ["appointmentTime"], message: "Choose a later time today." });
      }
    }
  });

const dateQuery = z.object({ appointmentDate: dateSchema });
const cancelInput = z.object({ id: z.number().int().positive() });

function isDuplicateSlot(error: unknown) {
  const candidate = error as { code?: string; errno?: number; message?: string };
  return candidate?.code === "ER_DUP_ENTRY" || candidate?.errno === 1062 || candidate?.message?.includes("appointments_active_slot_unique");
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  appointments: router({
    list: protectedProcedure.query(async ({ ctx }) => listAppointments(ctx.user.openId)),
    bookedSlots: protectedProcedure.input(dateQuery).query(async ({ input }) => getBookedSlots(input.appointmentDate)),
    book: protectedProcedure.input(appointmentInput).mutation(async ({ ctx, input }) => {
      try {
        const appointment = await createAppointment({ ...input, ownerOpenId: ctx.user.openId });
        const notifications = await dispatchAppointmentNotifications("booked", appointment);
        return { appointment, notifications };
      } catch (error) {
        if (isDuplicateSlot(error)) {
          throw new TRPCError({ code: "CONFLICT", message: "That time was just taken. Choose another slot." });
        }
        console.error("[Appointments] Failed to create appointment:", error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "We could not save that appointment. Please try again." });
      }
    }),
    cancel: protectedProcedure.input(cancelInput).mutation(async ({ ctx, input }) => {
      const appointment = await cancelAppointment(input.id, ctx.user.openId);
      if (!appointment) throw new TRPCError({ code: "NOT_FOUND", message: "That appointment could not be found for your account." });
      const notifications = await dispatchAppointmentNotifications("cancelled", appointment);
      return { appointment, notifications };
    }),
  }),
});

export type AppRouter = typeof appRouter;
