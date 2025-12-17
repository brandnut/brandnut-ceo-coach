import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "@/components/Providers";
import "@ant-design/v5-patch-for-react-19";
import { appInfo } from "@/config/app";

export const metadata: Metadata = {
  title: appInfo.title,
  description: appInfo.description,
  icons: {
    icon: '/favicon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
