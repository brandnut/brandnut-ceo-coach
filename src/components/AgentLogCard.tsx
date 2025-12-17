"use client";

import { Collapse } from "antd";
import { ApiOutlined } from "@ant-design/icons";
import { useState } from "react";

interface AgentLogData {
  metadata?: {
    elapsed_time?: number;
  };
  [key: string]: any;
}

interface AgentLog {
  id: string;
  conversation_id: string;
  message_id: string;
  task_id: string;
  created_at: number;
  data: AgentLogData;
}

const formatElapsedTime = (data: AgentLogData) => {
  // 从原始数据中读取 elapsed_time，先检查 metadata 中，再检查顶层
  const elapsedTime = data.metadata?.elapsed_time ?? data.elapsed_time;
  if (elapsedTime !== undefined) {
    return `${elapsedTime.toFixed(2)}s`;
  }
  return "";
};

const toolNameMapping: Record<string, string> = {
  GET_SINGLE_INSTANCE: "查看思维框架",
  LIST_INSTANCES: "查找合适的思维框架",
  GET_TAGS: "载入思维框架目录",
};

const formatData = (data: AgentLogData) => {
  try {
    // 创建数据副本并隐藏指定字段
    const filteredData = { ...data };
    delete filteredData.node_execution_id;
    delete filteredData.parent_id;
    delete filteredData.node_id;

    // 提取 elapsed_time 到顶层，然后删除整个 metadata
    if (filteredData.metadata?.elapsed_time !== undefined) {
      filteredData.elapsed_time = filteredData.metadata.elapsed_time;
    }
    delete filteredData.metadata;

    return JSON.stringify(filteredData, null, 2);
  } catch {
    return JSON.stringify(data);
  }
};

interface AgentLogAccordionProps {
  logs: AgentLog[];
}

export function AgentLogAccordion({ logs }: AgentLogAccordionProps) {
  const [activeKeys, setActiveKeys] = useState<string[]>([]);

  if (logs.length === 0) return null;

  const handleChange = (keys: (string | number)[]) => {
    setActiveKeys(keys as string[]);
  };

  const items = logs.map((log) => ({
    key: log.id,
    label: (
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm font-medium truncate">
          {(() => {
            const toolName = log.data.label?.replace(/^CALL\s*/, "");
            if (toolName) {
              return toolNameMapping[toolName] || `已调用 ${toolName}`;
            }
            return "已调用";
          })()}
        </span>
        <span className="text-xs text-blue-600 flex-shrink-0">
          {formatElapsedTime(log.data)}
        </span>
      </div>
    ),
    children: (
      <div className="bg-white border border-blue-100 rounded p-3 w-full overflow-hidden">
        <pre className="text-xs overflow-x-auto whitespace-pre-wrap font-mono break-all">
          {formatData(log.data)}
        </pre>
      </div>
    ),
  }));

  return (
    <div className="agent-log-accordion mb-4 w-full overflow-hidden">
      <div className="flex items-center gap-2 mb-2 text-sm text-gray-600">
        <ApiOutlined />
        <span>工具调用 ({logs.length})</span>
      </div>
      <Collapse
        items={items}
        activeKey={activeKeys}
        onChange={handleChange}
        size="small"
        bordered={false}
        ghost
        className="w-full"
        style={{
          backgroundColor: "transparent",
          width: "100%",
        }}
      />
    </div>
  );
}
