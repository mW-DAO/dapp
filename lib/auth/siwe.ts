import { SiweMessage } from "siwe";
import { siteConfig } from "@/config/site";

export function createSiweMessage(address: string, chainId: number, nonce: string) {
  // 从 siteConfig.url 解析 domain 和 scheme
  const url = new URL(siteConfig.url);

  return new SiweMessage({
    domain: url.host, // 自动提取域名 (localhost:3000 或 your-app.vercel.app)
    address,
    statement: `Sign in to ${siteConfig.name}`,
    uri: siteConfig.url, // 复用 siteConfig 的 URL
    version: `${siteConfig.version}`,
    chainId, // 由调用方传入当前用户选择的链 ID
    nonce,
  });
}
