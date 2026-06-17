import type { Metadata } from "next";
import "./globals.css";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Kravix AI Studio",
  description: "A polished AI Studio SaaS workspace powered by Supabase and Cloudflare R2.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={cn(
        "h-full",
        "antialiased",
        "font-sans"
      )}
    >
      <body className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}
