import type { Metadata } from "next";
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
