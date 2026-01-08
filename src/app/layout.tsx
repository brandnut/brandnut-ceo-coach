import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "@/components/Providers";
import "@ant-design/v5-patch-for-react-19";
import { appInfo } from "@/config/app";
import { getAssetUrl } from "@/lib/utils";
import Script from "next/script";

export const metadata: Metadata = {
  title: appInfo.title,
  description: appInfo.description,
  icons: {
    icon: getAssetUrl("/favicon.png"),
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isProduction = process.env.NODE_ENV === "production";

  return (
    <html lang="en">
      <head>
        {/* ARMS RUM - Only in production */}
        {isProduction && (
          <Script id="arms-rum-init" strategy="beforeInteractive">
            {`
              !(function(c,b,d,a){
                c[a] = c[a] || {};
                c[a] = {
                  endpoint: 'https://proj-xtrace-1ffb471ca0fe8cdf3e753be2e5750-cn-hangzhou.cn-hangzhou.log.aliyuncs.com/rum/web/v2?workspace=default-cms-1134355607688774-cn-hangzhou&service_id=b63frsmgqu@a1f015d557b4f0ccdcf77',
                  env: 'prod',
                  spaMode: 'history',
                  collectors: {
                    perf: true,
                    webVitals: true,
                    api: true,
                    staticResource: true,
                    jsError: true,
                    consoleError: true,
                    action: true,
                  },
                  tracing: false,
                };
                with(b)with(body)with(insertBefore(createElement("script"),firstChild))
                  setAttribute("crossorigin","",src=d)
              })(window, document, "https://sdk.rum.aliyuncs.com/v2/browser-sdk.js", "__rum");
            `}
          </Script>
        )}
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
