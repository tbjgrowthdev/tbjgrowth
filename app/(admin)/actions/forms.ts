"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { sendContactNotification } from "@/lib/email";

export async function submitContactForm(data: any) {
  try {
    const submission = await prisma.formSubmission.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        company: data.company,
        message: data.message,
        source: data.source || "Contact Page",
      },
    });

    const settings = await prisma.siteSetting.findFirst();
    await sendContactNotification(submission, settings?.email);

    revalidatePath("/admin/leads");
    return { success: true };
  } catch (error) {
    console.error("Failed to submit form:", error);
    return { success: false, error: "Failed to submit form" };
  }
}

export async function getLeads() {
  try {
    return await prisma.formSubmission.findMany({
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    console.error("Failed to fetch leads:", error);
    return [];
  }
}

export async function markLeadAsRead(id: string) {
  try {
    await prisma.formSubmission.update({
      where: { id },
      data: { isRead: true },
    });
    revalidatePath("/admin/leads");
    return { success: true };
  } catch (error) {
    return { success: false };
  }
}
