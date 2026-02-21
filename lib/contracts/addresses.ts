import { bsc, bscTestnet } from "viem/chains";

// Define contract names constant for type safety
export const CONTRACT_NAMES = {
  MWNFT: "MWNFT",
  MediaRewardContractV2: "MediaRewardContractV2",
  CMWToken: "CMWToken",
} as const;

export type ContractName = (typeof CONTRACT_NAMES)[keyof typeof CONTRACT_NAMES];

// Define addresses for each supported chain
export const CONTRACT_ADDRESSES: Record<number, Record<ContractName, `0x${string}`>> = {
  [bscTestnet.id]: {
    [CONTRACT_NAMES.MWNFT]: "0x3d9b7CfDb1F7c6869FF63F3A5a5279B010c1123C",
    [CONTRACT_NAMES.MediaRewardContractV2]: "0x66aA2482f5CB25c598cC3551e4624EbbD7B8Ed46",
    [CONTRACT_NAMES.CMWToken]: "0x79f7502797B84a3A1FC15e455A4dB36cfeca881E",
  },
  [bsc.id]: {
    [CONTRACT_NAMES.MWNFT]: "0x3d9b7CfDb1F7c6869FF63F3A5a5279B010c1123C",
    [CONTRACT_NAMES.MediaRewardContractV2]: "0x66aA2482f5CB25c598cC3551e4624EbbD7B8Ed46",
    [CONTRACT_NAMES.CMWToken]: "0x79f7502797B84a3A1FC15e455A4dB36cfeca881E",
  },
} as const;

// Default chain ID (fallback)
const envChainId = process.env.NEXT_PUBLIC_DEFAULT_CHAIN_ID || process.env.CHAIN_ID || "97";
const isMainnet = envChainId === "56";
export const DEFAULT_CHAIN_ID = isMainnet ? bsc.id : bscTestnet.id;
