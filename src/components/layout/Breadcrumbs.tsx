'use client'

import { Breadcrumb } from 'antd'
import { HomeOutlined, UserOutlined, TeamOutlined } from '@ant-design/icons'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

interface BreadcrumbItem {
  title: string
  href?: string
  icon?: React.ReactNode
}

export default function Breadcrumbs() {
  const pathname = usePathname()

  const generateBreadcrumbs = (): BreadcrumbItem[] => {
    const items: BreadcrumbItem[] = [
      {
        title: '首页',
        href: '/',
        icon: <HomeOutlined />
      }
    ]

    // 根据路径生成面包屑
    if (pathname === '/profile') {
      items.push({
        title: '个人资料',
        icon: <UserOutlined />
      })
    } else if (pathname.startsWith('/admin')) {
      items.push({
        title: '管理',
        icon: <TeamOutlined />
      })

      if (pathname === '/admin/users') {
        items.push({
          title: '用户管理',
        })
      }
    }

    return items
  }

  const items = generateBreadcrumbs()

  if (items.length <= 1) {
    return null // 只有一个首页时不显示面包屑
  }

  const breadcrumbItems = items.map((item, index) => ({
    key: index,
    title: item.href ? (
      <Link href={item.href} className="flex items-center gap-1 hover:text-blue-600">
        {item.icon}
        <span>{item.title}</span>
      </Link>
    ) : (
      <span className="flex items-center gap-1">
        {item.icon}
        <span>{item.title}</span>
      </span>
    )
  }))

  return (
    <div className="mb-4">
      <Breadcrumb items={breadcrumbItems} />
    </div>
  )
}