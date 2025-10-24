import { Streamdown } from 'streamdown'
import { useRef, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

interface CustomStreamdownProps {
  children: string
}

export default function CustomStreamdown({ children }: CustomStreamdownProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [svgContent, setSvgContent] = useState('')

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const addEnhancements = (block: Element) => {
      // Check if already added
      if (block.querySelector('[data-zoom-button]')) return

      // Find controls container
      const controls = block.querySelector('.flex.items-center')
      if (!controls) return

      // Find existing buttons
      const existingBtn = controls.querySelector('button')
      if (!existingBtn) return

      // Find the download button by title
      const downloadBtn = Array.from(controls.querySelectorAll('button')).find(
        (btn) => btn.getAttribute('title')?.toLowerCase().includes('download')
      )
      if (!downloadBtn) return

      // Replace download button with dropdown
      const dropdownWrapper = document.createElement('div')
      dropdownWrapper.className = 'relative'
      dropdownWrapper.setAttribute('data-mermaid-dropdown', 'true')

      const dropdownMenu = document.createElement('div')
      dropdownMenu.className = 'absolute top-full right-0 z-10 mt-1 min-w-[120px] rounded-md border border-border bg-background shadow-lg hidden'

      // Store the code
      let mermaidCode = ''

      // Capture code by intercepting Streamdown's download
      const captureCodeFromDownloadButton = () => {
        const originalDownloadBtn = block.querySelector('button[title="Download file"]') as HTMLButtonElement
        if (!originalDownloadBtn) {
          console.log('[captureCode] Download button not found')
          return
        }

        // Intercept createElement to capture the download link
        const originalCreateElement = document.createElement.bind(document)
        let intercepting = true

        document.createElement = function(tagName: string) {
          const element = originalCreateElement(tagName)

          if (intercepting && tagName.toLowerCase() === 'a') {
            // Intercept the <a> element created for download
            const originalClick = element.click.bind(element)
            element.click = function() {
              // Get the href which should be a blob URL
              const href = element.getAttribute('href')
              if (href && href.startsWith('blob:')) {
                // Fetch the blob content
                fetch(href)
                  .then(r => r.text())
                  .then(text => {
                    mermaidCode = text
                    console.log('[captureCode] Captured code length:', text.length)
                  })
                  .catch(err => console.error('[captureCode] Error:', err))
              }
              // Don't actually trigger the download
              return
            }
          }

          return element
        }

        // Trigger the download button
        originalDownloadBtn.click()

        // Restore createElement after a tick
        setTimeout(() => {
          document.createElement = originalCreateElement
          intercepting = false
        }, 100)
      }

      // Get the mermaid code
      const getMermaidCode = () => {
        return mermaidCode
      }

      // Capture the code immediately
      captureCodeFromDownloadButton()

      // Download as image function
      const downloadAsImage = async (format: 'png' | 'jpeg') => {
        console.log('[downloadAsImage] Starting download as', format)

        const chartDiv = block.querySelector('[aria-label="Mermaid chart"]')
        const svg = chartDiv?.querySelector('svg')

        if (!svg) {
          console.error('[downloadAsImage] No SVG found!')
          return
        }

        try {
          // Clone SVG to avoid modifying the original
          const svgClone = svg.cloneNode(true) as SVGElement

          // Get dimensions
          const bbox = svg.getBoundingClientRect()
          const width = bbox.width
          const height = bbox.height

          // Set explicit dimensions on clone
          svgClone.setAttribute('width', width.toString())
          svgClone.setAttribute('height', height.toString())

          // Serialize SVG to string
          const svgData = new XMLSerializer().serializeToString(svgClone)

          // Create data URL with proper encoding
          const svgDataUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)))

          // Create canvas
          const canvas = document.createElement('canvas')
          const scale = 10 // 10x for very high quality
          canvas.width = width * scale
          canvas.height = height * scale

          const ctx = canvas.getContext('2d')
          if (!ctx) {
            console.error('[downloadAsImage] No canvas context!')
            return
          }

          // Create image from SVG data URL
          const img = new Image()

          img.onload = () => {
            console.log('[downloadAsImage] Image loaded successfully')

            // Fill white background for JPEG
            if (format === 'jpeg') {
              ctx.fillStyle = 'white'
              ctx.fillRect(0, 0, canvas.width, canvas.height)
            }

            // Draw image to canvas
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

            // Convert canvas to blob and download
            canvas.toBlob((blob) => {
              if (!blob) {
                console.error('[downloadAsImage] Failed to create blob!')
                return
              }
              console.log('[downloadAsImage] Blob created, downloading...')
              const downloadUrl = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = downloadUrl
              a.download = `mermaid-diagram.${format}`
              document.body.appendChild(a)
              a.click()
              document.body.removeChild(a)
              URL.revokeObjectURL(downloadUrl)
              console.log('[downloadAsImage] Download triggered!')
            }, `image/${format}`, 0.95)
          }

          img.onerror = (e) => {
            console.error('[downloadAsImage] Image load failed:', e)
          }

          img.src = svgDataUrl
          console.log('[downloadAsImage] Image src set (data URL), waiting for load...')

        } catch (error) {
          console.error('[downloadAsImage] Error:', error)
        }
      }

      // Menu items
      const menuItems = [
        { label: 'MMD', format: 'mmd' },
        { label: 'PNG', format: 'png' },
        { label: 'JPG', format: 'jpeg' },
      ]

      menuItems.forEach(({ label, format }) => {
        const item = document.createElement('button')
        item.textContent = label
        item.className = 'w-full px-3 py-2 text-left text-sm transition-colors hover:bg-muted/40'
        item.onclick = async (e) => {
          e.stopPropagation()
          dropdownMenu.classList.add('hidden')

          console.log('[Menu item] Clicked:', format)

          if (format === 'mmd') {
            const code = getMermaidCode()
            console.log('[Menu item] MMD code length:', code.length)
            const blob = new Blob([code], { type: 'text/plain' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = 'mermaid-diagram.mmd'
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
            console.log('[Menu item] MMD download triggered')
          } else {
            await downloadAsImage(format as 'png' | 'jpeg')
          }
        }
        dropdownMenu.appendChild(item)
      })

      // Replace download button onclick to toggle dropdown
      const originalOnClick = downloadBtn.onclick
      downloadBtn.onclick = (e) => {
        e.stopPropagation()
        dropdownMenu.classList.toggle('hidden')
      }

      // Close dropdown when clicking outside
      const closeDropdown = (e: Event) => {
        if (!dropdownWrapper.contains(e.target as Node)) {
          dropdownMenu.classList.add('hidden')
        }
      }
      document.addEventListener('click', closeDropdown)

      // Wrap download button with dropdown
      downloadBtn.parentNode?.insertBefore(dropdownWrapper, downloadBtn)
      dropdownWrapper.appendChild(downloadBtn)
      dropdownWrapper.appendChild(dropdownMenu)

      // Create zoom button
      const zoomBtn = document.createElement('button')
      zoomBtn.className = existingBtn.className
      zoomBtn.title = 'Zoom'
      zoomBtn.type = 'button'
      zoomBtn.setAttribute('data-zoom-button', 'true')
      zoomBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path><line x1="11" x2="11" y1="8" y2="14"></line><line x1="8" x2="14" y1="11" y2="11"></line></svg>`

      zoomBtn.onclick = (e) => {
        e.stopPropagation()
        const chartDiv = block.querySelector('[aria-label="Mermaid chart"]')
        const svg = chartDiv?.querySelector('svg')
        if (!svg) return

        const cloned = svg.cloneNode(true) as SVGElement
        cloned.removeAttribute('width')
        cloned.removeAttribute('height')
        cloned.style.width = '100%'
        cloned.style.height = 'auto'

        setSvgContent(cloned.outerHTML)
        setModalOpen(true)
      }

      controls.appendChild(zoomBtn)
    }

    // Find all Mermaid blocks
    const mermaidBlocks = container.querySelectorAll('[data-streamdown="mermaid-block"]')
    mermaidBlocks.forEach(addEnhancements)

    // Watch for new Mermaid blocks (streaming)
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element
            if (element.matches('[data-streamdown="mermaid-block"]')) {
              addEnhancements(element)
            }
            const blocks = element.querySelectorAll('[data-streamdown="mermaid-block"]')
            blocks.forEach(addEnhancements)
          }
        })
      })
    })

    observer.observe(container, {
      childList: true,
      subtree: true,
    })

    return () => observer.disconnect()
  }, [children])

  return (
    <>
      <div ref={containerRef}>
        <Streamdown controls={true}>
          {children}
        </Streamdown>
      </div>

      {modalOpen &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-8"
            onClick={() => setModalOpen(false)}
          >
            <div
              className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-[90vw] max-h-[90vh] overflow-auto flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
              dangerouslySetInnerHTML={{ __html: svgContent }}
            />
          </div>,
          document.body
        )}
    </>
  )
}
