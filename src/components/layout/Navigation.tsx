"use client";

import { useRouter } from "next/navigation";
import {
  Dropdown,
  Avatar,
  Button,
  Space,
  Divider,
  message,
  Typography,
} from "antd";
import type { MenuProps } from "antd";
import {
  UserOutlined,
  SettingOutlined,
  TeamOutlined,
  LogoutOutlined,
  MoreOutlined,
} from "@ant-design/icons";
import { useState } from "react";
import { useApp } from "@/contexts/AppContext";

const { Text } = Typography;

export default function Navigation() {
  const { me, organizations, logout } = useApp();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      await logout();
      message.success("已退出登录");
    } catch (error) {
      message.error("退出失败");
    } finally {
      setLoading(false);
    }
  };

  // Get the first organization for display
  const currentOrganization = organizations?.[0];

  if (!me) {
    return null; // 未登录时隐藏导航菜单
  }

  const menuItems: MenuProps["items"] = [
    {
      key: "logout",
      icon: <LogoutOutlined />,
      label: "退出登录",
      onClick: handleLogout,
      danger: true,
    },
  ];

  return (
    <div
      className="user-info"
      style={{
        padding: "12px 0px",
        borderBottom: "1px solid #f0f0f0",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between"
      }}
    >
      {/* User Info - Simple and clean */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <Avatar
          size="small"
          icon={<UserOutlined />}
        />
        <div>
          <Text strong style={{ color: "#262626", fontSize: "14px", display: "block" }}>
            {me.full_name || me.username}
          </Text>
          {currentOrganization && (
            <Text style={{ color: "#8c8c8c", fontSize: "12px", display: "block" }}>
              {currentOrganization.name}
            </Text>
          )}
        </div>
      </div>

      {/* Action Button - More icon with text */}
      <Dropdown
        menu={{ items: menuItems }}
        placement="bottomRight"
        trigger={["click"]}
      >
        <Button
          type="text"
          size="small"
          icon={<MoreOutlined />}
          style={{ color: "#8c8c8c" }}
        >
          更多
        </Button>
      </Dropdown>
    </div>
  );
}
