export const dynamic = "force-dynamic";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Settings } from "lucide-react";
import { prisma } from "@/lib/db";

export default async function Dashboard() {
  const sessionsCount = await prisma.chatSession.count();
  const instructionsCount = await prisma.systemInstruction.count();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">نظرة عامة</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              المحادثات النشطة
            </CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sessionsCount}</div>
            <p className="text-xs text-muted-foreground">
              عدد المستخدمين الذين تواصلوا مع البوت
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              توجيهات النظام
            </CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{instructionsCount}</div>
            <p className="text-xs text-muted-foreground">نسخ التعليمات المحفوظة</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
