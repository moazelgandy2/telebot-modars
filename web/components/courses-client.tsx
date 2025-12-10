"use client";

import { Course, deleteCourse } from "@/app/actions/courses";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Search, Edit, Trash2, MapPin, Globe, BookOpen } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";

interface CoursesClientProps {
  initialCourses: Course[];
}

export function CoursesClient({ initialCourses }: CoursesClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  // We can just rely on props if we want, but local state helps with immediate UI filter updates if we wanted to delete locally...
  // But since we navigate away for add/edit, we can just rely on router.refresh() or revalidating path which Delete action does.
  // Actually, delete action revalidates path. So we just need to wait for it.
  // But initialCourses won't update automatically without a refresh unless we use router.refresh().

  const [searchQuery, setSearchQuery] = useState("");

  const filteredCourses = initialCourses.filter(course =>
    course.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
    course.level.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = async (courseId: string) => {
    if (confirm("متأكد انك عايز تمسح الكورس ده؟ العملية دي مفيهاش رجعة.")) { // Are you sure?
      try {
         await deleteCourse(courseId);
         toast({
            title: "تم المسح", // Deleted
            description: "تم مسح الكورس بنجاح.", // Successfully deleted
         });
         // Since we are using filteredCourses derived from initialCourses,
         // we need to trigger a router refresh to fetch new server data?
         // Server action revalidatePath should update the cache, but client component needs to refetch?
         router.refresh();
      } catch (e) {
         toast({
            title: "خطأ", // Error
            description: "حصلت مشكلة وأحنا بنمسح الكورس.", // Problem deleting
            variant: "destructive"
         });
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground" /> {/* left to right for RTL input icon */}
          <Input
            type="search"
            placeholder="دور على كورس..." // Search for a course...
            className="pr-8 pl-3" // pl-8 to pr-8 for RTL
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Button onClick={() => router.push("/courses/new")}>
          <Plus className="ml-2 h-4 w-4" /> ضيف كورس {/* mr-2 to ml-2 */}
        </Button>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filteredCourses.map((course, index) => (
          <Card key={index} className="flex flex-col hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xl font-bold">{course.subject}</CardTitle>
              <Badge variant="outline">{course.level}</Badge>
            </CardHeader>
            <CardContent className="flex-1 space-y-3 pt-4">
               <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Globe className="h-4 w-4" />
                  <span className={course.online?.available ? "text-green-600 font-medium" : ""}>
                     {course.online?.available ? "متاح أونلاين" : "سنتر بس"} {/* Online Available : Center Only */}
                  </span>
               </div>
               {course.centers.length > 0 && (
                  <div className="flex items-start gap-2 text-sm text-muted-foreground">
                     <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                     <span>{course.centers.length} سنتر</span>
                  </div>
               )}
               {course.books && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                     <BookOpen className="h-4 w-4" />
                     <span>المذكرة: {course.books.name}</span>
                  </div>
               )}
            </CardContent>
            <CardFooter className="flex justify-between border-t p-4 bg-muted/20">
              <Button variant="ghost" size="sm" onClick={() => router.push(`/courses/${course.id}`)}>
                <Edit className="h-4 w-4 ml-2" /> تعديل {/* mr-2 to ml-2 */}
              </Button>
              <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => course.id && handleDelete(course.id)}>
                <Trash2 className="h-4 w-4 ml-2" /> مسح {/* mr-2 to ml-2 */}
              </Button>
            </CardFooter>
          </Card>
        ))}
        {filteredCourses.length === 0 && (
          <div className="col-span-full text-center p-12 text-muted-foreground border-2 border-dashed rounded-lg">
             <div className="flex flex-col items-center gap-2">
                <Search className="h-8 w-8 opacity-50" />
                <p>مفيش كورسات بالاسم ده.</p> {/* No courses found */}
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
