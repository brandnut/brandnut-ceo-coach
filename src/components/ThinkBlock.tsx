"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, Brain } from "lucide-react";
import { Streamdown } from "streamdown";

interface ThinkBlockProps {
  content: string;
  shouldCollapse?: boolean;
}

export function ThinkBlock({ content, shouldCollapse }: ThinkBlockProps) {
  const [isExpanded, setIsExpanded] = useState(true); // 默认展开
  const [displayContent, setDisplayContent] = useState("");

  // 实时更新显示内容，支持流式，并根据标志自动折叠
  useEffect(() => {
    // 更新内容
    setDisplayContent(content);

    // 如果应该折叠，立即折叠
    if (shouldCollapse) {
      setIsExpanded(false);
      return;
    }
  }, [content, shouldCollapse]);

  // 只有当原始content为空时才不显示组件
  if (!content.trim()) return null;

  return (
    <div className="my-4 border border-gray-200 rounded-lg bg-gray-50 dark:bg-gray-800 dark:border-gray-700 animate-pulse-once w-full">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center w-full px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors rounded-t-lg"
      >
        <Brain className="w-4 h-4 mr-2 text-purple-600 animate-pulse" />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          深度思考
        </span>
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 ml-auto text-gray-500" />
        ) : (
          <ChevronRight className="w-4 h-4 ml-auto text-gray-500" />
        )}
      </button>

      {isExpanded && (
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 p-3 rounded border border-gray-200 dark:border-gray-600 w-full">
            <Streamdown controls={false}>{displayContent}</Streamdown>
          </div>
        </div>
      )}
    </div>
  );
}

export default ThinkBlock;