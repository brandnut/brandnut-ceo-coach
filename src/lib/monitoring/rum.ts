import armsRum from '@arms/rum-browser'

// Initialize ARMS RUM (Real User Monitoring)
try {
  armsRum.init({
    endpoint:
      'https://proj-xtrace-1ffb471ca0fe8cdf3e753be2e5750-cn-hangzhou.cn-hangzhou.log.aliyuncs.com/rum/web/v2?workspace=default-cms-1134355607688774-cn-hangzhou&service_id=b63frsmgqu@a1f015d557b4f0ccdcf77',
    // Set environment (ARMS accepts: 'prod' | 'pre' | 'gray' | 'daily' | 'local')
    env: process.env.NODE_ENV === 'production' ? 'prod' : 'local',
    // Set SPA routing mode
    spaMode: 'history',
    collectors: {
      // Page performance monitoring
      perf: true,
      // WebVitals monitoring
      webVitals: true,
      // API monitoring
      api: true,
      // Static resource monitoring
      staticResource: true,
      // JavaScript error monitoring
      jsError: true,
      // Console error monitoring
      consoleError: true,
      // User behavior monitoring
      action: true,
    },
    // Enable distributed tracing
    tracing: true,
  })
  console.log('[ARMS RUM] Initialized successfully')
} catch (error) {
  console.error('[ARMS RUM] Initialization failed:', error)
}

export default armsRum
