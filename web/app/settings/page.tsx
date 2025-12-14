'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {  Save, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    apiId: '',
    apiHash: '',
    stringSession: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
        toast.success("تم الحفظ", {
          description: "تم تحديث الإعدادات بنجاح."
        });
      } else {
         throw new Error(data.error || "Failed to save");
      }
    } catch (error) {
       console.error("Error saving settings:", error);
       toast.error("خطأ", {
        description: "فشل حفظ الإعدادات"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReload = async () => {
      setSaving(true);
      try {
          const res = await fetch('/api/bot/reload', { method: 'POST' });
          if (res.ok) {
              toast.success("تم تحديث البوت", { description: "تم إعادة تشغيل النظام بالإعدادات الجديدة." });
          } else {
              throw new Error("Reload failed");
          }
      } catch (e) {
          toast.error("خطأ", { description: "فشل في إعادة تشغيل البوت." });
      } finally {
          setSaving(false);
      }
  };

  if (loading) return <div className="p-8 text-center text-xs text-muted-foreground animate-pulse">جاري تحميل الإعدادات...</div>;

  return (
    <div className="container max-w-4xl py-6 space-y-6 animate-in fade-in duration-500">

      {/* Minimal Header */}
      <div className="flex items-center justify-between">
         <div>
             <h1 className="text-xl font-semibold tracking-tight">إعدادات البوت</h1>
             <p className="text-sm text-muted-foreground">إدارة بيانات الاتصال وحالة النظام.</p>
         </div>
         <Button
            variant="ghost"
            size="sm"
            onClick={handleReload}
            disabled={saving}
            className="text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 gap-1.5"
         >
             <RefreshCw className={`w-3.5 h-3.5 ${saving ? 'animate-spin' : ''}`} />
             تحديث البوت
         </Button>
      </div>

      {/* Compact Card */}
      <Card className="border-border/40 shadow-none bg-background/50 backdrop-blur-sm">
         <CardContent className="p-6">
            <div className="grid gap-5">

                {/* Credentials Group */}
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground ml-1">معرف التطبيق (App ID)</label>
                        <Input
                            name="apiId"
                            value={settings.apiId}
                            onChange={handleChange}
                            placeholder="123456"
                            className="h-9 font-mono text-sm bg-muted/50 border-border/50 focus:border-primary/50 focus:ring-0 transition-all"
                            style={{ direction: 'ltr' }}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground ml-1">رمز الوصول (App Hash)</label>
                        <Input
                            name="apiHash"
                            value={settings.apiHash}
                            onChange={handleChange}
                            placeholder="Hash String"
                            type="password"
                            className="h-9 font-mono text-sm bg-muted/50 border-border/50 focus:border-primary/50 focus:ring-0 transition-all"
                            style={{ direction: 'ltr' }}
                        />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground ml-1">جلسة المصادقة (String Session)</label>
                    <Input
                        name="stringSession"
                        value={settings.stringSession}
                        onChange={handleChange}
                        placeholder="1BVts..."
                        type="password"
                        className="h-9 font-mono text-sm bg-muted/50 border-border/50 focus:border-primary/50 focus:ring-0 transition-all"
                        style={{ direction: 'ltr' }}
                    />
                </div>

                {/* Actions Footer within Card */}
                <div className="pt-2 flex justify-end">
                    <Button
                        onClick={handleSave}
                        disabled={saving}
                        size="sm"
                        className="gap-2 min-w-[100px] h-9"
                    >
                       {saving ? <span className="animate-spin text-xs">⏳</span> : <Save className="w-3.5 h-3.5" />}
                       حفظ التغييرات
                    </Button>
                </div>
            </div>
         </CardContent>
      </Card>

    </div>
  );
}
