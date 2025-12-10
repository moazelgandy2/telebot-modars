"use client";

import { createCourse } from "@/app/actions/courses";
import { CourseForm } from "@/components/course-form";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";

export default function NewCoursePage() {
  const router = useRouter();
  const { toast } = useToast();

  const handleSave = async (courseData: any) => {
    try {
      await createCourse(courseData);
      toast({
        title: "تم إضافة الكورس", // Course Created
        description: "الكورس الجديد اتضاف بنجاح.", // Added successfully
      });
      router.push("/courses");
    } catch (error) {
      console.error(error);
      toast({
         title: "خطأ", // Error
         description: "فشل إضافة الكورس. حاول تاني.", // Failed. Try again.
         variant: "destructive"
      });
    }
  };

  return (
    <div className="container mx-auto py-10 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">إضافة كورس جديد</h1> {/* Create New Course */}
        <p className="text-muted-foreground mt-2">
          إملا البيانات دي عشان تضيف كورس جديد للنظام.
        </p>
      </div>

      <CourseForm
         onSave={handleSave}
         onCancel={() => router.push("/courses")}
      />
    </div>
  );
}
