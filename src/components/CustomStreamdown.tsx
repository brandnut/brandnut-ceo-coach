"use client";

import { Streamdown } from "streamdown";
import { useRef, useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface CustomStreamdownProps {
  children: string;
  className?: string;
}

export default function CustomStreamdown({ children, className }: CustomStreamdownProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [svgContent, setSvgContent] = useState("");

  // 在渲染前过滤掉
  const cleanContent = children.replace(/<\/?think[^>]*>/gi, '').trim();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const addEnhancements = (block: Element) => {
      if (block.querySelector("[data-zoom-button]")) return;

      const controls = block.querySelector(".flex.items-center");
      if (!controls) return;

      const existingBtn = controls.querySelector("button");
      if (!existingBtn) return;

      const hideOriginalDownloadButton = () => {
        const originalDownloadBtn = block.querySelector(
          'button[title="Download file"]'
        ) as HTMLButtonElement;
        if (originalDownloadBtn) {
          originalDownloadBtn.style.display = "none";
        }
      };

      let mermaidCode = "";

      const captureCodeFromCopyButton = () => {
        const copyBtn = Array.from(controls.querySelectorAll("button")).find(
          (btn) => btn.getAttribute("title")?.toLowerCase().includes("copy")
        );
        if (!copyBtn) return false;

        const originalWriteText = navigator.clipboard.writeText.bind(
          navigator.clipboard
        );
        let intercepting = true;

        navigator.clipboard.writeText = async function (text: string) {
          if (intercepting) {
            mermaidCode = text;
            intercepting = false;
            return Promise.resolve();
          }
          return originalWriteText(text);
        };

        copyBtn.dispatchEvent(new MouseEvent("click", { bubbles: false }));

        setTimeout(() => {
          navigator.clipboard.writeText = originalWriteText;
        }, 100);

        return true;
      };

      const getMermaidCode = () => {
        return mermaidCode;
      };

      hideOriginalDownloadButton();

      const downloadAsImage = async (format: "png" | "jpeg") => {
        const chartDiv = block.querySelector('[aria-label="Mermaid chart"]');
        const svg = chartDiv?.querySelector("svg");

        if (!svg) return;

        try {
          const svgClone = svg.cloneNode(true) as SVGElement;

          const bbox = svg.getBoundingClientRect();
          const width = bbox.width;
          const height = bbox.height;

          svgClone.setAttribute("width", width.toString());
          svgClone.setAttribute("height", height.toString());

          const svgData = new XMLSerializer().serializeToString(svgClone);

          const svgDataUrl =
            "data:image/svg+xml;base64," +
            btoa(unescape(encodeURIComponent(svgData)));

          const canvas = document.createElement("canvas");
          const BASE_SCALE = 6;
          const MIN_EXPORT_WIDTH = 2000;
          const MIN_EXPORT_HEIGHT = 1000;

          let scale = BASE_SCALE;
          if (width > 0 && height > 0) {
            const minWidthScale = MIN_EXPORT_WIDTH / width;
            const minHeightScale = MIN_EXPORT_HEIGHT / height;
            scale = Math.max(BASE_SCALE, minWidthScale, minHeightScale);
          }

          canvas.width = Math.ceil(width * scale);
          canvas.height = Math.ceil(height * scale);

          const ctx = canvas.getContext("2d");
          if (!ctx) return;

          const img = new Image();

          img.onload = () => {
            if (format === "jpeg") {
              ctx.fillStyle = "white";
              ctx.fillRect(0, 0, canvas.width, canvas.height);
            }

            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            canvas.toBlob(
              (blob) => {
                if (!blob) return;
                const downloadUrl = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = downloadUrl;
                a.download = `mermaid-diagram.${format}`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(downloadUrl);
              },
              `image/${format}`,
              0.95
            );
          };

          img.src = svgDataUrl;
        } catch (error) {
          console.error("[downloadAsImage] Error:", error);
        }
      };

      const createDownloadDropdown = () => {
        if (block.querySelector("[data-mermaid-dropdown]")) return;

        const dropdownWrapper = document.createElement("div");
        dropdownWrapper.className = "relative";
        dropdownWrapper.setAttribute("data-mermaid-dropdown", "true");

        const downloadBtn = document.createElement("button");
        downloadBtn.className = existingBtn.className;
        downloadBtn.title = "Download";
        downloadBtn.type = "button";
        downloadBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" x2="12" y1="15" y2="3"></line></svg>`;

        const dropdownMenu = document.createElement("div");
        dropdownMenu.className =
          "absolute top-full right-0 z-10 mt-1 min-w-[120px] rounded-md border border-border bg-background shadow-lg hidden";

        const menuItems = [
          { label: "MMD", format: "mmd" },
          { label: "PNG", format: "png" },
          { label: "JPG", format: "jpeg" },
        ];

        menuItems.forEach(({ label, format }) => {
          const item = document.createElement("button");
          item.textContent = label;
          item.className =
            "w-full px-3 py-2 text-left text-sm transition-colors hover:bg-muted/40";
          item.onclick = async (e) => {
            e.stopPropagation();
            dropdownMenu.classList.add("hidden");

            if (format === "mmd") {
              const code = getMermaidCode();
              const blob = new Blob([code], { type: "text/plain" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "mermaid-diagram.mmd";
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            } else {
              await downloadAsImage(format as "png" | "jpeg");
            }
          };
          dropdownMenu.appendChild(item);
        });

        downloadBtn.onclick = (e) => {
          e.stopPropagation();
          dropdownMenu.classList.toggle("hidden");
        };

        const closeDropdown = (e: Event) => {
          if (!dropdownWrapper.contains(e.target as Node)) {
            dropdownMenu.classList.add("hidden");
          }
        };
        document.addEventListener("click", closeDropdown);

        dropdownWrapper.appendChild(downloadBtn);
        dropdownWrapper.appendChild(dropdownMenu);

        return dropdownWrapper;
      };

      const zoomBtn = document.createElement("button");
      zoomBtn.className = existingBtn.className;
      zoomBtn.title = "Zoom";
      zoomBtn.type = "button";
      zoomBtn.setAttribute("data-zoom-button", "true");
      zoomBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path><line x1="11" x2="11" y1="8" y2="14"></line><line x1="8" x2="14" y1="11" y2="11"></line></svg>`;

      zoomBtn.onclick = (e) => {
        e.stopPropagation();
        const chartDiv = block.querySelector('[aria-label="Mermaid chart"]');
        const svg = chartDiv?.querySelector("svg");
        if (!svg) return;

        const cloned = svg.cloneNode(true) as SVGElement;
        cloned.removeAttribute("width");
        cloned.removeAttribute("height");
        cloned.style.width = "100%";
        cloned.style.height = "auto";

        setSvgContent(cloned.outerHTML);
        setModalOpen(true);
      };

      captureCodeFromCopyButton();

      const downloadDropdown = createDownloadDropdown();
      if (downloadDropdown) {
        controls.appendChild(downloadDropdown);
      }
      controls.appendChild(zoomBtn);

      const controlsObserver = new MutationObserver(() => {
        hideOriginalDownloadButton();
      });

      controlsObserver.observe(controls, {
        childList: true,
        subtree: true,
      });
    };

    const mermaidBlocks = container.querySelectorAll(
      '[data-streamdown="mermaid-block"]'
    );
    mermaidBlocks.forEach(addEnhancements);

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            if (element.matches('[data-streamdown="mermaid-block"]')) {
              addEnhancements(element);
            }
            const blocks = element.querySelectorAll(
              '[data-streamdown="mermaid-block"]'
            );
            blocks.forEach(addEnhancements);
          }
        });
      });
    });

    observer.observe(container, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, [cleanContent]);

  return (
    <>
      <div ref={containerRef} className={className}>
        <Streamdown controls={true}>{cleanContent}</Streamdown>
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
  );
}