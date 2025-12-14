import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";
import AdminLayout from "@/components/admin-layout";
import { Toaster } from "sonner";

const cairo = Cairo({
  subsets: ["arabic"],
  variable: "--font-cairo",
});

export const metadata: Metadata = {
  title: "لوحة تحكم بوت",
  description: "نظام إدارة بوت",
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
        <Toaster position="top-center"/>
      </body>
    </html>
  );
}
