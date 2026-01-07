import type { Metadata, Viewport } from "next";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#ff6b6b",
};

export const metadata: Metadata = {
  title: "Emma | Your Tobago Welcome Buddy 🌴",
  description: "Chat with Emma, your personal Tobago tourism concierge! Share your travel experience and help us make Tobago even better for future visitors.",
  keywords: [
    "Tobago",
    "Tourism",
    "Travel Survey",
    "Emma",
    "Tobago Concierge",
    "Caribbean",
    "Travel Experience",
    "Visitor Feedback",
    "Tobago Tourism"
  ],
  applicationName: "Emma - Tobago Tourism",
  openGraph: {
    type: "website",
    locale: "en_TT",
    title: "Emma | Your Tobago Welcome Buddy 🌴",
    description: "Chat with Emma and share your Tobago travel experience!",
    siteName: "Emma - Tobago Tourism",
  },
  twitter: {
    card: "summary_large_image",
    title: "Emma | Your Tobago Welcome Buddy 🌴",
    description: "Chat with Emma and share your Tobago travel experience!",
  },
};

export default function EmmaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

