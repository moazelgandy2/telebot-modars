'use client';

import { ContactData, updateContactData } from "@/app/actions/contact";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Phone, Mail, Clock, Facebook, Instagram, MessageCircle, Save } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export function ContactClient({ initialContact }: { initialContact: ContactData }) {
  const [data, setData] = useState<ContactData>(initialContact);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await updateContactData(data);
    setLoading(false);
    toast({
       title: "تم الحفظ", // Changes Saved
       description: "تم تحديث بيانات التواصل بنجاح.", // Contact information has been updated successfully.
    });
  };

  const handleChange = (field: keyof ContactData, value: string) => {
    setData({ ...data, [field]: value });
  };

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
         <h2 className="text-2xl font-bold tracking-tight">بيانات التواصل</h2> {/* Contact Information */}
         <Button type="submit" disabled={loading}>
             <Save className="ml-2 h-4 w-4" /> {/* mr-2 -> ml-2 */}
             {loading ? "جاري الحفظ..." : "حفظ التغييرات"} {/* Saving... : Save Changes */}
         </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
         <Card>
            <CardHeader>
               <CardTitle className="flex items-center gap-2">
                  <Phone className="h-5 w-5" /> التواصل المباشر {/* Communication */}
               </CardTitle>
               <CardDescription>قنوات التواصل مع الطلبة.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>رقم التليفون</Label> {/* Phone Number */}
                <div className="relative">
                   <Phone className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground" /> {/* left -> right */}
                   <Input
                     className="pr-9 pl-3" // pl-9 -> pr-9, remove pl default or adjust
                     value={data.phone}
                     onChange={(e) => handleChange("phone", e.target.value)}
                     placeholder="+20 1xxxxxxxxx"
                   />
                </div>
              </div>
              <div className="space-y-2">
                <Label>واتساب</Label> {/* WhatsApp */}
                <div className="relative">
                   <MessageCircle className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                   <Input
                     className="pr-9 pl-3"
                     value={data.whatsapp}
                     onChange={(e) => handleChange("whatsapp", e.target.value)}
                     placeholder="+20 1xxxxxxxxx"
                   />
                </div>
              </div>
              <div className="space-y-2">
                <Label>البريد الإلكتروني</Label> {/* Email */}
                <div className="relative">
                   <Mail className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                   <Input
                     className="pr-9 pl-3"
                     value={data.email}
                     onChange={(e) => handleChange("email", e.target.value)}
                     placeholder="info@example.com"
                   />
                </div>
              </div>
            </CardContent>
         </Card>

         <div className="space-y-6">
            <Card>
               <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                     <Clock className="h-5 w-5" /> مواعيد العمل {/* Working Hours */}
                  </CardTitle>
               </CardHeader>
               <CardContent>
                  <div className="space-y-2">
                    <Label>المواعيد المتاحة</Label> {/* Availability */}
                    <Input
                      value={data.workingHours}
                      onChange={(e) => handleChange("workingHours", e.target.value)}
                      placeholder="مثلاً: يومياً من 10 ص لـ 10 م" // e.g. Daily 10 AM - 10 PM
                    />
                  </div>
               </CardContent>
            </Card>

            <Card>
               <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                     <Facebook className="h-5 w-5" /> السوشيال ميديا {/* Social Media */}
                  </CardTitle>
               </CardHeader>
               <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>رابط فيسبوك</Label> {/* Facebook URL */}
                    <div className="relative">
                       <Facebook className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                       <Input
                         className="pr-9 pl-3"
                         value={data.facebook}
                         onChange={(e) => handleChange("facebook", e.target.value)}
                         placeholder="https://facebook.com/..."
                       />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>رابط انستجرام</Label> {/* Instagram URL */}
                    <div className="relative">
                       <Instagram className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                       <Input
                         className="pr-9 pl-3"
                         value={data.instagram}
                         onChange={(e) => handleChange("instagram", e.target.value)}
                         placeholder="https://instagram.com/..."
                       />
                    </div>
                  </div>
               </CardContent>
            </Card>
         </div>
      </div>
    </form>
  );
}
