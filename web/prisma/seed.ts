import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

const DATA_DIR = path.resolve(__dirname, '../../bot/data');

async function main() {
  console.log('Seeding database...');
  console.log(`Reading data from ${DATA_DIR}`);

  // 1. Seed Courses
  try {
    const coursesPath = path.join(DATA_DIR, 'courses.json');
    if (fs.existsSync(coursesPath)) {
      const coursesData = JSON.parse(fs.readFileSync(coursesPath, 'utf-8'));

      for (const c of coursesData) {
        // Prepare online data
        const onlineData = c.online ? {
          create: {
            available: c.online.available || false,
            platform: c.online.platform,
            times: c.online.times || [],
            price: c.online.price || "0"
          }
        } : undefined;

        // Prepare book data
        const bookData = c.books ? {
          create: {
            name: c.books.name,
            price: c.books.price
          }
        } : undefined;

        const createdCourse = await prisma.course.create({
          data: {
            subject: c.subject,
            level: c.level,
            teacher: c.teacher || null,
            online: onlineData,
            book: bookData,
            centers: {
              create: c.centers?.map((ctr: any) => ({
                name: ctr.name,
                location: ctr.location || ctr.address || "", // Fallback
                address: ctr.address || null,
                mapsLink: ctr.maps_link || null,
                times: ctr.times || [],
                price: ctr.price || "0"
              })) || []
            }
          }
        });
        console.log(`Created course: ${createdCourse.subject}`);
      }
    }
  } catch (e) {
    console.error("Error seeding courses:", e);
  }

  // 2. Seed FAQs
  try {
    const faqsPath = path.join(DATA_DIR, 'faqs.json');
    if (fs.existsSync(faqsPath)) {
      const faqsData = JSON.parse(fs.readFileSync(faqsPath, 'utf-8'));
      for (const f of faqsData) {
        await prisma.faq.create({
          data: {
            question: f.question,
            answer: f.answer
          }
        });
      }
      console.log(`Seeded ${faqsData.length} FAQs`);
    }
  } catch (e) {
     console.error("Error seeding FAQs:", e);
  }

  // 3. Seed Contact
  try {
    const contactPath = path.join(DATA_DIR, 'contact.json');
    if (fs.existsSync(contactPath)) {
      const contactData = JSON.parse(fs.readFileSync(contactPath, 'utf-8'));
      await prisma.contact.create({
        data: {
          phone: contactData.phone || "",
          whatsapp: contactData.whatsapp || "",
          email: contactData.email || "",
          facebook: contactData.facebook || "",
          instagram: contactData.instagram || "",
          workingHours: contactData.working_hours || "",
          responseTime: contactData.response_time || null,
          paymentMethods: contactData.payment_methods || {}
        }
      });
      console.log("Seeded Contact Info");
    }
  } catch (e) {
    console.error("Error seeding Contact:", e);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
