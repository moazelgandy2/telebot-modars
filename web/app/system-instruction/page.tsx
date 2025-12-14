'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Save, RefreshCw } from "lucide-react";
import MDEditor from '@uiw/react-md-editor';

export default function SystemInstructionPage() {
  const [instruction, setInstruction] = useState("**مرحباً**");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchInstruction = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/system-instruction');
      const data = await res.json();
      if (data.success && data.data) {
        setInstruction(data.data.content);
      }
      toast.success("تم التحميل", {
        description: "تم تحميل تعليمات النظام بنجاح"
      });
    } catch (error) {
      console.error("Error fetching instruction:", error);
      toast.error("خطأ", {
        description: "فشل تحميل التعليمات"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInstruction();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/system-instruction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: instruction }),
      });
      const data = await res.json();

      if (data.success) {
        toast.success("تم الحفظ", {
          description: "تم تحديث تعليمات النظام بنجاح"
        });
      } else {
         throw new Error(data.error || "Failed to save");
      }
    } catch (error) {
       console.error("Error saving instruction:", error);
       toast.error("خطأ", {
        description: "فشل حفظ التعليمات"
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">جاري التحميل...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
         <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">توجيهات النظام (System Prompt)</h1>
            <p className="text-muted-foreground">
                هنا تقدر تعدل التعليمات اللي البوت بيمشي عليها.
            </p>
         </div>
         <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={fetchInstruction} title="تحديث">
                <RefreshCw className="h-4 w-4" />
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
                <Save className="h-4 w-4" />
                {saving ? "جاري الحفظ..." : "حفظ التعديلات"}
            </Button>
         </div>
      </div>

      <div className="h-[calc(100vh-200px)] flex flex-col" data-color-mode="light">
         <MDEditor
            value={instruction}
            onChange={(val) => setInstruction(val || "")}
            height="100%"
            preview="live"
            style={{ direction: 'ltr' }}
            visibleDragbar={false}
         />
      </div>
    </div>
  );
}
