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

const extractArabic = (str: string) => str?.match(/\(([^)]+)\)/)?.[1] || str || "N/A";

const formatPrice = (price: string) =>
  price
    ? price.replace(/EGP/g, "ج").replace(/Month/g, "شهر").replace(/Session/g, "حصة")
    : "غير محدد";

const translateTime = (time: string) =>
  time
    ? time
        .replace(/Mondays?/gi, "الإثنين")
        .replace(/Sundays?/gi, "الأحد")
        .replace(/Tuesdays?/gi, "الثلاثاء")
        .replace(/Wednesdays?/gi, "الأربعاء")
        .replace(/Thursdays?/gi, "الخميس")
        .replace(/Fridays?/gi, "الجمعة")
        .replace(/Saturdays?/gi, "السبت")
        .replace(/AM/gi, "ص")
        .replace(/PM/gi, "م")
    : "";

// --- 1. get_course_info ---
export const getCoursesSummary = async () => {
  const coursesData = await fetchData("courses");
  if (!coursesData) return "معلش، مش قادر أوصل للبيانات حالياً.";

  return coursesData
    .map((c: any) => {
      const lines = [`📌 ${extractArabic(c.subject)} (${extractArabic(c.level)}) [ID: ${c.id}]`];

      if (c.online?.available) {
        lines.push(
          `- 🌐 أونلاين: ${c.online.times.map(translateTime).join("، ")} (${formatPrice(c.online.price)})`
        );
      }

      c.centers.forEach((ctr: any) =>
        lines.push(
          `- 📍 ${extractArabic(ctr.name)}: ${ctr.times.map(translateTime).join("، ")} (${formatPrice(ctr.price)})`
        )
      );

      if (c.book) {
        lines.push(`- 📚 كتاب: ${c.book.name} (${formatPrice(c.book.price)})`);
      }

      return lines.join("\n");
    })
    .join("\n\n");
};

// --- 2. get_prices ---
export const getPrices = async () => {
  const coursesData = await fetchData("courses");
  if (!coursesData) return "لا توجد بيانات أسعار متاحة.";

  return coursesData.map((c: any) => {
    let details = `💰 ${extractArabic(c.subject)} (${extractArabic(c.level)}):`;
    if (c.online?.available) details += `\n   - أونلاين: ${formatPrice(c.online.price)}`;
    c.centers.forEach((ctr: any) => details += `\n   - ${extractArabic(ctr.name)}: ${formatPrice(ctr.price)}`);
    if (c.book) details += `\n   - الكتاب: ${formatPrice(c.book.price)}`;
    return details;
  }).join("\n\n");
};

// --- 3. get_locations ---
export const getLocationDetails = async () => {
  const coursesData = await fetchData("courses");
  if (!coursesData) return "لا توجد بيانات مواقع متاحة.";

  const locations = new Map<string, string>();
  coursesData.forEach((c: any) => {
    c.centers.forEach((ctr: any) => {
      if (!locations.has(ctr.name)) {
        locations.set(ctr.name, `📍 ${extractArabic(ctr.name)}\n${ctr.location || ctr.address}\n🗺️ ${ctr.mapsLink || ""}`);
      }
    });
  });

  return Array.from(locations.values()).join("\n\n");
};

// --- 4. get_faqs ---
export const getFAQs = async () => {
  const faqs = await fetchData("faqs");
  if (!faqs) return "لا توجد أسئلة شائعة متاحة.";
  return faqs.map((faq: any) => `❓ ${faq.question}\n✅ ${faq.answer}`).join("\n\n");
};

// --- 5. get_contacts ---
export const getContactInfo = async () => {
  const contactData = await fetchData("contact");
  if (!contactData) return "لا توجد بيانات اتصال متاحة.";

  return `📞 تليفون: ${contactData.phone || ''}
📱 واتساب: ${contactData.whatsapp || ''}
✉️ إيميل: ${contactData.email || ''}
📘 فيسبوك: ${contactData.facebook || ''}
📸 إنستجرام: ${contactData.instagram || ''}
⏰ مواعيد العمل: ${contactData.workingHours || ''}
⚡ سرعة الرد: ${contactData.responseTime || 'سريع'}
💳 طرق الدفع: ${contactData.paymentMethods?.join("، ") || 'كاش'}`;
};

// --- 6. search_courses ---
export const searchCourses = async (keyword: string) => {
  const coursesData = await fetchData("courses");
  if (!coursesData) return "خطأ في البحث.";

  const term = keyword.toLowerCase();
  const results = coursesData.filter((c: any) =>
    JSON.stringify(c).toLowerCase().includes(term)
  );

  if (results.length === 0) return "مفيش كورسات مطابقة للبحث ده.";
  return results.map((c: any) => `📌 ${extractArabic(c.subject)} (${extractArabic(c.level)})`).join("\n");
};

// --- 7. get_course_by_id ---
export const getCourseById = async (id: string) => {
  const coursesData = await fetchData("courses");
  if (!coursesData) return "خطأ في البيانات.";
  const course = coursesData.find((c: any) => c.id === id || c.id === Number(id)); // Flexible matching

  if (!course) return "الكورس ده مش موجود.";

  // Reuse summary logic for single item
  return [course].map((c: any) => {
      const lines = [`📌 ${extractArabic(c.subject)} (${extractArabic(c.level)})`];
      if (c.online?.available) {
        lines.push(`- 🌐 أونلاين: ${c.online.times.map(translateTime).join("، ")}`);
      }
      c.centers.forEach((ctr: any) =>
        lines.push(`- 📍 ${extractArabic(ctr.name)}: ${ctr.times.map(translateTime).join("، ")}`)
      );
      return lines.join("\n");
    }).join("");
};

// --- 8. get_all_subjects ---
export const getAllSubjects = async () => {
  const coursesData = await fetchData("courses");
  if (!coursesData) return "خطأ.";
  const subjects = new Set(coursesData.map((c: any) => extractArabic(c.subject)));
  return Array.from(subjects).join("، ");
};

// --- 9. get_all_levels ---
export const getAllLevels = async () => {
  const coursesData = await fetchData("courses");
  if (!coursesData) return "خطأ.";
  const levels = new Set(coursesData.map((c: any) => extractArabic(c.level)));
  return Array.from(levels).join("، ");
};

// --- 10. search_faqs ---
export const searchFAQs = async (keyword: string) => {
  const faqs = await fetchData("faqs");
  if (!faqs) return "خطأ.";
  const term = keyword.toLowerCase();
  const results = faqs.filter((f: any) =>
    f.question.toLowerCase().includes(term) || f.answer.toLowerCase().includes(term)
  );
  if (results.length === 0) return "مفيش أسئلة مطابقة.";
  return results.map((f: any) => `❓ ${f.question}\n✅ ${f.answer}`).join("\n\n");
};

// --- 11. search_locations ---
export const searchLocations = async (keyword: string) => {
  const locs = await getLocationDetails(); // Reuse formatted string
  if (!locs) return "خطأ.";

  // Simple post-processing of the formatted string
  const term = keyword.toLowerCase();
  const chunks = locs.split("\n\n");
  const matches = chunks.filter(chunk => chunk.toLowerCase().includes(term));

  if (matches.length === 0) return "مفيش سنتر بالاسم ده.";
  return matches.join("\n\n");
};

// --- 12. get_schedule_summary ---
export const getScheduleSummary = async () => {
  const coursesData = await fetchData("courses");
  if (!coursesData) return "خطأ.";

  // Compact format
  return coursesData.map((c: any) => {
    let info = `📅 ${extractArabic(c.subject)} (${extractArabic(c.level)})`;
    if (c.online?.available) info += ` | 🌐: ${c.online.times.map(translateTime).join(",")}`;
    c.centers.forEach((ctr: any) => info += ` | 📍${extractArabic(ctr.name)}: ${ctr.times.map(translateTime).join(",")}`);
    return info;
  }).join("\n");
};

// --- 13. get_payment_methods ---
export const getPaymentMethods = async () => {
  const contactData = await fetchData("contact");
  if (!contactData) return "خطأ.";
  return `💳 طرق السداد المتاحة: ${contactData.paymentMethods?.join("، ") || 'كاش فقط'}`;
};

// --- 14. get_book_list ---
export const getBookList = async () => {
  const coursesData = await fetchData("courses");
  if (!coursesData) return "خطأ.";

  const books = coursesData
    .filter((c: any) => c.book)
    .map((c: any) => `📚 ${c.book.name} - ${formatPrice(c.book.price)} (${extractArabic(c.subject)})`);

  if (books.length === 0) return "مفيش كتب متاحة حالياً.";
  return books.join("\n");
};
