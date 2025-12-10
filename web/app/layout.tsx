import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";
import AdminLayout from "@/components/admin-layout";
import { Toaster } from "@/components/ui/toaster";

const cairo = Cairo({
  subsets: ["arabic"],
  variable: "--font-cairo",
});

export const metadata: Metadata = {
  title: "لوحة تحكم تلي بوت",
  description: "نظام إدارة محتوى البوت",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body
        className={`${cairo.className} antialiased`}
      >
        <AdminLayout>{children}</AdminLayout>
        <Toaster />
      </body>
    </html>
  );
}
