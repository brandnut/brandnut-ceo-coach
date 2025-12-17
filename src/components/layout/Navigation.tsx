"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Dropdown, Avatar, Button, Space, Divider, message } from "antd";
import type { MenuProps } from "antd";
import {
  UserOutlined,
  SettingOutlined,
  TeamOutlined,
  LogoutOutlined,
} from "@ant-design/icons";
import { useState } from "react";
import { guestMode } from "@/config/app";

export default function Navigation() {
  const { data: session } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      await signOut({
        callbackUrl: "/login",
        redirect: true,
      });
      message.success("已退出登录");
    } catch (error) {
      message.error("退出失败");
    } finally {
      setLoading(false);
    }
  };

  // Guest mode: 只显示基本信息，不显示个人资料和退出登录
  if (guestMode.enabled && session?.user?.name === guestMode.username) {
    return null; // Guest mode下完全不显示导航菜单
  }

  const menuItems: MenuProps['items'] = [
    {
      key: "profile",
      icon: <UserOutlined />,
      label: "个人资料",
      onClick: () => router.push("/profile"),
    },
    ...(session?.user?.role === "admin"
      ? [
          {
            key: "admin-users",
            icon: <TeamOutlined />,
            label: "用户管理",
            onClick: () => router.push("/admin/users"),
          },
        ]
      : []),
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

  if (!session) return null;

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
            <span className="user-name">{session.user?.name || 'guest'}</span>
            {session.user?.role === "admin" && (
              <span className="admin-badge">管理员</span>
            )}
          </div>
        </Dropdown>
      </div>
  );
}
