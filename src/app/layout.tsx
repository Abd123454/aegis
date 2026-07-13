import type { Metadata } from "next";
import { Geist, Geist_Mono, Cairo, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const cairo = Cairo({ variable: "--font-cairo", subsets: ["arabic", "latin"], display: "swap" });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Aegis — لغة برمجة مبنية للأمن بالأساس",
  description:
    "تصميم كامل للغة برمجة جديدة اسمها Aegis: أمن بالأساس، سهولة تعلّم، وقوة شاملة. مع مفسّر حقيقي يعمل وساحة تفاعلية.",
  keywords: ["Aegis", "programming language", "security", "أمن", "لغة برمجة", "type safety", "capability security"],
  authors: [{ name: "Aegis Design" }],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${cairo.variable} ${jetbrains.variable} antialiased bg-background text-foreground font-cairo`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
