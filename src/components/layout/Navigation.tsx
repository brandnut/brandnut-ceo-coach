"use client";

import { useRouter } from "next/navigation";
import { Dropdown, Avatar, Button, Space, Divider, message } from "antd";
import type { MenuProps } from "antd";
import {
  UserOutlined,
  SettingOutlined,
  TeamOutlined,
  LogoutOutlined,
} from "@ant-design/icons";
import { useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { guestMode } from "@/config/app";

export default function Navigation() {
  const { me, logout } = useApp();
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

  // Guest mode: 只显示基本信息，不显示个人资料和退出登录
  if (guestMode.enabled) {
    return null; // Guest mode下完全不显示导航菜单
  }

  if (!me) {
    return null; // 未登录时隐藏导航菜单
  }

  const menuItems: MenuProps['items'] = [
    {
      key: "profile",
      icon: <UserOutlined />,
      label: "个人资料",
      onClick: () => router.push("/profile"),
    },
        {
      type: "divider",
    },
    {
      key: "logout",
      icon: <LogoutOutlined />,
      label: "退出登录",
      onClick: handleLogout,
      danger: true,
    },
  ];

  return (
    <div className="user-info">
        <Dropdown
          menu={{ items: menuItems }}
          placement="bottomRight"
          trigger={["click"]}
          arrow
        >
          <div className="user-avatar-container">
            <Avatar size="small" icon={<UserOutlined />} />
            <span className="user-name">{me.full_name || me.username}</span>
                      </div>
        </Dropdown>
      </div>
  );
}
