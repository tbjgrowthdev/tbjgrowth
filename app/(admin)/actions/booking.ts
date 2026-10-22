"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { sendBookingNotification } from "@/lib/email";
import { requirePermission, requireSession, AuthError } from "@/lib/auth-guard";

// ------------------------------------------------------
// Public
// ------------------------------------------------------

export async function getAvailableSlots() {
  try {
    return await prisma.availableSlot.findMany({
      where: {
        isBooked: false,
        startsAt: { gte: new Date() },
      },
      orderBy: { startsAt: "asc" },
    });
  } catch (error) {
    console.error("Failed to fetch available slots:", error);
    return [];
  }
}

const createBookingSchema = z.object({
  slotId: z.string().trim().min(1),
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().toLowerCase().email().max(320),
  phone: z.string().trim().max(50).optional(),
  company: z.string().trim().max(200).optional(),
  message: z.string().trim().max(5000).optional(),
});

// Same rolling-window throttle as submitContactForm (lib/forms.ts) — see
// that file's comment for why this is email-based and not a substitute for
// edge-level rate limiting.
const BOOKING_WINDOW_MS = 60 * 60 * 1000;
const BOOKING_MAX_PER_WINDOW = 3;

export async function createBooking(data: unknown) {
  try {
    const parsed = createBookingSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: "Please check the form for errors and try again." };
    }
    const input = parsed.data;

    const recentCount = await prisma.booking.count({
      where: { email: input.email, createdAt: { gte: new Date(Date.now() - BOOKING_WINDOW_MS) } },
    });
    if (recentCount >= BOOKING_MAX_PER_WINDOW) {
      return { success: false, error: "Too many booking attempts from this email recently. Please try again later." };
    }

    const slot = await prisma.availableSlot.findUnique({ where: { id: input.slotId } });

    if (!slot) {
      return { success: false, error: "This slot no longer exists. Please choose another time." };
    }
    if (slot.isBooked) {
      return { success: false, error: "This slot was just booked by someone else. Please choose another time." };
    }
    if (slot.startsAt < new Date()) {
      return { success: false, error: "This slot is in the past. Please choose another time." };
    }

    // Not updateMany() — the HTTP-based Neon adapter (see lib/prisma.ts)
    // rejects it unconditionally, so there's no atomic "claim only if not
    // already booked" update available here. Booking.slotId's @unique
    // constraint is the real race guard now: two requests can both pass the
    // isBooked check above, but only one booking.create() below can ever
    // succeed for a given slot — the loser hits P2002, caught further down.
    await prisma.availableSlot.update({ where: { id: input.slotId }, data: { isBooked: true } });

    let booking;
    try {
      booking = await prisma.booking.create({
        data: {
          slotId: input.slotId,
          name: input.name,
          email: input.email,
          phone: input.phone || null,
          company: input.company || null,
          message: input.message || null,
        },
      });
    } catch (error: any) {
      if (error.code === "P2002") {
        // Lost the race — someone else's create() for this exact slotId won
        // first, so the slot is legitimately booked now. Don't release it.
        return { success: false, error: "This slot was just booked by someone else. Please choose another time." };
      }
      // Any other failure means no booking exists for our own claim — safe
      // to release it back.
      await prisma.availableSlot.update({ where: { id: input.slotId }, data: { isBooked: false } }).catch(() => {});
      throw error;
    }

    const settings = await prisma.siteSetting.findFirst();
    await sendBookingNotification(
      { ...input, startsAt: slot.startsAt, duration: slot.duration },
      settings?.email
    );

    revalidatePath("/book-a-call");
    revalidatePath("/admin/booking");
    return { success: true, booking };
  } catch (error: any) {
    console.error("Failed to create booking:", error);
    return { success: false, error: error.message || "Failed to book this slot. Please try again." };
  }
}

// ------------------------------------------------------
// Admin
// ------------------------------------------------------

export async function getAllSlots() {
  try {
    await requireSession();
    return await prisma.availableSlot.findMany({
      orderBy: { startsAt: "asc" },
      include: { booking: true },
    });
  } catch (error) {
    console.error("Failed to fetch slots:", error);
    return [];
  }
}

export async function createSlot(data: { startsAt: string; duration: number }) {
  try {
    await requirePermission("CREATE");
    await prisma.availableSlot.create({
      data: {
        startsAt: new Date(data.startsAt),
        duration: data.duration,
      },
    });
    revalidatePath("/admin/booking");
    revalidatePath("/book-a-call");
    return { success: true };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error("Failed to create slot:", error);
    return { success: false, error: error.message };
  }
}

export async function createSlotsBulk(data: {
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  interval: number; // minutes between slot starts
  duration: number; // minutes per slot
}) {
  try {
    await requirePermission("CREATE");
    const [startH, startM] = data.startTime.split(":").map(Number);
    const [endH, endM] = data.endTime.split(":").map(Number);

    const dayStart = new Date(`${data.date}T00:00:00`);
    const rangeStart = new Date(dayStart);
    rangeStart.setHours(startH, startM, 0, 0);
    const rangeEnd = new Date(dayStart);
    rangeEnd.setHours(endH, endM, 0, 0);

    if (rangeEnd <= rangeStart) {
      return { success: false, error: "End time must be after start time." };
    }

    const slots: { startsAt: Date; duration: number }[] = [];
    for (let t = new Date(rangeStart); t < rangeEnd; t.setMinutes(t.getMinutes() + data.interval)) {
      slots.push({ startsAt: new Date(t), duration: data.duration });
    }

    if (slots.length === 0) {
      return { success: false, error: "No slots generated for that time range." };
    }

    // Not createMany(), and not $transaction() either — the HTTP-based Neon
    // adapter (see lib/prisma.ts) rejects both: createMany always needs more
    // than one underlying statement, and $transaction needs a real
    // BEGIN/COMMIT as soon as its array has more than one operation in it —
    // neither of which this adapter can do. Concurrent individual creates
    // (no shared transaction) is the only form of "many writes" it supports.
    await Promise.all(slots.map((slot) => prisma.availableSlot.create({ data: slot })));

    revalidatePath("/admin/booking");
    revalidatePath("/book-a-call");
    return { success: true, count: slots.length };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error("Failed to bulk-create slots:", error);
    return { success: false, error: error.message };
  }
}

export async function deleteSlot(id: string) {
  try {
    await requirePermission("DELETE");
    const slot = await prisma.availableSlot.findUnique({ where: { id } });
    if (slot?.isBooked) {
      return { success: false, error: "Can't delete a slot that already has a booking. Cancel the booking first." };
    }
    await prisma.availableSlot.delete({ where: { id } });
    revalidatePath("/admin/booking");
    revalidatePath("/book-a-call");
    return { success: true };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error(`Failed to delete slot ${id}:`, error);
    return { success: false, error: error.message };
  }
}

export async function getBookings() {
  try {
    await requireSession();
    return await prisma.booking.findMany({
      orderBy: { createdAt: "desc" },
      include: { slot: true },
    });
  } catch (error) {
    console.error("Failed to fetch bookings:", error);
    return [];
  }
}

export async function cancelBooking(id: string) {
  try {
    await requirePermission("EDIT");
    const booking = await prisma.booking.update({
      where: { id },
      data: { status: "CANCELLED" },
    });
    await prisma.availableSlot.update({
      where: { id: booking.slotId },
      data: { isBooked: false },
    });
    revalidatePath("/admin/booking");
    revalidatePath("/book-a-call");
    return { success: true };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error(`Failed to cancel booking ${id}:`, error);
    return { success: false, error: error.message };
  }
}
