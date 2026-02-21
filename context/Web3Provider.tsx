"use client";

import React, { type ReactNode } from "react";
import { wagmiAdapter, projectId, networks } from "@/config/wagmi";
import { createAppKit, AppKitProvider } from "@reown/appkit/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, type Config, cookieToInitialState } from "wagmi";
import { mainnet } from "@reown/appkit/networks";
import { siteConfig } from "@/config/site";
import { RouteGuard } from "@/components/auth/RouteGuard";
import { useSiweAuth } from "@/hooks/useSiweAuth";

// SIWE 登录处理组件
function SiweAuthHandler({ children }: { children: ReactNode }) {
  useSiweAuth(); // 自动处理 SIWE 登录
  return <>{children}</>;
}

const queryClient = new QueryClient();

const appKitMetadata = {
  name: siteConfig.name,
  description: siteConfig.description,
  url: siteConfig.url,
  icons: siteConfig.icons,
};

createAppKit({
  adapters: [wagmiAdapter],
  projectId: projectId || "",
  networks: networks as [any, ...any[]],
  defaultNetwork: mainnet,
  metadata: appKitMetadata,
  features: {
    analytics: true,
    connectMethodsOrder: ["email", "social", "wallet"],
  },
  featuredWalletIds: [
    // okx
    "5d9f1395b3a8e848684848dc4147cbd05c8d54bb737eac78fe103901fe6b01a1",
    // metamask
    "c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96",
    // coinbase
    "fd20dc426fb37566d803205b19bbc1d4096b248ac04548e3cfb6b3a38bd033aa",
  ],
  themeMode: "light",
});

export function Web3Provider({
  children,
  cookies,
}: {
  children: ReactNode;
  cookies: string | null;
}) {
  const initialState = cookieToInitialState(wagmiAdapter.wagmiConfig as Config, cookies);

  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig as Config} initialState={initialState}>
      <QueryClientProvider client={queryClient}>
        <AppKitProvider
          adapters={[wagmiAdapter]}
          projectId={projectId || ""}
          networks={networks as [any, ...any[]]}
          metadata={appKitMetadata}
          themeMode="light"
        >
          <SiweAuthHandler>
            <RouteGuard>{children}</RouteGuard>
          </SiweAuthHandler>
        </AppKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
