# Geist 字体下载说明

## 需要下载的字体文件

请从以下链接下载 Geist 字体文件并放置到对应目录：

### Geist Sans

下载地址：https://github.com/vercel/geist-font/releases

需要的文件（放到 `public/fonts/geist/` 目录）：

- Geist-Regular.woff2
- Geist-Medium.woff2
- Geist-SemiBold.woff2
- Geist-Bold.woff2

## 目录结构

```
public/
  fonts/
    geist/
      Geist-Regular.woff2
      Geist-Medium.woff2
      Geist-SemiBold.woff2
      Geist-Bold.woff2
```

## 下载步骤

1. 访问 https://github.com/vercel/geist-font/releases
2. 下载最新版本的字体包
3. 解压后找到 woff2 格式的字体文件
4. 按照上述目录结构放置文件

## 注意事项

- 只需要 woff2 格式（现代浏览器都支持）
- 如果找不到某个字重，可以只下载 Regular 和 Bold
- 字体文件已在 `app/fonts.css` 中配置好
- Geist Mono（等宽字体）已移除，本项目只使用 Geist Sans
