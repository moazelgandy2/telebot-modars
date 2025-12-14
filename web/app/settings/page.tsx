'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";


import { Lock } from "lucide-react";
import { useToast } from '@/components/ui/use-toast';

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    apiId: '',
    apiHash: '',
    stringSession: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data) {
          setSettings({
            apiId: data.data.apiId || '',
            apiHash: data.data.apiHash || '',
            stringSession: data.data.stringSession || '',
          });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSettings(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();

      if (data.success) {
        toast({
          title: "تم الحفظ",
          description: "تم تحديث إعدادات البوت بنجاح. يرجى إعادة تشغيل البوت لتفعيل التغييرات."
        });
      } else {
         throw new Error(data.error || "Failed to save");
      }
    } catch (error) {
       console.error("Error saving settings:", error);
       toast({
        variant: "destructive",
        title: "خطأ",
        description: "فشل حفظ الإعدادات"
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">جاري التحميل...</div>;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="space-y-1">
         <h1 className="text-3xl font-bold tracking-tight">إعدادات البوت</h1>
         <p className="text-muted-foreground">
             تكوين بيانات الاتصال بتيليجرام (API Credentials).
         </p>
      </div>

      <Card>
         <CardHeader>
           <CardTitle>بيانات الاعتماد (Credentials)</CardTitle>
           <CardDescription>هذه البيانات حساسة، لا تشاركها مع أحد.</CardDescription>
         </CardHeader>
         <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="apiId" className="text-sm font-medium">API ID</label>
              <Input
                id="apiId"
                name="apiId"
                value={settings.apiId}
                onChange={handleChange}
                placeholder="Ex: 123456"
                className="font-mono direction-ltr"
                style={{ direction: 'ltr' }}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="apiHash" className="text-sm font-medium">API Hash</label>
              <Input
                id="apiHash"
                name="apiHash"
                value={settings.apiHash}
                onChange={handleChange}
                placeholder="Ex: a1b2c3d4e5..."
                type="password"
                className="font-mono direction-ltr"
                style={{ direction: 'ltr' }}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="stringSession" className="text-sm font-medium">String Session</label>
              <Input
                id="stringSession"
                name="stringSession"
                value={settings.stringSession}
                onChange={handleChange}
                placeholder="Session String..."
                type="password"
                className="font-mono direction-ltr"
                style={{ direction: 'ltr' }}
              />
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full gap-2 mt-4">
               <Lock className="h-4 w-4" />
               {saving ? "جاري الحفظ..." : "حفظ وتحديث"}
            </Button>
         </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground text-center">
         ملاحظة: تحتاج لإعادة تشغيل البوت ليقرأ البيانات الجديدة من قاعدة البيانات.
      </div>
    </div>
  );
}
