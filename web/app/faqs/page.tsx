"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea"; // Assuming this exists, based on file list
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Trash2, Edit2, Loader2, Save } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface FAQ {
  id: string;
  question: string;
  answer: string;
  createdAt: string;
}

export default function FAQPage() {
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ question: "", answer: "" });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchFAQs = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/faqs");
      const data = await res.json();
      if (data.success) {
        setFaqs(data.data);
      } else {
        toast({ title: "خطأ", description: "فشل تحميل الأسئلة", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "خطأ", description: "مشكلة في الإتصال", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFAQs();
  }, []);

  const handleSubmit = async () => {
    if (!formData.question.trim() || !formData.answer.trim()) {
      toast({ title: "بيانات ناقصة", description: "لازم تكتب السؤال والإجابة", variant: "destructive" });
      return;
    }

    try {
      setSaving(true);
      const res = await fetch("/api/faqs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, id: editingId }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "تمام", description: editingId ? "تم تحديث السؤال" : "تم إضافة السؤال بنجاح" });
        setIsDialogOpen(false);
        setFormData({ question: "", answer: "" });
        setEditingId(null);
        fetchFAQs();
      } else {
        toast({ title: "خطأ", description: data.error || "فشل الحفظ", variant: "destructive" });
      }
    } catch (error) {
        toast({ title: "خطأ", description: "مشكلة في الإتصال", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("متأكد إنك عايز تمسح السؤال ده؟")) return;
    try {
      const res = await fetch(`/api/faqs?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast({ title: "تم المسح", description: "تم حذف السؤال بنجاح" });
        setFaqs(faqs.filter((f) => f.id !== id));
      } else {
        toast({ title: "خطأ", description: "فشل الحذف", variant: "destructive" });
      }
    } catch (error) {
        toast({ title: "خطأ", description: "مشكلة في الإتصال", variant: "destructive" });
    }
  };

  const openEdit = (faq: FAQ) => {
    setEditingId(faq.id);
    setFormData({ question: faq.question, answer: faq.answer });
    setIsDialogOpen(true);
  };

  const openNew = () => {
      setEditingId(null);
      setFormData({ question: "", answer: "" });
      setIsDialogOpen(true);
  }

  return (
    <div className="container mx-auto py-10 px-4 max-w-5xl">
      <div className="flex justify-between items-center mb-8" dir="rtl">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">إدارة الأسئلة الشائعة</h1>
          <p className="text-muted-foreground mt-2">
            التحكم في الأسئلة اللي البوت بيرد عليها بشكل تلقائي.
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}>
              <Plus className="ml-2 h-4 w-4" /> إضافة سؤال
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]" dir="rtl">
            <DialogHeader className="text-right">
              <DialogTitle>{editingId ? "تعديل السؤال" : "إضافة سؤال جديد"}</DialogTitle>
              <DialogDescription>
                لما حد يسأل سؤال مشابه، البوت هيرد عليه بالإجابة دي بالظبط.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2 text-right">
                <label htmlFor="question" className="text-sm font-medium">
                  السؤال
                </label>
                <Input
                  id="question"
                  placeholder="مثال: السعر كام؟ / بكام الشهر؟"
                  value={formData.question}
                  onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                  className="text-right"
                />
              </div>
              <div className="grid gap-2 text-right">
                <label htmlFor="answer" className="text-sm font-medium">
                  الإجابة
                </label>
                <Textarea
                  id="answer"
                  placeholder="مثال: سعر الشهر 300 جنيه يا صديقي."
                  rows={5}
                  value={formData.answer}
                  onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
                  className="text-right"
                />
              </div>
            </div>
            <DialogFooter className="mr-auto">
              <Button onClick={handleSubmit} disabled={saving}>
                {saving && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                حفظ
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card dir="rtl">
        <CardHeader className="text-right">
          <CardTitle>الأسئلة الموجودة</CardTitle>
          <CardDescription>
            قايمة بكل الأسئلة والأجوبة المتسجلة.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : faqs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              مفيش أسئلة لسه! دوس إضافة عشان تبدأ.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[30%] text-right">السؤال</TableHead>
                  <TableHead className="w-[50%] text-right">الإجابة</TableHead>
                  <TableHead className="w-[20%] text-left">تحكم</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {faqs.map((faq) => (
                  <TableRow key={faq.id}>
                    <TableCell className="font-medium align-top pt-4 text-right">
                        {faq.question}
                    </TableCell>
                    <TableCell className="align-top pt-4 whitespace-pre-wrap text-muted-foreground text-right">
                        {faq.answer}
                    </TableCell>
                    <TableCell className="text-left align-top pt-4">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(faq)}
                        className="ml-2"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive/90"
                        onClick={() => handleDelete(faq.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
