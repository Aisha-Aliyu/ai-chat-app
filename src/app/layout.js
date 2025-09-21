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

export const metadata = {
  metadataBase: new URL("https://AiChatApp.vercel.app"),
  title: "AI Chat App",
  description:
    "A modern AI-powered chat app with real-time messaging, AI assistance, and a sleek UI.",
  keywords: ["AI", "chat", "messaging", "real-time", "Next.js", "Firebase"],
  authors: [{ name: "Aisha Aliyu" }],
  creator: "Aisha Aliyu",
  publisher: "Aisha Aliyu",

  // OpenGraph
  openGraph: {
    title: "AI Chat App",
    description:
      "Chat in real-time with friends and AI — sleek, modern, and responsive.",
    url: "https://AiChatApp.vercel.app",
    siteName: "AI Chat App",
    images: [
      {
        url: "/android-chrome-512x512.png", // better than favicon for previews
        width: 1200,
        height: 630,
        alt: "AI Chat App Preview",
      },
    ],
    locale: "en_US",
    type: "website",
  },

  // ✅ Favicons & icons
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
    shortcut: "/favicon.ico",
  },

  manifest: "/public/site.webmanifest",

};

export const viewport = {
  themeColor: "#0f172a",
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}