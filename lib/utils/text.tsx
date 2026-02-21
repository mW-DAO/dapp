import React from "react";

/**
 * 解析并高亮文本中的 #标签
 * @param text 原始文本
 * @param onTagClick 点击标签的回调
 * @returns ReactNode[]
 */
export function parseAndHighlightHashtags(text: string, onTagClick?: (tag: string) => void) {
  if (!text) return null;

  // 匹配 # 及其后跟随的字母、数字、下划线或汉字
  return text.split(/(#[\w\u4e00-\u9fa5]+)/g).map((part, index) => {
    if (part.match(/^#[\w\u4e00-\u9fa5]+$/)) {
      return (
        <span
          key={index}
          className="cursor-pointer font-medium text-blue-600 hover:underline"
          onClick={(e) => {
            e.stopPropagation();
            onTagClick?.(part);
          }}
        >
          {part}
        </span>
      );
    }
    return <span key={index}>{part}</span>;
  });
}
