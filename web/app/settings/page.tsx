'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Save, RefreshCw, Power, Users } from "lucide-react";
import { toast } from "sonner";

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    apiId: '',
    apiHash: '',
    stringSession: '',
    aiWorkStart: '',
    aiWorkEnd: '',
    botActive: true,
    replyTarget: 'all', // 'all' | 'subscribers'
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
            aiWorkStart: data.data.aiWorkStart || '',
            aiWorkEnd: data.data.aiWorkEnd || '',
            botActive: data.data.botActive !== 'false', // Default to true if missing or not 'false'
            replyTarget: data.data.replyTarget || 'all',
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
        body: JSON.stringify({
             ...settings,
             botActive: String(settings.botActive), // Convert to string for DB
             replyTarget: settings.replyTarget
        }),
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
            <div className="grid gap-6">

                {/* System Control Section */}
                <div className="bg-muted/30 rounded-xl border border-border/50 p-4 space-y-4">
                     <div className="flex items-center gap-2 mb-2">
                        <Power className="w-4 h-4 text-primary" />
                        <h3 className="text-sm font-semibold">تحكم النظام</h3>
                     </div>

                    <div className="grid gap-3 md:grid-cols-2">
                        {/* Bot Active Switch */}
                        <div className="flex items-center justify-between p-3 rounded-lg bg-background border border-border/40 shadow-sm">
                            <div className="space-y-0.5">
                                <label className="text-sm font-medium">حالة البوت</label>
                                <p className="text-xs text-muted-foreground">تفعيل أو إيقاف البوت كلياً</p>
                            </div>
                            <Switch
                                checked={settings.botActive}
                                onCheckedChange={(checked) => setSettings(s => ({ ...s, botActive: checked }))}
                            />
                        </div>

                        {/* Reply Target Switch */}
                        <div className="flex items-center justify-between p-3 rounded-lg bg-background border border-border/40 shadow-sm">
                            <div className="space-y-0.5">
                                <div className="flex items-center gap-1.5">
                                    <label className="text-sm font-medium">وضع المشتركين</label>
                                    <Users className="w-3 h-3 text-muted-foreground" />
                                </div>
                                <p className="text-xs text-muted-foreground">الرد فقط على المشتركين</p>
                            </div>
                            <Switch
                                checked={settings.replyTarget === 'subscribers'}
                                onCheckedChange={(checked) => setSettings(s => ({ ...s, replyTarget: checked ? 'subscribers' : 'all' }))}
                            />
                        </div>
                    </div>
                </div>

                {/* Credentials Group */}
                <div className="space-y-3">
                    <h3 className="text-md font-semibold text-foreground/90 px-1">بيانات الاتصال</h3>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground ml-1">معرف التطبيق (App ID)</label>
                            <Input
                                name="apiId"
                                value={settings.apiId}
                                onChange={handleChange}
                                placeholder="123456"
                                className="h-9 font-mono text-sm bg-muted/50 border-border/50 focus:border-primary/50 focus:ring-0 transition-all text-left dir-ltr"
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
                                className="h-9 font-mono text-sm bg-muted/50 border-border/50 focus:border-primary/50 focus:ring-0 transition-all text-left dir-ltr"
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
                            className="h-9 font-mono text-sm bg-muted/50 border-border/50 focus:border-primary/50 focus:ring-0 transition-all text-left dir-ltr"
                            style={{ direction: 'ltr' }}
                        />
                    </div>
                </div>

                {/* AI Working Hours */}
                <div className="border-t border-border/40 pt-4 mt-2">
                    <h3 className="text-sm font-semibold mb-3">🕒 ساعات العمل (توقيت مصر)</h3>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground ml-1">بداية العمل</label>
                            <Input
                                name="aiWorkStart"
                                value={settings.aiWorkStart}
                                onChange={handleChange}
                                placeholder="08:00"
                                className="h-9 font-mono text-sm bg-muted/50 border-border/50 focus:border-primary/50 focus:ring-0 transition-all text-left dir-ltr"
                                style={{ direction: 'ltr' }}
                            />
                            <p className="text-[10px] text-muted-foreground">صيغة 24 ساعة (مثال: 08:00)</p>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground ml-1">نهاية العمل</label>
                            <Input
                                name="aiWorkEnd"
                                value={settings.aiWorkEnd}
                                onChange={handleChange}
                                placeholder="23:00"
                                className="h-9 font-mono text-sm bg-muted/50 border-border/50 focus:border-primary/50 focus:ring-0 transition-all text-left dir-ltr"
                                style={{ direction: 'ltr' }}
                            />
                            <p className="text-[10px] text-muted-foreground">صيغة 24 ساعة (مثال: 23:00)</p>
                        </div>
                    </div>
                </div>

                {/* Actions Footer within Card */}
                <div className="pt-2 flex justify-end">
                    <Button
                        onClick={handleSave}
                        disabled={saving}
                        size="sm"
                        className="gap-2 min-w-[100px] h-9 transition-all hover:scale-[1.02] active:scale-[0.98]"
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
