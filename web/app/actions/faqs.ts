"use server";

import { prisma } from "@/lib/db";
import { revalidatePath, unstable_noStore as noStore } from "next/cache";
import { Faq as PrismaFAQ } from "@prisma/client";

export type FAQ = PrismaFAQ;

export async function getFaqs(): Promise<FAQ[]> {
  noStore();
  return prisma.faq.findMany({
    orderBy: { id: "asc" },
  });
}

export async function updateFaqs(
  faqs: Omit<FAQ, "id" | "createdAt" | "updatedAt">[]
): Promise<void> {
  // Strategy: For simplicity, we can delete all and recreate, or optimize.
  // Given the small scale, delete all and recreate is safest for sync,
  // but let's try to be smarter or just upsert/delete.
  // If the user interface sends the whole list, replacement is appropriate for order preservation if ID isn't tracked strictly.

  // However, existing actions logic was "receive whole list and save".
  // To keep it simple and consistent:
  await prisma.$transaction([
    prisma.faq.deleteMany(),
    prisma.faq.createMany({
      data: faqs.map((f) => ({ question: f.question, answer: f.answer })),
    }),
  ]);

  revalidatePath("/faqs");
}
