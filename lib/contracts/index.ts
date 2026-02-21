import { useChainId } from "wagmi";
import { CONTRACT_ADDRESSES, DEFAULT_CHAIN_ID, ContractName, CONTRACT_NAMES } from "./addresses";
import { MwNFTABI } from "./abis/MWNFT";
import { MediaRewardContractV2ABI } from "./abis/MediaRewardContractV2";
import { CMWTokenABI } from "./abis/CMWToken";

export { MwNFTABI, MediaRewardContractV2ABI, CMWTokenABI };

export function useContractAddress(name: ContractName) {
  const chainId = useChainId();
  const activeChainId = chainId && CONTRACT_ADDRESSES[chainId] ? chainId : DEFAULT_CHAIN_ID;

  return CONTRACT_ADDRESSES[activeChainId][name];
}

export function useMWNFTContract() {
  const address = useContractAddress(CONTRACT_NAMES.MWNFT);
  return {
    address,
    abi: MwNFTABI,
  };
}

export function useMediaRewardContractV2() {
  const address = useContractAddress(CONTRACT_NAMES.MediaRewardContractV2);
  return {
    address,
    abi: MediaRewardContractV2ABI,
  };
}

export function useCMWTokenContract() {
  const address = useContractAddress(CONTRACT_NAMES.CMWToken);
  return {
    address,
    abi: CMWTokenABI,
  };
}
