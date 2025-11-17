import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/Providers";
import "@ant-design/v5-patch-for-react-19";
import { appInfo } from "@/config/app";
import { getAssetUrl } from "@/lib/utils";

export const metadata: Metadata = {
  title: appInfo.title,
  description: appInfo.description,
  icons: {
    icon: getAssetUrl("/favicon.png"),
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
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
