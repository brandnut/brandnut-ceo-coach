"use client";

import { useState } from "react";
import { Button, Drawer } from "antd";
import { MenuOutlined } from "@ant-design/icons";
import { useMediaQuery } from "@/hooks/useMediaQuery";

interface MenuBarProps {
  onSidebarToggle: () => void;
  sidebarCollapsed: boolean;
  children: React.ReactNode;
  currentConvName?: string;
}

export default function MenuBar({
  onSidebarToggle,
  sidebarCollapsed,
  children,
  currentConvName,
}: MenuBarProps) {
  const [drawerVisible, setDrawerVisible] = useState(false);
  const isMobile = useMediaQuery("(max-width: 768px)");

  const handleMenuClick = () => {
    if (isMobile) {
      setDrawerVisible(true);
    } else {
      onSidebarToggle();
    }
  };

  const handleDrawerClose = () => {
    setDrawerVisible(false);
  };

  return (
    <>
      <div className={`h-16 bg-white border-b border-gray-200 flex items-center justify-between sticky top-0 z-10 ${isMobile ? 'px-4' : 'px-6'}`}>
        <div className="flex items-center gap-4">
          <Button
            type="text"
            icon={<MenuOutlined />}
            onClick={handleMenuClick}
            className="text-gray-600 hover:text-gray-900"
          />
          {isMobile ? (
            <div className="flex flex-col leading-tight">
              {currentConvName ? (
                <>
                  <h1 className="text-base font-semibold text-gray-900 truncate">
                    {currentConvName}
                  </h1>
                  <span className="text-sm text-gray-600">
                    中欧银发经济知识库
                  </span>
                </>
              ) : (
                <h1 className="text-lg font-semibold text-gray-900">
                  中欧银发经济知识库
                </h1>
              )}
            </div>
          ) : (
            <h1 className="text-lg font-semibold text-gray-900">
              中欧银发经济知识库
            </h1>
          )}
        </div>
      </div>

      {/* Mobile Drawer */}
      {isMobile && (
        <Drawer
          title={null}
          placement="left"
          onClose={handleDrawerClose}
          open={drawerVisible}
          closable={false}
          styles={{ body: { padding: 0 } }}
          width={280}
          mask={true}
          destroyOnClose={true}
        >
          {children}
        </Drawer>
      )}
    </>
  );
}
