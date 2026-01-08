"use client";

import { useEffect } from "react";

export function ErrorHandling() {
  useEffect(() => {
    // Global error handler for unhandled errors
    const handleError = (
      event: ErrorEvent | PromiseRejectionEvent
    ) => {
      // Prevent default browser error logging (we'll handle it)
      event.preventDefault();

      let errorInfo: {
        type: string;
        message: string;
        source?: string;
        stack?: string;
      };

      if ("message" in event) {
        // ErrorEvent
        errorInfo = {
          type: "Error",
          message: event.message,
          source: event.filename,
          stack: event.error?.stack,
        };
      } else {
        // PromiseRejectionEvent
        errorInfo = {
          type: "UnhandledPromiseRejection",
          message: String(event.reason),
          stack: event.reason?.stack,
        };
      }

      // Log to console (ARMS will capture this)
      console.error(
        `[Global Error Handler] ${errorInfo.type}:`,
        errorInfo.message,
        errorInfo
      );

      return true;
    };

    // Handle uncaught errors
    window.onerror = (message, source, lineno, colno, error) => {
      return handleError(
        new ErrorEvent("error", {
          message: String(message),
          filename: source,
          lineno,
          colno,
          error,
        })
      );
    };

    // Handle unhandled promise rejections
    window.onunhandledrejection = (event) => {
      return handleError(event);
    };

    return () => {
      // Cleanup on unmount
      window.onerror = null;
      window.onunhandledrejection = null;
    };
  }, []);

  return null;
}
