"use server";

import { prisma } from "@/lib/db";
import { revalidatePath, unstable_noStore as noStore } from "next/cache";
import { Contact } from "@prisma/client";

export type ContactData = Contact;

export async function getContactData(): Promise<ContactData> {
  noStore();
  const contact = await prisma.contact.findFirst();
  if (!contact) {
    // Should verify seed ran, but return default if empty
    return {
      phone: "",
      whatsapp: "",
      email: "",
      facebook: "",
      instagram: "",
      workingHours: "",
      id: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      responseTime: null,
      paymentMethods: {},
    };
  }
  return contact;
}

export async function updateContactData(data: ContactData): Promise<void> {
  // Upsert using ID 1 or the ID provided
  await prisma.contact.upsert({
    where: { id: data.id || 1 },
    update: {
      phone: data.phone,
      whatsapp: data.whatsapp,
      email: data.email,
      facebook: data.facebook,
      instagram: data.instagram,
      workingHours: data.workingHours,
    },
    create: {
      phone: data.phone,
      whatsapp: data.whatsapp,
      email: data.email,
      facebook: data.facebook,
      instagram: data.instagram,
      workingHours: data.workingHours,
    },
  });
  revalidatePath("/contact");
}
