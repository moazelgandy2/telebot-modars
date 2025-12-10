import fs from "fs";
import path from "path";

// Load data once
const coursesData = JSON.parse(
  fs.readFileSync(path.resolve("data/courses.json"), "utf-8")
);

const contactData = JSON.parse(
  fs.readFileSync(path.resolve("data/contact.json"), "utf-8")
);

const faqsData = JSON.parse(
  fs.readFileSync(path.resolve("data/faqs.json"), "utf-8")
);

export const getAllCourses = () => {
  return coursesData;
};

const extractArabic = (str: string) => str.match(/\(([^)]+)\)/)?.[1] || str;

const formatPrice = (price: string) =>
  price
    .replace(/EGP/g, "ج")
    .replace(/Month/g, "شهر")
    .replace(/Session/g, "حصة");

const translateTime = (time: string) =>
  time
    .replace(/Mondays?/gi, "الإثنين")
    .replace(/Sundays?/gi, "الأحد")
    .replace(/Tuesdays?/gi, "الثلاثاء")
    .replace(/Wednesdays?/gi, "الأربعاء")
    .replace(/Thursdays?/gi, "الخميس")
    .replace(/Fridays?/gi, "الجمعة")
    .replace(/Saturdays?/gi, "السبت")
    .replace(/AM/gi, "ص")
    .replace(/PM/gi, "م");

export const getCoursesSummary = () => {
  return coursesData
    .map((c: any) => {
      const lines = [
        `📌 ${extractArabic(c.subject)} (${extractArabic(c.level)})`,
      ];

      if (c.online.available) {
        lines.push(
          `- 🌐 أونلاين: ${c.online.times
            .map(translateTime)
            .join("، ")} (${formatPrice(c.online.price)})`
        );
      }

      c.centers.forEach((ctr: any) =>
        lines.push(
          `- 📍 ${extractArabic(ctr.name)}: ${ctr.times
            .map(translateTime)
            .join("، ")} (${formatPrice(ctr.price)})`
        )
      );

      if (c.books) {
        lines.push(
          `- 📚 كتاب: ${c.books.name} (${formatPrice(c.books.price)})`
        );
      }

      return lines.join("\n");
    })
    .join("\n\n");
};

export const getLocationDetails = () => {
  const locations = new Set<string>();

  coursesData.forEach((c: any) => {
    c.centers.forEach((ctr: any) => {
      locations.add(
        `📍 ${extractArabic(ctr.name)}\n${ctr.address || ctr.location}\n🗺️ ${
          ctr.maps_link || ""
        }`
      );
    });
  });

  return Array.from(locations).join("\n\n");
};

export const getContactInfo = () => {
  return `📞 تليفون: ${contactData.phone}
📱 واتساب: ${contactData.whatsapp}
✉️ إيميل: ${contactData.email}
📘 فيسبوك: ${contactData.facebook}
📸 إنستجرام: ${contactData.instagram}
⏰ مواعيد العمل: ${contactData.working_hours}`;
};

export const getFAQs = () =>
  faqsData.map((faq: any) => `❓ ${faq.question}\n${faq.answer}`).join("\n\n");
