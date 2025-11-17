"use client";

import { useState, forwardRef, useImperativeHandle } from "react";
import { Button, Drawer } from "antd";
import { MenuOutlined } from "@ant-design/icons";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useApp } from "@/contexts/AppContext";
import { appInfo } from "@/config/app";

interface MenuBarProps {
  onSidebarToggle: () => void;
  sidebarCollapsed: boolean;
  children: React.ReactNode;
  currentConvName?: string;
  onMobileSidebarClose?: () => void;
}

export interface MenuBarRef {
  closeMobileSidebar: () => void;
}

const MenuBar = forwardRef<MenuBarRef, MenuBarProps>(({
  onSidebarToggle,
  sidebarCollapsed,
  children,
  currentConvName,
  onMobileSidebarClose,
}, ref) => {
  const [drawerVisible, setDrawerVisible] = useState(false);
  const isMobile = useMediaQuery("(max-width: 768px)");
  const { organizations } = useApp();

  // Get organization name from organizations data
  const getOrgName = () => {
    if (organizations && organizations.length > 0) {
      return organizations[0].name;
    }
    return "";
  };

  // Dynamic app name as computed property
  const getDynamicAppName = () => {
    const orgName = getOrgName();
    return orgName ? `${orgName} - ${appInfo.name}` : appInfo.name;
  };

  const handleMenuClick = () => {
    if (isMobile) {
      setDrawerVisible(true);
    } else {
      onSidebarToggle();
    }
  };

  const handleDrawerClose = () => {
    setDrawerVisible(false);
    onMobileSidebarClose?.();
  };

  // Expose mobile sidebar close function to parent
  const closeMobileSidebar = () => {
    if (isMobile && drawerVisible) {
      setDrawerVisible(false);
      onMobileSidebarClose?.();
    }
  };

  // Expose function via ref
  useImperativeHandle(ref, () => ({
    closeMobileSidebar
  }));

  return (
    <>
      <div className={`h-16 bg-white border-b border-gray-200 flex items-center justify-between sticky top-0 z-10 ${isMobile ? 'px-4' : 'px-6'}`}>
        <div className="flex items-center">
          <Button
            type="text"
            icon={<MenuOutlined />}
            onClick={handleMenuClick}
            className="text-gray-600 hover:text-gray-900"
          />
          <div className="flex items-center gap-3">
            <img
              src="/favicon.png"
              alt="Brandnut"
              className="w-8 h-8 flex-shrink-0"
              style={{ objectFit: 'cover' }}
            />
            {isMobile ? (
              <div className="flex flex-col leading-tight" style={{ minHeight: '32px' }}>
                {currentConvName ? (
                  <>
                    <h1 className="text-base font-semibold text-gray-900 truncate leading-5">
                      {currentConvName}
                    </h1>
                    <span className="text-sm text-gray-600 leading-4 font-normal">
                      {getDynamicAppName()}
                    </span>
                  </>
                ) : (
                  <h1 className="text-lg font-semibold text-gray-900 leading-6">
                    {getDynamicAppName()}
                  </h1>
                )}
              </div>
            ) : (
              <h1 className="text-lg font-semibold text-gray-900 leading-6">
                {getDynamicAppName()}
              </h1>
            )}
          </div>
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
});

MenuBar.displayName = 'MenuBar';

export default MenuBar;
