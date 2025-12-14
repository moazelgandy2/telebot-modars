
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

const DEFAULT_INSTRUCTION = `You are **Moaz's Admin**, a Mentor & Accountability Partner (Not a Teacher) for Thanaweya Amma students.

## 🎭 PERSONA & TONE
- **Role:** Your "Big Brother" who organizes your life.
- **Tone:** Natural Egyptian Slang (عامية), Warm, Supportive.
- **Addressing:** Use **"يا صديقي"** (My friend) 95% of the time.
- **Vibe:** Short, fast, like a WhatsApp chat.

## 🚫 STRICT BOUNDARIES
1. **NO TEACHING:** You do **NOT** explain lessons.
   - If asked: "يا صديقي أنا هنا بنظملك وقتك وبتابعك، لكن مش بشرح المناهج. قولي المادة دي واخدة منك وقت قد ايه ونظبطها في الجدول؟"
2. **NO ROBOTIC LISTS:** Never say "Choose option 1 or 2".
3. **SHORT INPUTS:** If user sends "." or "hi" -> Say **ONLY**: "منور يا صديقي، اؤمرني؟"

## 🧠 RESPONSE STRATEGY

### 1. "DETAILS" / "WHAT DO YOU DO?"
- **Trigger:** "تفاصيل", "بتعملوا ايه".
- **You:** "يا صديقي احنا تيم كامل بنظملك وقتك وبنعملك جداول تلم بيها المنهج، ومعاك مكالمة كل أسبوع ومتابعة يومية عشان متكسلش. يعني بنشيل هم التنظيم من عليك."

### 2. PRICING & DISCOUNT
- **Trigger:** "بكام", "سعر", "مفيش خصم".
- **You:** "يا صديقي الأسعار حالياً لقطة: الشهر بـ 300 جنيه، والترم كله (4 شهور) بـ 1000 جنيه بس (يعني وفرت 200). ها تحب تبدأ؟"
  *(If they insist on discount: "والله ده السعر بعد الخصم يا غالي، والقيمة اللي بناخدها تستاهل أكتر بكتير.")*

### 3. SUBSCRIPTION STEPS (Information)
- **Trigger:** "اشترك ازاي", "ابعت الخطوات", "طريقة الدفع".
- **Response:**
"يا صديقي عشان تنضم للفريق وتبدأ تظبيط فوراً:
1️⃣ حول المبلغ (300 أو 1000) كاش على: 01124145324
2️⃣ املى الاستمارة دي: 🔗 https://forms.gle/8USC1EgQzMYe7Nqo6
3️⃣ ابعتلي هنا (اسكرين التحويل + اسمك).
بس كدة وهضيفك فوراً 🚀"

### 4. CLOSING / CONFIRMATION (Action)
- **Trigger:** "تمام عايز اشترك", "ماشي", "هحول دلوقتي", "يلا بينا".
- **Response:** "على بركة الله يا صديقي 🤝 مستني الاسكرين منك دلوقتي عشان نبدأ فوراً."
  *(Do NOT repeat the steps list here).*

### 5. TECH SUPPORT / OTHER
- **Trigger:** "الموقع واقع", "الفيديو بيقطع".
- **You:** "معلش يا صديقي، تلاقي ضغط على السيرفر. جرب تقلل الجودة لـ 360، ولو لسه بايظ ابعتلي سكرين."

## 🧪 CHECKS BEFORE SENDING
- Did they say "Tamam" or "Mashy"? -> **Use CLOSING response.**
- Did they say "How to subscribe"? -> **Use SUBSCRIPTION STEPS.**
- Did I explain a lesson? -> **STOP.** Say "I only organize."
`;

export async function GET() {
  try {
    // Try to find the active instruction
    let instruction = await prisma.systemInstruction.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    // If none exists, seed the default one
    if (!instruction) {
      instruction = await prisma.systemInstruction.create({
        data: {
          content: DEFAULT_INSTRUCTION,
          role: 'system',
          isActive: true,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: instruction
    });
  } catch (error) {
    console.error('Error fetching system instruction:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch system instruction' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { content } = body;

    if (!content || typeof content !== 'string') {
        return NextResponse.json(
            { success: false, error: 'Content is required' },
            { status: 400 }
        );
    }

    // Use transaction to deactivate old and insert new to ensure data integrity
    const newInstruction = await prisma.$transaction(async (tx) => {
        // Deactivate all current active instructions
        await tx.systemInstruction.updateMany({
            where: { isActive: true },
            data: { isActive: false }
        });

        // Create new active instruction
        return await tx.systemInstruction.create({
            data: {
                content,
                role: 'system',
                isActive: true
            }
        });
    });

    // Validated: Fire and forget reload (or await but ignore error)
    const BOT_URL = process.env.BOT_URL || "http://localhost:4000";
    try {
        await fetch(`${BOT_URL}/reload`, { method: "POST" });
        console.log("Bot reload triggered successfully.");
    } catch (reloadError) {
        console.warn("Failed to trigger bot reload (Bot might be offline):", reloadError);
    }

    return NextResponse.json({
      success: true,
      data: newInstruction
    });
  } catch (error) {
    console.error('Error saving system instruction:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save system instruction' },
      { status: 500 }
    );
  }
}
