"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { sendBookingNotification } from "@/lib/email";

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

export async function createBooking(data: {
  slotId: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  message?: string;
}) {
  try {
    const slot = await prisma.availableSlot.findUnique({ where: { id: data.slotId } });

    if (!slot) {
      return { success: false, error: "This slot no longer exists. Please choose another time." };
    }
    if (slot.isBooked) {
      return { success: false, error: "This slot was just booked by someone else. Please choose another time." };
    }
    if (slot.startsAt < new Date()) {
      return { success: false, error: "This slot is in the past. Please choose another time." };
    }

    const booking = await prisma.$transaction(async (tx) => {
      const updated = await tx.availableSlot.updateMany({
        where: { id: data.slotId, isBooked: false },
        data: { isBooked: true },
      });
      if (updated.count === 0) {
        throw new Error("This slot was just booked by someone else. Please choose another time.");
      }
      return tx.booking.create({
        data: {
          slotId: data.slotId,
          name: data.name,
          email: data.email,
          phone: data.phone || null,
          company: data.company || null,
          message: data.message || null,
        },
      });
    });

    const settings = await prisma.siteSetting.findFirst();
    await sendBookingNotification(
      { ...data, startsAt: slot.startsAt, duration: slot.duration },
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

    await prisma.availableSlot.createMany({ data: slots });

    revalidatePath("/admin/booking");
    revalidatePath("/book-a-call");
    return { success: true, count: slots.length };
  } catch (error: any) {
    console.error("Failed to bulk-create slots:", error);
    return { success: false, error: error.message };
  }
}

export async function deleteSlot(id: string) {
  try {
    const slot = await prisma.availableSlot.findUnique({ where: { id } });
    if (slot?.isBooked) {
      return { success: false, error: "Can't delete a slot that already has a booking. Cancel the booking first." };
    }
    await prisma.availableSlot.delete({ where: { id } });
    revalidatePath("/admin/booking");
    revalidatePath("/book-a-call");
    return { success: true };
  } catch (error: any) {
    console.error(`Failed to delete slot ${id}:`, error);
    return { success: false, error: error.message };
  }
}

export async function getBookings() {
  try {
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
    console.error(`Failed to cancel booking ${id}:`, error);
    return { success: false, error: error.message };
  }
}
