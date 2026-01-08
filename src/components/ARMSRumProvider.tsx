'use client'

import { useEffect } from 'react'
import Script from 'next/script'

export default function ARMSRumProvider() {
  // Only load in production
  if (process.env.NODE_ENV !== 'production') {
    return null
  }

  return (
    <>
      <Script id="arms-rum-init" strategy="beforeInteractive">
        {`
          !(function(c,b,d,a){
            c[a]||(c[a]={});
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
            }
            with(b)with(body)with(insertBefore(createElement("script"),firstChild))setAttribute("crossorigin","",src=d)
          })(window, document, "https://sdk.rum.aliyuncs.com/v2/browser-sdk.js", "__rum");
        `}
      </Script>
    </>
  )
}
