const url = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";

export const siteConfig = {
  name: "EcoFi m&W DAO",
  description: "EcoFi 加密生态共建社区",
  version: "1",
  url,
  icons: [`${url}/favicon.ico`],
};

export type SiteConfig = typeof siteConfig;
