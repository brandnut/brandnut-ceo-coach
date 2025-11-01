export interface AppConfig {
  app: {
    name: string;
    subtitle: string;
    description: string;
    icon: string;
  };
  tutorial: {
    title: string;
    description: string;
    howToAsk: {
      title: string;
      examples: string[];
    };
    mindMapping: {
      title: string;
      triggers: string[];
    };
    logic: string[];
    notes: string[];
  };
  welcome: {
    greeting: string;
    startNewConversation: string;
    suggestedQuestionsTitle: string;
    suggestedQuestions: {
      text: string;
      onClick: () => void;
    }[];
  };
}

export const defaultConfig: AppConfig = {
  app: {
    name: "通用知识库",
    subtitle: "智能问答系统",
    description: "本知识库旨在帮助您快速、准确地获取相关信息。所有内容由 AI 生成，请仔细甄别。",
    icon: "👋",
  },
  tutorial: {
    title: "欢迎使用通用知识库",
    description: "本知识库旨在帮助您快速、准确地获取相关信息。所有内容由 AI 生成，请仔细甄别。",
    howToAsk: {
      title: "如何提问",
      examples: [
        "请提出您关心的问题，例如：",
        "相关领域的发展趋势有哪些？",
        "主要特征或特点是什么？",
        "相关情况有什么变化？",
      ],
    },
    mindMapping: {
      title: "生成思维导图",
      triggers: [
        "当您希望以更直观的方式理解信息时，可以直接请求系统绘制 **思维导图、流程图、框架图** 等图表，例如：",
        "请用思维导图展示",
        "画一张流程图",
      ],
    },
    logic: [
      "如果问题需要数据或报告支撑，AI 会从知识库中 **检索相关文件内容**。",
      "若需补充最新资讯，AI 会结合互联网公开数据进行说明。",
    ],
    notes: [
      "所有内容由 AI 生成，请仔细甄别。",
      "您的对话不会永久保存",
    ],
  },
  welcome: {
    greeting: "开始新对话",
    startNewConversation: "开始新对话",
    suggestedQuestionsTitle: "您可以尝试询问以下问题：",
    suggestedQuestions: [
      {
        text: "相关领域的发展趋势有哪些？",
        onClick: () => {},
      },
      {
        text: "主要特征或特点是什么？",
        onClick: () => {},
      },
      {
        text: "相关情况有什么变化？",
        onClick: () => {},
      },
    ],
  },
};

export const silverEconomyConfig: AppConfig = {
  app: {
    name: "中欧国际工商学院 · 银发经济知识库",
    subtitle: "银发经济专业问答",
    description: "本知识库旨在帮助您快速、准确地了解 **银发经济（老龄化社会相关产业）** 的市场趋势、消费洞察、案例与政策研究。所有内容由 AI 生成，请仔细甄别。",
    icon: "👋",
  },
  tutorial: {
    title: "欢迎来到中欧国际工商学院 · 银发经济知识库",
    description: "本知识库旨在帮助您快速、准确地了解 **银发经济（老龄化社会相关产业）** 的市场趋势、消费洞察、案例与政策研究。所有内容由 AI 生成，请仔细甄别。",
    howToAsk: {
      title: "如何提问",
      examples: [
        "请围绕 **银发经济** 提问。例如：",
        "银发消费的主要品类增长趋势有哪些？",
        "老年人线上购物的主要渠道是哪些？",
        "适老家居用品的消费情况有什么趋势？",
      ],
    },
    mindMapping: {
      title: "生成思维导图",
      triggers: [
        "当您希望以更直观的方式理解信息时，可以直接请求系统绘制 **思维导图、流程图、框架图** 等图表，例如：",
        "请用思维导图展示",
        "画一张流程图",
      ],
    },
    logic: [
      "如果问题需要数据或报告支撑，AI 会从知识库中 **检索相关文件内容**。",
      "若需补充最新资讯（如政策、品牌动态等），AI 会结合互联网公开数据进行说明。",
    ],
    notes: [
      "所有内容由 AI 生成，请仔细甄别。",
      "您的对话不会永久保存",
    ],
  },
  welcome: {
    greeting: "开始新对话",
    startNewConversation: "开始新对话",
    suggestedQuestionsTitle: "您可以尝试询问以下问题：",
    suggestedQuestions: [
      {
        text: "银发市场近年来的趋势是什么？",
        onClick: () => {},
      },
      {
        text: "适老家居用品的消费情况有什么趋势？",
        onClick: () => {},
      },
      {
        text: "银发人群的消费特征是什么？",
        onClick: () => {},
      },
    ],
  },
};

export function getConfig(setInput?: (input: string) => void): AppConfig {
  const configType = process.env.NEXT_PUBLIC_APP_CONFIG_TYPE;

  const defaultConfigWithHandlers: AppConfig = {
    ...defaultConfig,
    welcome: {
      ...defaultConfig.welcome,
      suggestedQuestions: defaultConfig.welcome.suggestedQuestions.map(q => ({
        ...q,
        onClick: () => setInput?.(q.text),
      })),
    },
  };

  const silverEconomyConfigWithHandlers: AppConfig = {
    ...silverEconomyConfig,
    welcome: {
      ...silverEconomyConfig.welcome,
      suggestedQuestions: silverEconomyConfig.welcome.suggestedQuestions.map(q => ({
        ...q,
        onClick: () => setInput?.(q.text),
      })),
    },
  };

  if (configType === 'silver-economy') {
    return silverEconomyConfigWithHandlers;
  }

  return defaultConfigWithHandlers;
}