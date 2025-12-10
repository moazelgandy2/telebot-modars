const API_BASE_URL = "http://localhost:3000/api";

async function fetchData(endpoint: string) {
  try {
    const res = await fetch(`${API_BASE_URL}/${endpoint}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to fetch ${endpoint}`);
    return await res.json() as any;
  } catch (error) {
    console.error(`Error fetching ${endpoint}:`, error);
    return null;
  }
}

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

export const getCoursesSummary = async () => {
  const coursesData = await fetchData("courses");
  if (!coursesData) return "معلش، مش قادر أوصل للبيانات حالياً.";

  return coursesData
    .map((c: any) => {
      const lines = [
        `📌 ${extractArabic(c.subject)} (${extractArabic(c.level)})`,
      ];

      if (c.online?.available) {
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

      if (c.book) {
        lines.push(
          `- 📚 كتاب: ${c.book.name} (${formatPrice(c.book.price)})`
        );
      }

      return lines.join("\n");
    })
    .join("\n\n");
};

export const getLocationDetails = async () => {
  const coursesData = await fetchData("courses");
  if (!coursesData) return "معلش، مش قادر أوصل للبيانات حالياً.";

  const locations = new Set<string>();

  coursesData.forEach((c: any) => {
    c.centers.forEach((ctr: any) => {
      locations.add(
        `📍 ${extractArabic(ctr.name)}\n${ctr.location || ctr.address}\n🗺️ ${
          ctr.mapsLink || ""
        }`
      );
    });
  });

  return Array.from(locations).join("\n\n");
};

export const getContactInfo = async () => {
  const contactData = await fetchData("contact");
  if (!contactData) return "No contact info available.";

  return `📞 تليفون: ${contactData.phone || ''}
📱 واتساب: ${contactData.whatsapp || ''}
✉️ إيميل: ${contactData.email || ''}
📘 فيسبوك: ${contactData.facebook || ''}
📸 إنستجرام: ${contactData.instagram || ''}
⏰ مواعيد العمل: ${contactData.workingHours || ''}`;
};

export const getFAQs = async () => {
  const faqs = await fetchData("faqs");
  if (!faqs) return "معلش، مش قادر أوصل للأسئلة حالياً.";
  return faqs.map((faq: any) => `❓ ${faq.question}\n${faq.answer}`).join("\n\n");
};
