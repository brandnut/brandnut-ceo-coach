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
  DownOutlined,
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
      style={{ padding: "12px 16px", borderBottom: "1px solid #f0f0f0" }}
    >
      {/* User Info Section */}
      <div style={{ marginBottom: "12px" }}>
        <div
          style={{ display: "flex", alignItems: "center", marginBottom: "8px" }}
        >
          <Avatar
            size="small"
            icon={<UserOutlined />}
            style={{ marginRight: "8px" }}
          />
          <Text strong style={{ color: "#1a1a1a", fontSize: "14px" }}>
            {me.full_name || me.username}
          </Text>
        </div>

        {currentOrganization && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginLeft: "32px",
            }}
          >
            <TeamOutlined
              style={{ color: "#666", fontSize: "12px", marginRight: "6px" }}
            />
            <Text style={{ color: "#666", fontSize: "12px" }}>
              {currentOrganization.name}
            </Text>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div style={{ display: "flex", gap: "8px" }}>
        <Dropdown
          menu={{ items: menuItems }}
          placement="bottomRight"
          trigger={["click"]}
          arrow
        >
          <Button
            type="text"
            size="small"
            icon={<DownOutlined />}
            style={{ color: "#666", padding: "4px 8px" }}
          >
            更多
          </Button>
        </Dropdown>
      </div>
    </div>
  );
}
