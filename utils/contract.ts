import { ethers } from 'ethers';

const ABI = [
  "function auctionCounter() view returns (uint256)",
  "function auctions(uint256) view returns (address nftContract, uint256 tokenId, address seller, uint256 reservePrice, uint256 endTime, address highestBidder, uint256 highestBid, bool active, bool finalized)",
  "function getActiveAuctions(uint256 page, uint256 pageSize) view returns (uint256[])",
  "function getActiveAuctionsCount() view returns (uint256)",
  "function getManyAuctionDetails(uint256[]) view returns (tuple(address nftContract, uint256 tokenId, address seller, uint256 reservePrice, uint256 endTime, address highestBidder, uint256 highestBid, bool active, bool finalized)[])",
  "function getUserAuctions(address) view returns (uint256[])",
  "function getUserBids(address) view returns (uint256[])",
  "function createAuction(address _nftContract, uint256 _tokenId, uint256 _reservePrice, uint256 _durationSecs)",
  "function placeBid(uint256 auctionId, uint256 amount)",
  "function endAuction(uint256 auctionId)",
  "function cancelAuction(uint256 auctionId)",
  "function relistAuction(uint256 auctionId, uint256 _newReservePrice, uint256 _durationSecs)",
  "function ADRIAN() view returns (address)"
];

export interface Auction {
  nftContract: string;
  tokenId: ethers.BigNumber;
  seller: string;
  reservePrice: ethers.BigNumber;
  endTime: ethers.BigNumber;
  highestBidder: string;
  highestBid: ethers.BigNumber;
  active: boolean;
  finalized: boolean;
}

export const getContract = (provider: ethers.providers.Provider | ethers.Signer) => {
  const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as string;
  return new ethers.Contract(contractAddress, ABI, provider);
};

export const getProvider = () => {
  return new ethers.providers.JsonRpcProvider(
    `https://base-mainnet.infura.io/v3/${process.env.NEXT_PUBLIC_INFURA_API_KEY}`,
    {
      name: "base",
      chainId: Number(process.env.NEXT_PUBLIC_BASE_CHAINID)
    }
  );
};

export const getSigner = (provider: ethers.providers.Web3Provider) => {
  return provider.getSigner();
};

export const formatTime = (timestamp: ethers.BigNumber) => {
  const date = new Date(timestamp.toNumber() * 1000);
  return date.toLocaleString();
};

export const formatEther = (wei: ethers.BigNumber) => {
  return ethers.utils.formatEther(wei);
};

export const parseEther = (ether: string) => {
  return ethers.utils.parseEther(ether);
};

export const shortenAddress = (address: string) => {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export const getAuctionTimeLeft = (endTime: ethers.BigNumber) => {
  const now = Math.floor(Date.now() / 1000);
  const end = endTime.toNumber();
  
  if (now >= end) {
    return "Finalizada";
  }
  
  const seconds = end - now;
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) {
    return `${days}d ${hours}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m ${seconds % 60}s`;
  }
};

export const isAuctionActive = (auction: Auction) => {
  return auction.active && !auction.finalized && 
    auction.endTime.toNumber() > Math.floor(Date.now() / 1000);
};

export const hasReserveBeenMet = (auction: Auction) => {
  return auction.highestBid.gte(auction.reservePrice);
};

export const canClaimNFT = (auction: Auction, address: string) => {
  const now = Math.floor(Date.now() / 1000);
  return auction.highestBidder.toLowerCase() === address.toLowerCase() && 
    auction.endTime.toNumber() <= now &&
    auction.highestBid.gte(auction.reservePrice) &&
    !auction.finalized;
}; 