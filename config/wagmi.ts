import { cookieStorage, createStorage, http } from "wagmi";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { bsc, bscTestnet } from "@reown/appkit/networks";

export const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID || "YOUR_PROJECT_ID_PLACEHOLDER";

if (!projectId || projectId === "YOUR_PROJECT_ID_PLACEHOLDER") {
  console.warn("NEXT_PUBLIC_REOWN_PROJECT_ID is not defined. Please check your .env.local");
}

// Configure chains based on NEXT_PUBLIC_DEFAULT_CHAIN_ID
const defaultChainId = parseInt(process.env.NEXT_PUBLIC_DEFAULT_CHAIN_ID || "97");
export const networks = defaultChainId === bsc.id ? [bsc] : [bscTestnet];

export const wagmiAdapter = new WagmiAdapter({
  storage: createStorage({
    storage: cookieStorage,
  }),
  ssr: true,
  projectId,
  networks,
  transports: {
    [bsc.id]: http("https://bsc-mainnet.infura.io/v3/e07b85d111f44115a3b53a5350cf705c"),
    [bscTestnet.id]: http("https://bsc-testnet.infura.io/v3/e07b85d111f44115a3b53a5350cf705c"),
  },
});

export const config = wagmiAdapter.wagmiConfig;
