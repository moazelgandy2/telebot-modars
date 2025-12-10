import { getCourses } from "../actions/courses";
import { CoursesClient } from "@/components/courses-client";

export default async function CoursesPage() {
  const courses = await getCourses();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Courses</h1>
      </div>
      <CoursesClient initialCourses={courses} />
    </div>
  );
}
