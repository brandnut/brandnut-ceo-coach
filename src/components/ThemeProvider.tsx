"use client";

import { ConfigProvider, theme } from "antd";
import React from "react";

// Theme configuration that uses our CSS variables converted to actual HSL values
const antdTheme = {
  algorithm: theme.defaultAlgorithm,
  token: {
    // Primary colors - convert HSL values from CSS variables
    // --primary: 0 84.2% 60.2% (which is #e53e3e - red)
    colorPrimary: "#e53e3e",
    colorPrimaryHover: "#dc2626",
    colorPrimaryActive: "#b91c1c",
    colorPrimaryBg: "#fef2f2",
    colorPrimaryBgHover: "#fee2e2",

    // Action colors - --action: 234.1 100% 11.96% (deep blue)
    colorInfo: "hsl(234.1deg 100% 11.96%)",
    colorInfoHover: "hsl(234.1deg 100% 10%)",
    colorInfoActive: "hsl(234.1deg 100% 8%)",

    // Success colors
    colorSuccess: "#22c55e",
    colorSuccessHover: "#16a34a",
    colorSuccessActive: "#15803d",

    // Border and background colors
    colorBorder: "#e5e7eb",
    colorBorderSecondary: "#f3f4f6",
    colorFillContent: "#f5f5f5",
    colorFillAlter: "#fafafa",

    // Text colors
    colorText: "#111827",
    colorTextSecondary: "#6b7280",
    colorTextTertiary: "#9ca3af",

    // Border radius
    borderRadius: 6,
    borderRadiusLG: 8,
    borderRadiusSM: 4,
  },
  components: {
    Button: {
      algorithm: true,
      colorInfo: "hsl(234.1deg 100% 11.96%)",
      colorInfoHover: "hsl(234.1deg 100% 10%)",
      colorInfoActive: "hsl(234.1deg 100% 8%)",
      colorInfoText: "#ffffff",
      controlHeight: 40,
    },
    Input: {
      algorithm: true,
    },
    Upload: {
      algorithm: true,
    },
    Popover: {
      colorBgElevated: "#ffffff",
      colorBgSpotlight: "#fef2f2",
    },
  },
};

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  return (
    <ConfigProvider theme={antdTheme}>
      {children}
    </ConfigProvider>
  );
}