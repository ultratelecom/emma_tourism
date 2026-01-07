import type { Metadata, Viewport } from "next";
import { Playfair_Display, Crimson_Pro, Geist_Mono } from "next/font/google";
import "./globals.css";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
});

const crimsonPro = Crimson_Pro({
  variable: "--font-serif",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf9f6" },
    { media: "(prefers-color-scheme: dark)", color: "#0f0f0f" },
  ],
};

export const metadata: Metadata = {
  title: "Ask THA | Your AI Legal Guide to the Tobago House of Assembly",
  description: "Get clear, accessible answers about the Tobago House of Assembly Act and its relationship with Trinidad. Understand THA powers, governance, and the Constitution in plain language.",
  keywords: [
    "Tobago House of Assembly",
    "THA Act 2021",
    "Trinidad and Tobago Constitution",
    "Tobago governance",
    "THA powers",
    "Chief Secretary Tobago",
    "Tobago autonomy",
    "Trinidad Tobago law",
    "Caribbean legal AI",
    "Tobago legislation"
  ],
  authors: [{ name: "NexxTelecom", url: "https://nexxtelecom.com" }],
  creator: "NexxTelecom",
  publisher: "NexxTelecom",
  applicationName: "Ask THA",
  generator: "Next.js",
  referrer: "origin-when-cross-origin",
  
  // Icons
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180" },
    ],
  },
  
  // Manifest for PWA
  manifest: "/manifest.json",
  
  // Open Graph
  openGraph: {
    type: "website",
    locale: "en_TT",
    url: "https://asktha.vercel.app",
    siteName: "Ask THA",
    title: "Ask THA | Your AI Legal Guide to the Tobago House of Assembly",
    description: "Get clear, accessible answers about the THA Act and Tobago's relationship with Trinidad. Understand governance powers in plain language.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Ask THA - AI Legal Guide to the Tobago House of Assembly",
      },
    ],
  },
  
  // Twitter Card
  twitter: {
    card: "summary_large_image",
    title: "Ask THA | AI Legal Guide to the Tobago House of Assembly",
    description: "Get clear answers about the THA Act and Tobago's governance. Understand the law in plain language.",
    images: ["/og-image.png"],
    creator: "@nexxtelecom",
  },
  
  // Robots
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  
  // Verification (add your actual verification codes if needed)
  // verification: {
  //   google: "your-google-verification-code",
  // },
  
  // Category
  category: "Legal",
  
  // Other
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="canonical" href="https://asktha.vercel.app" />
      </head>
      <body
        className={`${playfair.variable} ${crimsonPro.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
