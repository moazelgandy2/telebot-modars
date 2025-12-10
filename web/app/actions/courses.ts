'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { Course as PrismaCourse, OnlineOption, Center, Book } from '@prisma/client';
import { redirect } from 'next/navigation';

// Combined type for UI
export interface Course extends PrismaCourse {
  online: OnlineOption | null;
  centers: Center[];
  books: Book | null;
}

export async function getCourses(): Promise<Course[]> {
  const courses = await prisma.course.findMany({
    include: {
      online: true,
      centers: true,
      book: true,
    },
    orderBy: { createdAt: 'desc' }
  });

  return courses.map(c => ({
    ...c,
    books: c.book
  }));
}

export async function getCourse(id: string): Promise<Course | null> {
  const course = await prisma.course.findUnique({
    where: { id },
    include: {
      online: true,
      centers: true,
      book: true,
    },
  });

  if (!course) return null;

  return {
    ...course,
    books: course.book
  };
}

export async function createCourse(data: Course) {
  await prisma.course.create({
    data: {
      subject: data.subject,
      level: data.level,
      online: data.online && data.online.available ? {
        create: {
          available: data.online.available,
          price: data.online.price,
          times: data.online.times,
          platform: data.online.platform
        }
      } : undefined,
      centers: {
        create: data.centers.map(ctr => ({
          name: ctr.name,
          location: ctr.location,
          address: ctr.address || "",
          mapsLink: ctr.mapsLink,
          times: ctr.times,
          price: ctr.price
        }))
      },
      book: data.books && data.books.name ? {
        create: { name: data.books.name, price: data.books.price }
      } : undefined
    }
  });
  revalidatePath('/courses');
}

export async function updateCourse(course: Course) {
  if (!course.id) return;

  await prisma.course.update({
    where: { id: course.id },
    data: {
      subject: course.subject,
      level: course.level,
      online: course.online ? {
        upsert: {
          create: {
             available: course.online.available,
             price: course.online.price,
             times: course.online.times,
             platform: course.online.platform
          },
          update: {
             available: course.online.available,
             price: course.online.price,
             times: course.online.times,
             platform: course.online.platform
          }
       }
      } : { delete: true }, // If null, delete relation?? Or update available=false?
                            // Prisma specific: if relation exists and we pass undefined, it does nothing.
                            // If we want to remove it, we might need delete.
                            // But our UI passes an object with available=false usually.

      centers: {
        deleteMany: {},
        create: course.centers.map(ctr => ({
          name: ctr.name,
          location: ctr.location,
          address: ctr.address || "",
          mapsLink: ctr.mapsLink,
          times: ctr.times,
          price: ctr.price
        }))
      },
      book: course.books ? {
        upsert: {
          create: { name: course.books.name, price: course.books.price },
          update: { name: course.books.name, price: course.books.price }
        }
      } : undefined
    }
  });

  revalidatePath('/courses');
  revalidatePath(`/courses/${course.id}`);
}

export async function deleteCourse(id: string) {
  await prisma.course.delete({ where: { id } });
  revalidatePath('/courses');
}

// Keep for backward compatibility if needed, but safer to use explicit ones
export async function updateCourses(courses: Course[]) {
  // Use generic bulk update logic or deprecate.
  // For now, let's keep it but rely on single actions for new pages.
  // We'll just re-implement the old logic to be safe for old components?
  // Old component logic was: loop and update/create, delete missing.

  const incomingIds = courses.map(c => c.id).filter(Boolean) as string[];

  // Delete missing
  await prisma.course.deleteMany({
     where: {
        id: { notIn: incomingIds }
     }
  });

  for (const c of courses) {
     if (c.id) {
        await updateCourse(c);
     } else {
        await createCourse(c);
     }
  }
  revalidatePath('/courses');
}
