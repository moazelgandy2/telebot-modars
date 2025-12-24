export const dynamic = "force-dynamic";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MessageSquare, Settings, Users, Activity, FileText, Lock, Megaphone } from "lucide-react";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function Dashboard() {
  const sessionsCount = await prisma.chatSession.count();
  const instructionsCount = await prisma.systemInstruction.count();
  const messagesCount = await prisma.chatMessage.count();

  return (
    <div className="container max-w-5xl py-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
         <div className="space-y-1">
             <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-primary via-blue-600 to-purple-600 bg-clip-text text-transparent pb-1">
                 تيم تالته ثانوي Bot
             </h1>
             <p className="text-muted-foreground text-lg">
                 نظرة عامة على أداء البوت والمحادثات النشطة.
             </p>
         </div>
         <div className="flex gap-2">
             <Link href="/settings">
                <Button variant="outline" className="gap-2">
                    <Settings className="w-4 h-4" />
                    الإعدادات
                </Button>
             </Link>
         </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Active Sessions */}
        <Card className="border-muted/40 shadow-sm bg-card/60 backdrop-blur-sm hover:bg-card/80 transition-all group">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-primary transition-colors">
              المحادثات النشطة
            </CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{sessionsCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              مستخدم تواصل مع البوت
            </p>
          </CardContent>
        </Card>

        {/* Total Messages */}
        <Card className="border-muted/40 shadow-sm bg-card/60 backdrop-blur-sm hover:bg-card/80 transition-all group">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-primary transition-colors">
              إجمالي الرسائل
            </CardTitle>
            <MessageSquare className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{messagesCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              رسالة تم تبادلها
            </p>
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card className="border-muted/40 shadow-sm bg-card/60 backdrop-blur-sm hover:bg-card/80 transition-all group">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-primary transition-colors">
              توجيهات النظام
            </CardTitle>
            <FileText className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{instructionsCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              نسخ محفوظة من الأوامر
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Link href="/system-instruction" className="block h-full">
            <Card className="h-full border-muted/40 shadow-sm hover:shadow-md hover:border-primary/30 transition-all bg-gradient-to-br from-card to-muted/20 cursor-pointer group">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 group-hover:text-primary transition-colors">
                        <FileText className="w-5 h-5 text-purple-500" />
                        تعديل تعليمات البوت
                    </CardTitle>
                    <CardDescription>
                        تحكم في شخصية البوت، طريقة رده، وما يجب أن يقوله.
                    </CardDescription>
                </CardHeader>
            </Card>
          </Link>

          <Link href="/settings" className="block h-full">
            <Card className="h-full border-muted/40 shadow-sm hover:shadow-md hover:border-primary/30 transition-all bg-gradient-to-br from-card to-muted/20 cursor-pointer group">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 group-hover:text-primary transition-colors">
                        <Lock className="w-5 h-5 text-blue-500" />
                        الإعدادات والربط
                    </CardTitle>
                    <CardDescription>
                        إدارة مفاتيح API، جلسات الاتصال، وإعادة تشغيل النظام.
                    </CardDescription>
                </CardHeader>
            </Card>
          </Link>

          <Link href="/admin/subscriptions" className="block h-full">
            <Card className="h-full border-muted/40 shadow-sm hover:shadow-md hover:border-primary/30 transition-all bg-gradient-to-br from-card to-muted/20 cursor-pointer group">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 group-hover:text-primary transition-colors">
                        <Users className="w-5 h-5 text-green-500" />
                        إدارة المشتركين
                    </CardTitle>
                    <CardDescription>
                        إضافة وإزالة المشتركين في نظام المتابعة.
                    </CardDescription>
                </CardHeader>
            </Card>
          </Link>

          <Link href="/admin/broadcast" className="block h-full">
            <Card className="h-full border-muted/40 shadow-sm hover:shadow-md hover:border-primary/30 transition-all bg-gradient-to-br from-card to-muted/20 cursor-pointer group">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 group-hover:text-primary transition-colors">
                        <Megaphone className="w-5 h-5 text-orange-500" />
                        نظام الإذاعة
                    </CardTitle>
                    <CardDescription>
                        إرسال رسائل لجميع المشتركين النشطين.
                    </CardDescription>
                </CardHeader>
            </Card>
          </Link>
      </div>
    </div>
  );
}
