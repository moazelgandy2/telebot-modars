export const dynamic = "force-dynamic";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCourses } from "./actions/courses";
import { getFaqs } from "./actions/faqs";
import { BookOpen, HelpCircle } from "lucide-react";

export default async function Dashboard() {
  const courses = await getCourses();
  const faqs = await getFaqs();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">نظرة عامة</h1>{" "}
      {/* Dashboard -> نظرة عامة (Overview) */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              إجمالي الكورسات
            </CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{courses.length}</div>
            <p className="text-xs text-muted-foreground">
              عدد الكورسات الموجودة حالياً
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              الأسئلة الشائعة
            </CardTitle>
            <HelpCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{faqs.length}</div>
            <p className="text-xs text-muted-foreground">سؤال وجواب للبوت</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
