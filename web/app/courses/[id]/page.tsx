import { getCourse } from "@/app/actions/courses";
import { notFound } from "next/navigation";
import EditCourseClient from "./client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditCoursePage({ params }: PageProps) {
  const { id } = await params;
  const course = await getCourse(id);

  if (!course) {
    notFound();
  }

  return <EditCourseClient course={course} />;
}
