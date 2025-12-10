"use client";

import { Course } from "@/app/actions/courses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useState } from "react";
import { Plus, Trash2, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TagInput } from "@/components/ui/tag-input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

interface CourseFormProps {
  initialData?: Course;
  onSave: (course: Course) => void;
  onCancel: () => void;
}

const emptyCourse = {
  id: "",
  subject: "",
  level: "",
  teacher: "",
  online: {
    id: "",
    available: false,
    times: [],
    price: "",
    platform: "",
    courseId: ""
  },
  centers: [],
  books: {
    id: "",
    name: "",
    price: "",
    courseId: ""
  },
  createdAt: new Date(),
  updatedAt: new Date()
} as unknown as Course;

export function CourseForm({ initialData, onSave, onCancel }: CourseFormProps) {
  const [formData, setFormData] = useState<Course>(
    initialData ? JSON.parse(JSON.stringify(initialData)) : emptyCourse
  );
  const [activeTab, setActiveTab] = useState("general");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const updateOnline = (field: string, value: any) => {
    setFormData({
      ...formData,
      online: formData.online ?
        { ...formData.online, [field]: value } :
        { available: false, times: [], price: "", platform: "", id: "", courseId: "", [field]: value } as any,
    });
  };

  const addCenter = () => {
    setFormData({
      ...formData,
      centers: [...formData.centers, {
        name: "", location: "", times: [], price: "", mapsLink: "",
        id: "", courseId: ""
      } as any],
    });
  };

  const removeCenter = (index: number) => {
    const newCenters = [...formData.centers];
    newCenters.splice(index, 1);
    setFormData({ ...formData, centers: newCenters });
  };

  const updateCenter = (index: number, field: string, value: any) => {
    const newCenters = [...formData.centers];
    newCenters[index] = { ...newCenters[index], [field]: value };
    setFormData({ ...formData, centers: newCenters });
  };

  const updateBook = (field: string, value: any) => {
    setFormData({
      ...formData,
      books: formData.books ?
        { ...formData.books, [field]: value } :
        { name: "", price: "", id: "", courseId: "", [field]: value } as any
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-5xl mx-auto pb-10">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:w-[600px] lg:mx-auto mb-8">
          <TabsTrigger value="general">بيانات أساسية</TabsTrigger> {/* General -> بيانات أساسية */}
          <TabsTrigger value="online">أونلاين</TabsTrigger> {/* Online -> أونلاين */}
          <TabsTrigger value="centers">سناتر</TabsTrigger> {/* Centers -> سناتر */}
          <TabsTrigger value="book">ملازم</TabsTrigger> {/* Book -> ملازم (Notes/Books) */}
        </TabsList>

        <TabsContent value="general" className="space-y-6 animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
          <Alert className="bg-muted/50 border-primary/20">
            <Info className="h-4 w-4 text-primary" />
            <AlertTitle>أبدا من هنا</AlertTitle> {/* First Step/Start Here */}
            <AlertDescription>
              دخل البيانات الأساسية للكورس زي <strong>اسم المادة</strong> و <strong>الصف الدراسي</strong>.
            </AlertDescription>
          </Alert>
          <Card>
            <CardHeader>
              <CardTitle>معلومات أساسية</CardTitle>
              <CardDescription>
                هنا بتحدد هوية الكورس والمرحلة الدراسية.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <Label className="text-base">اسم المادة <span className="text-destructive">*</span></Label>
                  <Input
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    required
                    placeholder="مثلاً: فيزياء (physics)"
                    className="h-11"
                  />
                  <p className="text-[0.8rem] text-muted-foreground">اسم المادة اللي الطالب هيدور بيها.</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-base">الصف الدراسي <span className="text-destructive">*</span></Label>
                  <Input
                    value={formData.level}
                    onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                    required
                    placeholder="مثلاً: الصف الأول الثانوي"
                    className="h-11"
                  />
                  <p className="text-[0.8rem] text-muted-foreground">الكورس ده موجه لمين؟ (مثلاً: تالتة ثانوي، جامعة).</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <div className="flex justify-end">
             <Button type="button" onClick={() => setActiveTab("online")}>الخطوة الجاية</Button> {/* Next Step */}
          </div>
        </TabsContent>

        <TabsContent value="online" className="space-y-6 animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
           <Alert variant={formData.online?.available ? "default" : "destructive"} className={cn("transition-colors", formData.online?.available ? "bg-green-500/10 border-green-500/50" : "")}>
            <Info className={cn("h-4 w-4", formData.online?.available ? "text-green-600" : "")} />
            <AlertTitle>{formData.online?.available ? "الأونلاين شغال" : "الأونلاين مقفول"}</AlertTitle>
            <AlertDescription>
              {formData.online?.available
                ? "الكورس ده متاح أونلاين، والطلبة هتقدر تشوف سعره ومواعيده."
                : "الكورس ده مش متاح أونلاين حالياً. لو عايز تفعله، شغل الزرار اللي تحت."}
            </AlertDescription>
          </Alert>

          <Card>
             <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 border-b mb-4">
              <div className="space-y-1">
                <CardTitle>تفاصيل الأونلاين</CardTitle>
                <CardDescription>الأسعار والمنصة والمواعيد.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                 <Label htmlFor="online-mode" className="cursor-pointer">تفعيل الأونلاين؟</Label>
                 <Switch
                   id="online-mode"
                   checked={formData.online?.available || false}
                   onCheckedChange={(checked) => updateOnline("available", checked)}
                 />
              </div>
            </CardHeader>
            <CardContent>
              {formData.online?.available ? (
                <div className="grid gap-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <Label>سعر الشهر</Label>
                      <Input
                        value={formData.online?.price || ""}
                        onChange={(e) => updateOnline("price", e.target.value)}
                        placeholder="مثلاً: 150 جنيه/شهر"
                      />
                    </div>
                    <div className="space-y-2">
                       <Label>المنصة</Label>
                       <Input
                          value={formData.online?.platform || ""}
                          onChange={(e) => updateOnline("platform", e.target.value)}
                          placeholder="مثلاً: Zoom, Google Meet"
                       />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Label>مواعيد الحصص (Live)</Label>
                    <TagInput
                      value={formData.online?.times || []}
                      onChange={(tags) => updateOnline("times", tags)}
                      placeholder="اكتب الميعاد واضغط Enter (مثلاً: سبت 5 م)"
                    />
                    <p className="text-[0.8rem] text-muted-foreground">
                      ممكن تضيف أكتر من ميعاد. اضغط Enter بعد كل واحد.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground opacity-60">
                  <div className="mb-2 text-4xl">💻</div>
                  <p>تفاصيل الأونلاين مخفية عشان أنت لاغي التفعيل.</p>
                </div>
              )}
            </CardContent>
          </Card>
          <div className="flex justify-between">
             <Button type="button" variant="ghost" onClick={() => setActiveTab("general")}>رجوع</Button>
             <Button type="button" onClick={() => setActiveTab("centers")}>الخطوة الجاية</Button>
          </div>
        </TabsContent>

        <TabsContent value="centers" className="space-y-6 animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
          <Alert className="bg-blue-500/10 border-blue-500/20">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertTitle>السناتر والفروع</AlertTitle>
            <AlertDescription>
              ضيف هنا كل السناتر اللي بتدي فيها الكورس ده. ممكن تضيف أكتر من سنتر.
            </AlertDescription>
          </Alert>

          <div className="flex justify-end">
            <Button type="button" onClick={addCenter}>
              <Plus className="ml-2 h-4 w-4" /> ضيف سنتر جديد {/* mr-2 to ml-2 */}
            </Button>
          </div>

          <div className="grid gap-6">
             {formData.centers.length === 0 && (
                <div className="text-center p-12 text-muted-foreground bg-muted/30 rounded-lg border-2 border-dashed">
                   <div className="text-4xl mb-4">🏢</div>
                   <p className="font-medium text-lg">لسه مفيش ولا سنتر.</p>
                   <p className="text-sm text-muted-foreground mb-4">هل الكورس ده بيتشرح في سنتر؟</p>
                   <Button variant="outline" onClick={addCenter}>ضيف أول سنتر</Button>
                </div>
             )}
            {formData.centers.map((center, index) => (
              <Card key={index} className="relative overflow-hidden border-r-4 border-r-primary shadow-sm hover:shadow-md transition-shadow"> {/* border-l -> border-r for RTL aesthetics if using logical properties or just mirroring visually. */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 left-2 text-destructive hover:bg-destructive/10" // right-2 -> left-2
                  onClick={() => removeCenter(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <CardHeader className="bg-muted/10 pb-4">
                   <CardTitle className="text-lg">سنتر #{index + 1}</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-6 pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>اسم السنتر</Label>
                      <Input
                        value={center.name}
                        onChange={(e) => updateCenter(index, "name", e.target.value)}
                        placeholder="مثلاً: سنتر النور"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>سعر الحصة/الشهر</Label>
                      <Input
                        value={center.price}
                        onChange={(e) => updateCenter(index, "price", e.target.value)}
                        placeholder="مثلاً: 50 جنيه/حصة"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-6">
                     <div className="space-y-2">
                        <Label>العنوان / المكان</Label>
                        <Input
                          value={center.location}
                          onChange={(e) => updateCenter(index, "location", e.target.value)}
                          placeholder="وصف مختصر للمكان أو العنوان بالتفصيل"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>لينك جوجل ماب (مهم)</Label>
                        <Input
                          value={center.mapsLink || ""}
                          onChange={(e) => updateCenter(index, "mapsLink", e.target.value)}
                          placeholder="https://maps.google.com/..."
                        />
                         <p className="text-[0.8rem] text-muted-foreground">حط اللينك عشان الطالب يوصل للمكان بسهولة.</p>
                      </div>
                  </div>
                  <div className="space-y-3">
                    <Label>المواعيد</Label>
                     <TagInput
                        value={center.times}
                        onChange={(tags) => updateCenter(index, "times", tags)}
                        placeholder="ضيف المواعيد..."
                     />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="flex justify-between mt-8">
             <Button type="button" variant="ghost" onClick={() => setActiveTab("online")}>رجوع</Button>
             <Button type="button" onClick={() => setActiveTab("book")}>الخطوة الجاية</Button>
          </div>
        </TabsContent>

        <TabsContent value="book" className="space-y-6 animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
           <Alert className="bg-amber-500/10 border-amber-500/20">
            <Info className="h-4 w-4 text-amber-600" />
            <AlertTitle>الملازم / الكتاب</AlertTitle>
            <AlertDescription>
              هل في كتاب معين أو مذكرة الطالب محتاج يشتريها؟ ضيف تفاصيلها هنا.
            </AlertDescription>
          </Alert>

           <Card>
              <CardHeader>
                 <CardTitle>تفاصيل المذكرة</CardTitle>
                 <CardDescription>اسم الكتاب وسعره.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                       <Label>اسم المذكرة</Label>
                       <Input
                          value={formData.books?.name || ""}
                          onChange={(e) => updateBook("name", e.target.value)}
                          placeholder="مثلاً: مذكرة المراجعة النهائية"
                       />
                    </div>
                    <div className="space-y-2">
                       <Label>السعر</Label>
                       <Input
                          value={formData.books?.price || ""}
                          onChange={(e) => updateBook("price", e.target.value)}
                          placeholder="مثلاً: 100 جنيه"
                       />
                    </div>
                 </div>
              </CardContent>
           </Card>

           <div className="flex justify-between items-center pt-6 border-t mt-8">
             <Button type="button" variant="ghost" onClick={() => setActiveTab("centers")}>رجوع</Button>
             <div className="flex gap-4">
                <Button type="button" variant="outline" size="lg" onClick={onCancel}>إلغاء</Button>
                <Button type="submit" size="lg" className="min-w-[150px]">حفظ الكورس</Button>
             </div>
           </div>
        </TabsContent>
      </Tabs>
    </form>
  );
}
