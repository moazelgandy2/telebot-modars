"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Megaphone, Send, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { sendBroadcast } from "@/app/actions/broadcast";
import Link from "next/link";
import { useState } from "react";

export default function BroadcastPage() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; data?: any; error?: string } | null>(null);

  const handleSend = async () => {
    if (!message.trim()) return;

    setLoading(true);
    setResult(null);

    const res = await sendBroadcast(message);
    setResult(res);
    setLoading(false);
  };

  return (
    <div className="container max-w-3xl py-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8">
        <Link href="/" className="text-muted-foreground hover:text-primary transition-colors mb-4 block">
            &larr; رجوع للرئيسية
        </Link>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Megaphone className="w-8 h-8 text-orange-500" />
          نظام الإذاعة
        </h1>
        <p className="text-muted-foreground mt-2 text-lg">
          إرسال رسائل لجميع المشتركين النشطين في البوت.
        </p>
      </div>

      <Card className="border-muted/40 shadow-md">
        <CardHeader>
          <CardTitle>رسالة جديدة</CardTitle>
          <CardDescription>
            اكتب الرسالة التي تريد إرسالها. ستصل لكل المشتركين فوراً.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="اكتب رسالتك هنا..."
            className="min-h-[200px] text-lg resize-none"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={loading}
          />

            {result && (
                <div className={`p-4 rounded-lg flex items-start gap-3 ${result.success ? "bg-green-500/10 text-green-700 dark:text-green-300 border border-green-500/20" : "bg-red-500/10 text-red-700 dark:text-red-300 border border-red-500/20"}`}>
                    {result.success ? (
                        <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0" />
                    ) : (
                        <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
                    )}
                    <div className="space-y-1">
                        <p className="font-semibold">
                            {result.success ? "تم الإرسال بنجاح!" : "فشل الإرسال"}
                        </p>
                        {result.success && result.data && (
                            <div className="text-sm opacity-90">
                                <p>🎯 المستهدفين: {result.data.total}</p>
                                <p>📨 وصل لـ: {result.data.sent}</p>
                                <p>❌ فشل مع: {result.data.failed}</p>
                            </div>
                        )}
                        {!result.success && (
                            <p className="text-sm">{result.error}</p>
                        )}
                    </div>
                </div>
            )}

        </CardContent>
        <CardFooter className="justify-between border-t bg-muted/20 p-6">
            <div className="text-sm text-muted-foreground">
                ⚠️ تأكد من محتوى الرسالة قبل الإرسال.
            </div>
            <Button
                size="lg"
                onClick={handleSend}
                className="gap-2 bg-orange-600 hover:bg-orange-700 text-white"
                disabled={loading || !message.trim()}
            >
                {loading ? (
                    <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        جاري الإرسال...
                    </>
                ) : (
                    <>
                        <Send className="w-4 h-4" />
                        إرسال الآن
                    </>
                )}
            </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
