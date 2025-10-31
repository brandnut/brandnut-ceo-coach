import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/Providers";
import "@ant-design/v5-patch-for-react-19";

export const metadata: Metadata = {
  title: "中欧银发经济知识库",
  description: "基于 LLM 和知识库检索的回答",
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
