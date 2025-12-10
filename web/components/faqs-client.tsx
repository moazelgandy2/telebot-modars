'use client';

import { FAQ, updateFaqs } from "@/app/actions/faqs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Save } from "lucide-react";
import { useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Label } from "@/components/ui/label";

interface FaqsClientProps {
  initialFaqs: FAQ[];
}

export function FaqsClient({ initialFaqs }: FaqsClientProps) {
  const [faqs, setFaqs] = useState<FAQ[]>(initialFaqs);
  const [openItem, setOpenItem] = useState<string | undefined>(undefined);

  const handleSaveAll = async () => {
    await updateFaqs(faqs);
  };

  const addFaq = () => {
    const newFaq = {
        question: "سؤال جديد", // New Question
        answer: "",
        id: 0,
        createdAt: new Date(),
        updatedAt: new Date()
    } as unknown as FAQ;
    const newFaqs = [...faqs, newFaq];
    setFaqs(newFaqs);
    setOpenItem(`item-${newFaqs.length - 1}`);
  };

  const removeFaq = (index: number) => {
    if (confirm("عايز تمسح السؤال ده؟")) { // Delete this FAQ?
      const newFaqs = [...faqs];
      newFaqs.splice(index, 1);
      setFaqs(newFaqs);
      // We should probably save here too or wait for explicit save
      updateFaqs(newFaqs);
    }
  };

  const updateFaq = (index: number, field: keyof FAQ, value: string) => {
    const newFaqs = [...faqs];
    newFaqs[index] = { ...newFaqs[index], [field]: value };
    setFaqs(newFaqs);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
         <h2 className="text-2xl font-bold tracking-tight">الأسئلة الشائعة</h2> {/* Manage FAQs */}
         <div className="flex gap-2">
            <Button onClick={addFaq}>
               <Plus className="ml-2 h-4 w-4" /> ضيف سؤال {/* Add FAQ (ml-2 for RTL) */}
            </Button>
            <Button onClick={handleSaveAll} variant="default">
               <Save className="ml-2 h-4 w-4" /> حفظ التغييرات {/* Save Changes (ml-2 for RTL) */}
            </Button>
         </div>
      </div>

      <div className="border rounded-lg p-4 bg-card">
        <Accordion type="single" collapsible value={openItem} onValueChange={setOpenItem} className="w-full">
          {faqs.map((faq, index) => (
            <AccordionItem key={index} value={`item-${index}`}>
              <AccordionTrigger className="hover:no-underline">
                 <span className={!faq.question ? "text-muted-foreground italic" : ""}>
                    {faq.question || "سؤال فاضي"} {/* Empty Question */}
                 </span>
              </AccordionTrigger>
              <AccordionContent className="p-4 space-y-4 bg-muted/30 rounded-md mb-2">
                <div className="space-y-2">
                   <Label>السؤال</Label> {/* Question */}
                   <Input
                      value={faq.question}
                      onChange={(e) => updateFaq(index, "question", e.target.value)}
                      placeholder="مثلاً: ايه نظام الحجز؟" // e.g. What is the refund policy?
                   />
                </div>
                <div className="space-y-2">
                   <Label>الإجابة</Label> {/* Answer */}
                   <Textarea
                      value={faq.answer}
                      onChange={(e) => updateFaq(index, "answer", e.target.value)}
                      placeholder="اكتب الإجابة هنا..." // Type the answer here...
                      className="min-h-[100px]"
                   />
                </div>
                <div className="flex justify-end pt-2">
                   <Button variant="destructive" size="sm" onClick={() => removeFaq(index)}>
                      <Trash2 className="ml-2 h-4 w-4" /> مسح السؤال {/* Delete FAQ */}
                   </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
        {faqs.length === 0 && (
           <div className="text-center py-12 text-muted-foreground">
              لسه مفيش أسئلة مضافة. {/* No frequently asked questions added yet. */}
           </div>
        )}
      </div>
    </div>
  );
}
