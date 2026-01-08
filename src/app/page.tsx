"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * @deprecated This page is sunset. Redirect to /chat instead.
 * Keeping this file for historical reference and potential future use.
 */
export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the new default chat page
    router.replace("/chat");
  }, [router]);

  return null;
}
