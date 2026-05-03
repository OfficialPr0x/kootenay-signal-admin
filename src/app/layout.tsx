import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kootenay Signal Admin",
  description: "Admin dashboard for Kootenay Signal agency",
  icons: {
    icon: "https://res.cloudinary.com/doajstql7/image/upload/v1777003162/f3d21215-ada9-4ea3-b86d-510a6885c8f5-removebg-preview_uat1ay.png",
    shortcut: "https://res.cloudinary.com/doajstql7/image/upload/v1777003162/f3d21215-ada9-4ea3-b86d-510a6885c8f5-removebg-preview_uat1ay.png",
    apple: "https://res.cloudinary.com/doajstql7/image/upload/v1777003162/f3d21215-ada9-4ea3-b86d-510a6885c8f5-removebg-preview_uat1ay.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full bg-background text-foreground">{children}</body>
    </html>
  );
}
