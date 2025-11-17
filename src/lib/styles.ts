// Shared design system variables for brandnut CEO coach

export const brandnutStyles = {
  background: {
    gradient: 'linear-gradient(180deg, #f5271f14, #f5271f05)',
  },
} as const;

// Feature unavailable text mappings
export const featureUnavailableTexts = {
  titles: {
    no_permission: '没有权限',
    no_organization: '未开通组织',
    no_feature: '功能未开通',
  },
  messages: {
    no_permission: (userName: string, orgName: string) =>
      `${userName ? `${userName}，` : ""}${orgName ? `您的组织 ${orgName} ` : ""} 还没有给您开通 CEO 教练的使用权限`,
    no_organization: (userName: string) =>
      `${userName ? `${userName}，` : ""}您尚未在品核 AI 开通组织，如您已经与我们进入服务流程，请耐心等待`,
    no_feature: (userName: string, orgName: string) =>
      `${userName ? `${userName}${orgName ? "，" : ""}` : ""}${orgName ? `您的组织 ${orgName} ` : ""} 尚未开通 CEO 教练`,
  },
  buttons: {
    apply_interview: '申请深度访谈',
    logout: '退出登录',
  },
  steps: {
    interview: '接受深度访谈',
    report: '获得战略诊断报告',
    coach: '获得 CEO 教练',
  },
} as const;