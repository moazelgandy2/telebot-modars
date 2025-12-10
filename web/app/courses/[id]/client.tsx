"use client";

import { Course, updateCourse } from "@/app/actions/courses";
import { CourseForm } from "@/components/course-form";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";

export default function EditCourseClient({ course }: { course: Course }) {
  const router = useRouter();
  const { toast } = useToast();

  const handleSave = async (updatedCourse: Course) => {
    try {
      await updateCourse(updatedCourse);
      toast({
        title: "تم تحديث الكورس", // Course Updated
        description: "تم حفظ التعديلات بنجاح.", // Changes saved successfully
      });
      router.push("/courses");
      router.refresh();
    } catch (error) {
      console.error(error);
      toast({
         title: "خطأ", // Error
         description: "حصلت مشكلة في التحديث.", // Problem updating
         variant: "destructive"
      });
    }
  };

  return (
    <div className="container mx-auto py-10 max-w-5xl">
       <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">تعديل الكورس</h1> {/* Edit Course */}
        <p className="text-muted-foreground mt-2">
          أنت بتعدل في كورس <strong>{course.subject}</strong> - {course.level}.
        </p>
      </div>

      <CourseForm
        initialData={course}
        onSave={handleSave}
        onCancel={() => router.push("/courses")}
      />
    </div>
  );
}
