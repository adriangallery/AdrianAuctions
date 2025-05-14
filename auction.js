// Adrian Auction DApp - Main JavaScript functionality

// Contract Constants
const CONTRACT_ADDRESS = "0xb502e19e62eE8D5Ee1F179b489d832EAb328Bc99";
const ADRIAN_TOKEN_ADDRESS = "0x6c9c44334093eB53C7acEAE32DCEC8E945D27b28"; // Hypothetical ADRIAN token address
const ALCHEMY_API_KEY = "5qIXA1UZxOAzi8b9l0nrYmsQBO9-W7Ot";
const ALCHEMY_RPC_URL = `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
const RPC_URL = ALCHEMY_RPC_URL;

// Contract ABIs
const AUCTION_ABI = [
  "function getActiveAuctionsCount() view returns (uint256)",
  "function getActiveAuctions(uint256,uint256) view returns (uint256[] memory)",
  "function getManyAuctionDetails(uint256[]) view returns ((address,uint256,address,uint256,uint256,address,uint256,bool,bool)[] memory)",
  "function getUserAuctions(address) view returns (uint256[] memory)",
  "function getUserBids(address) view returns (uint256[] memory)",
  "function createAuction(address,uint256,uint256,uint256) external",
  "function placeBid(uint256,uint256) external",
  "function endAuction(uint256) external",
  "function cancelAuction(uint256) external",
  "function relistAuction(uint256,uint256,uint256) external"
];

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)"
];

const ERC721_ABI = [
  "function isApprovedForAll(address owner, address operator) external view returns (bool)",
  "function setApprovalForAll(address operator, bool approved) external",
  "function ownerOf(uint256 tokenId) external view returns (address)",
  "function balanceOf(address owner) external view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256)",
  "function tokenURI(uint256 tokenId) external view returns (string memory)"
];

// Base Network Configuration
const BASE_NETWORK = {
  chainId: "0x2105", // 8453 in hex
  chainName: "Base Mainnet",
  nativeCurrency: {
    name: "ETH",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: [RPC_URL],
  blockExplorerUrls: ["https://basescan.org/"],
};

// App State
let currentAccount = null;
let provider = null;
let signer = null;
let auctionContract = null;
let readOnlyProvider = null;
let readOnlyAuctionContract = null;
let alchemyWeb3 = null;
let ownedNFTs = [];
let selectedNFT = null;
let nftPageKey = null; // Para guardar la clave de paginación
let isLoadingMoreNFTs = false; // Flag para evitar cargas múltiples

// DOM Elements
document.addEventListener('DOMContentLoaded', () => {
  // Set up contract info
  document.getElementById('contractInfo').textContent = 
    `Contract: ${CONTRACT_ADDRESS.substring(0, 6)}...${CONTRACT_ADDRESS.substring(38)}`;
  
  // Connect button event listener
  document.getElementById("connectBtn").addEventListener("click", connectWallet);
  
  // Tab change handlers
  document.getElementById("myauctions-tab").addEventListener("click", () => {
    if (currentAccount) {
      loadUserAuctions(currentAccount);
    }
  });
  
  document.getElementById("mybids-tab").addEventListener("click", () => {
    if (currentAccount) {
      loadUserBids(currentAccount);
    }
  });
  
  document.getElementById("create-tab").addEventListener("click", () => {
    if (currentAccount) {
      loadUserNFTs(currentAccount);
    }
  });
  
  // Form handlers
  document.getElementById("createAuctionForm").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!currentAccount) {
      showError("Please connect your wallet first");
      return;
    }
    
    if (!selectedNFT) {
      showError("Please select an NFT first");
      return;
    }
    
    const reservePrice = document.getElementById("reservePrice").value;
    const duration = document.getElementById("duration").value;
    
    createNewAuction(selectedNFT.contract, selectedNFT.tokenId, reservePrice, duration);
  });
  
  // Bid modal setup
  document.getElementById("placeBidBtn").addEventListener("click", () => {
    const auctionId = document.getElementById("bidAuctionId").value;
    const bidAmount = document.getElementById("bidAmount").value;
    
    placeBid(auctionId, bidAmount);
    const bidModal = bootstrap.Modal.getInstance(document.getElementById('bidModal'));
    bidModal.hide();
  });
  
  // Navigation buttons
  document.getElementById("createFirstAuctionBtn")?.addEventListener("click", () => {
    document.getElementById("create-tab").click();
  });
  
  document.getElementById("exploreToBidBtn")?.addEventListener("click", () => {
    document.getElementById("explore-tab").click();
  });
  
  // Check if wallet is already connected
  checkConnection();
});

// Initialize Alchemy Web3
function initAlchemyWeb3() {
  try {
    if (window.AlchemyWeb3) {
      console.log("Initializing AlchemyWeb3");
      alchemyWeb3 = AlchemyWeb3.createAlchemyWeb3(ALCHEMY_RPC_URL);
      console.log("AlchemyWeb3 initialized successfully");
      return true;
    }
    console.error("AlchemyWeb3 not available");
    return false;
  } catch (err) {
    console.error("Error initializing AlchemyWeb3:", err);
    return false;
  }
}

// Check if wallet is connected
async function checkConnection() {
  if (window.ethereum) {
    try {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      if (accounts.length > 0) {
        // Auto-connect if user has previously connected
        await connectWallet();
      }
    } catch (error) {
      console.error("Failed to check connection:", error);
    }
  }
}

// Connect wallet
async function connectWallet() {
  try {
    if (!window.ethereum) {
      showError("MetaMask not detected! Please install MetaMask to use this application.");
      return;
    }
    
    // Request account access
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    currentAccount = accounts[0];
    
    // Check if user is on the Base network
    const chainId = await window.ethereum.request({ method: 'eth_chainId' });
    if (chainId !== BASE_NETWORK.chainId) {
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: BASE_NETWORK.chainId }],
        });
      } catch (switchError) {
        // This error code indicates that the chain has not been added to MetaMask
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [BASE_NETWORK],
          });
        } else {
          throw switchError;
        }
      }
    }
    
    // Initialize providers and contracts
    provider = new ethers.providers.Web3Provider(window.ethereum);
    signer = provider.getSigner();
    readOnlyProvider = new ethers.providers.JsonRpcProvider(RPC_URL);
    
    // Create contract instances
    readOnlyAuctionContract = new ethers.Contract(CONTRACT_ADDRESS, AUCTION_ABI, readOnlyProvider);
    auctionContract = readOnlyAuctionContract.connect(signer);
    
    // Initialize Alchemy Web3
    initAlchemyWeb3();
    
    // Update UI
    document.getElementById("connect-section").style.display = "none";
    document.getElementById("account-section").style.display = "block";
    document.getElementById("app-content").style.display = "block";
    document.getElementById("walletAddress").textContent = `${currentAccount.slice(0,6)}...${currentAccount.slice(-4)}`;
    
    // Event listeners for account/chain changes
    window.ethereum.on('accountsChanged', (accounts) => {
      window.location.reload();
    });
    
    window.ethereum.on('chainChanged', () => {
      window.location.reload();
    });
    
    // Load data
    showSuccess("Wallet connected successfully!");
    await loadActiveAuctions();
    
  } catch (error) {
    console.error("Connection error:", error);
    showError(error.message || "Failed to connect wallet");
  }
}

// Check if user is on Base Network
async function checkBaseNetwork() {
  const chainId = await window.ethereum.request({ method: 'eth_chainId' });
  if (chainId !== BASE_NETWORK.chainId) {
    showError("Please connect to Base Network to load your NFTs");
    return false;
  }
  return true;
}

// Load NFTs from user's wallet using Alchemy API
async function loadUserNFTs(userAddress, pageKey = null) {
  const loadingElement = document.getElementById("loading-nfts");
  const noNftsMessage = document.getElementById("no-nfts");
  const nftSelection = document.getElementById("nft-selection");
  const nftList = document.getElementById("nftList");
  const auctionDetails = document.getElementById("auction-details");
  
  // Reset state solo en la primera carga
  if (!pageKey) {
    ownedNFTs = [];
    selectedNFT = null;
    
    // Show loading indicator
    loadingElement.style.display = "block";
    noNftsMessage.style.display = "none";
    nftSelection.style.display = "none";
    auctionDetails.style.display = "none";
    nftList.innerHTML = "";
  } else {
    // Mostrar indicador de carga adicional al final de la lista
    const loadingMore = document.createElement("div");
    loadingMore.id = "loading-more-nfts";
    loadingMore.className = "text-center py-3 w-100";
    loadingMore.innerHTML = `
      <div class="loading-spinner d-inline-block"></div>
      <p class="mt-2">Loading more NFTs...</p>
    `;
    nftList.appendChild(loadingMore);
  }
  
  try {
    isLoadingMoreNFTs = true;
    
    // Check if we're on Base Network
    if (!(await checkBaseNetwork())) {
      isLoadingMoreNFTs = false;
      return;
    }
    
    // Check if Alchemy is initialized
    if (!alchemyWeb3) {
      if (!initAlchemyWeb3()) {
        isLoadingMoreNFTs = false;
        throw new Error("Alchemy Web3 could not be initialized");
      }
    }
    
    // Construir URL con o sin pageKey
    let url = `https://base-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_API_KEY}/getNFTsForOwner?owner=${userAddress}&withMetadata=true&pageSize=20`;
    
    if (pageKey) {
      url += `&pageKey=${pageKey}`;
    }
    
    // Use Alchemy's getNftsForOwner method to get all NFTs owned by the user
    const alchemyResponse = await fetch(url);
    
    if (!alchemyResponse.ok) {
      isLoadingMoreNFTs = false;
      throw new Error("Failed to fetch NFTs from Alchemy API");
    }
    
    const nftsData = await alchemyResponse.json();
    console.log("NFT data received:", nftsData);
    
    // Guardar el pageKey para la próxima carga
    nftPageKey = nftsData.pageKey || null;
    
    // Process NFTs
    if (nftsData.ownedNfts && nftsData.ownedNfts.length > 0) {
      const newNFTs = nftsData.ownedNfts.map(nft => {
        return {
          contract: nft.contract.address,
          tokenId: parseInt(nft.id.tokenId, 16),
          title: nft.title || `NFT #${parseInt(nft.id.tokenId, 16)}`,
          description: nft.description || "",
          media: nft.media && nft.media.length > 0 ? nft.media[0].gateway : "",
          metadata: nft.metadata
        };
      });
      
      // Añadir los nuevos NFTs al array existente
      ownedNFTs = [...ownedNFTs, ...newNFTs];
      
      // Remover indicador de carga adicional si existe
      const loadingMore = document.getElementById("loading-more-nfts");
      if (loadingMore) {
        loadingMore.remove();
      }
      
      // Display NFTs
      renderNFTGrid(nftList, pageKey ? false : true);
      
      if (!pageKey) {
        loadingElement.style.display = "none";
        nftSelection.style.display = "block";
      }
      
      // Si hay más NFTs, configurar el observador de intersección para cargar más
      if (nftPageKey) {
        setupInfiniteScroll(userAddress);
      }
    } else if (!pageKey) {
      // Solo mostrar mensaje de "no NFTs" en la primera carga
      loadingElement.style.display = "none";
      noNftsMessage.style.display = "block";
    } else {
      // Remover indicador de carga adicional si existe
      const loadingMore = document.getElementById("loading-more-nfts");
      if (loadingMore) {
        loadingMore.remove();
      }
    }
    
    isLoadingMoreNFTs = false;
  } catch (error) {
    console.error("Error loading NFTs:", error);
    if (error.response) console.error("Response data:", await error.response.text());
    
    if (!pageKey) {
      // Solo mostrar error en la primera carga
      showError("Failed to load your NFTs. Please try again later.");
      loadingElement.style.display = "none";
      noNftsMessage.style.display = "block";
    } else {
      // Remover indicador de carga adicional si existe
      const loadingMore = document.getElementById("loading-more-nfts");
      if (loadingMore) {
        loadingMore.remove();
      }
    }
    
    isLoadingMoreNFTs = false;
  }
}

// Configurar observador de intersección para carga infinita
function setupInfiniteScroll(userAddress) {
  // Asegurarse de que existe el elemento sentinel
  let sentinel = document.getElementById("nft-sentinel");
  if (!sentinel) {
    sentinel = document.createElement("div");
    sentinel.id = "nft-sentinel";
    sentinel.style.height = "10px";
    sentinel.style.width = "100%";
    document.getElementById("nftList").appendChild(sentinel);
  }
  
  // Crear un nuevo observador de intersección
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && nftPageKey && !isLoadingMoreNFTs) {
        // Cargar más NFTs cuando el sentinel es visible
        loadUserNFTs(userAddress, nftPageKey);
      }
    });
  }, { rootMargin: "100px" });
  
  // Observar el sentinel
  observer.observe(sentinel);
}

// Render NFT grid for selection
function renderNFTGrid(container, clearContainer = true) {
  // Solo limpiar el contenedor si es necesario (primera carga)
  if (clearContainer) {
    container.innerHTML = "";
  } else {
    // Asegurarse de que el sentinel se elimina para volver a añadirlo al final
    const sentinel = document.getElementById("nft-sentinel");
    if (sentinel) {
      sentinel.remove();
    }
  }
  
  // Determinar el índice de inicio para añadir nuevos NFTs
  const startIndex = clearContainer ? 0 : container.querySelectorAll(".auction-card").length;
  
  for (let i = startIndex; i < ownedNFTs.length; i++) {
    const nft = ownedNFTs[i];
    const index = i;
    const isSelected = selectedNFT && selectedNFT.contract === nft.contract && selectedNFT.tokenId === nft.tokenId;
    
    const nftCard = document.createElement("div");
    nftCard.className = `auction-card ${isSelected ? 'border-primary' : ''}`;
    nftCard.onclick = () => selectNFT(index);
    
    // Use NFT image from metadata if available, or placeholder
    const imageUrl = nft.media || "https://placehold.co/400x400?text=NFT+Image";
    
    nftCard.innerHTML = `
      <div class="nft-image-container">
        <img src="${imageUrl}" class="nft-image" alt="${nft.title}" onerror="this.src='https://placehold.co/400x400?text=NFT+Image'">
      </div>
      <div class="token-info">
        <h3 class="auction-title">${nft.title}</h3>
        <p>Contract: ${formatAddress(nft.contract)}</p>
        <p>Token ID: ${nft.tokenId}</p>
        ${isSelected ? '<span class="auction-status status-live">Selected</span>' : ''}
      </div>
    `;
    
    container.appendChild(nftCard);
  }
  
  // Añadir el sentinel para infinite scroll
  if (nftPageKey) {
    const sentinel = document.createElement("div");
    sentinel.id = "nft-sentinel";
    sentinel.style.height = "10px";
    sentinel.style.width = "100%";
    container.appendChild(sentinel);
  }
}

// Select NFT for auction
function selectNFT(index) {
  selectedNFT = ownedNFTs[index];
  
  // Update display
  renderNFTGrid(document.getElementById("nftList"));
  
  // Show selected NFT in the auction details
  const selectedNftDisplay = document.getElementById("selectedNftDisplay");
  const auctionDetails = document.getElementById("auction-details");
  
  selectedNftDisplay.innerHTML = `
    <img src="${selectedNFT.media || 'https://placehold.co/400x400?text=NFT+Image'}" class="me-3" style="width: 50px; height: 50px; object-fit: contain;" onerror="this.src='https://placehold.co/400x400?text=NFT+Image'">
    <div>
      <strong>${selectedNFT.title}</strong>
      <div>Token ID: ${selectedNFT.tokenId}</div>
    </div>
  `;
  
  // Set hidden fields
  document.getElementById("nftContract").value = selectedNFT.contract;
  document.getElementById("tokenId").value = selectedNFT.tokenId;
  
  // Show auction details
  auctionDetails.style.display = "block";
  
  showSuccess("NFT selected for auction");
}

// Show error message
function showError(message) {
  const errorAlert = document.getElementById("errorAlert");
  errorAlert.textContent = message;
  errorAlert.style.display = "block";
  
  setTimeout(() => {
    errorAlert.style.display = "none";
  }, 5000);
}

// Show success message
function showSuccess(message) {
  const successAlert = document.getElementById("successAlert");
  successAlert.textContent = message;
  successAlert.style.display = "block";
  
  setTimeout(() => {
    successAlert.style.display = "none";
  }, 5000);
}

// Helper functions for displaying auction data
function formatEther(wei) {
  return ethers.utils.formatUnits(wei, 18);
}

function formatAddress(address) {
  if (!address) return "";
  return `${address.slice(0,6)}...${address.slice(-4)}`;
}

function formatTimeRemaining(endTime) {
  const now = Math.floor(Date.now() / 1000);
  const secondsRemaining = endTime - now;
  
  if (secondsRemaining <= 0) return "Ended";
  
  const days = Math.floor(secondsRemaining / 86400);
  const hours = Math.floor((secondsRemaining % 86400) / 3600);
  const minutes = Math.floor((secondsRemaining % 3600) / 60);
  const seconds = secondsRemaining % 60;
  
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

// Load active auctions for explore tab
async function loadActiveAuctions() {
  const loadingElement = document.getElementById("loading-auctions");
  const noAuctionsMessage = document.getElementById("no-auctions-message");
  const auctionsList = document.getElementById("auctionsList");
  
  loadingElement.style.display = "block";
  noAuctionsMessage.style.display = "none";
  auctionsList.innerHTML = "";
  
  try {
    const count = await readOnlyAuctionContract.getActiveAuctionsCount();
    const pages = Math.ceil(count.toNumber() / 50);
    let allIds = [];
    
    for (let i = 0; i < pages; i++) {
      const ids = await readOnlyAuctionContract.getActiveAuctions(i, 50);
      allIds = allIds.concat(ids.map(id => id.toNumber()));
    }
    
    if (allIds.length === 0) {
      loadingElement.style.display = "none";
      noAuctionsMessage.style.display = "block";
      return;
    }
    
    const details = await readOnlyAuctionContract.getManyAuctionDetails(allIds);
    const filter = document.getElementById("filterSelect").value;
    
    const now = Math.floor(Date.now() / 1000);
    const filtered = details.filter((auction, index) => {
      const timeLeft = auction.endTime - now;
      if (filter === "active") return auction.active;
      if (filter === "reserveMet") return auction.highestBid >= auction.reservePrice;
      if (filter === "endingSoon") return auction.active && timeLeft < 900;
      return true;
    });
    
    // Sort auctions - ending soon first
    filtered.sort((a, b) => a.endTime - b.endTime);
    
    if (filtered.length === 0) {
      loadingElement.style.display = "none";
      noAuctionsMessage.style.display = "block";
      return;
    }
    
    for (let i = 0; i < filtered.length; i++) {
      const auction = filtered[i];
      const auctionId = allIds[i];
      
      await renderAuction(auction, auctionId, auctionsList);
    }
    
    loadingElement.style.display = "none";
    
  } catch (error) {
    console.error("Error loading auctions:", error);
    showError("Failed to load auctions. Please try again later.");
    loadingElement.style.display = "none";
    noAuctionsMessage.style.display = "block";
  }
}

// Load user created auctions
async function loadUserAuctions(userAddress) {
  const loadingElement = document.getElementById("loading-my-auctions");
  const noAuctionsMessage = document.getElementById("no-my-auctions");
  const auctionsList = document.getElementById("myAuctionsList");
  
  loadingElement.style.display = "block";
  noAuctionsMessage.style.display = "none";
  auctionsList.innerHTML = "";
  
  try {
    const auctionIds = await readOnlyAuctionContract.getUserAuctions(userAddress);
    
    if (auctionIds.length === 0) {
      loadingElement.style.display = "none";
      noAuctionsMessage.style.display = "block";
      return;
    }
    
    const details = await readOnlyAuctionContract.getManyAuctionDetails(auctionIds);
    
    for (let i = 0; i < details.length; i++) {
      const auction = details[i];
      const auctionId = auctionIds[i].toNumber();
      
      await renderAuction(auction, auctionId, auctionsList, true);
    }
    
    loadingElement.style.display = "none";
    
  } catch (error) {
    console.error("Error loading user auctions:", error);
    showError("Failed to load your auctions. Please try again later.");
    loadingElement.style.display = "none";
    noAuctionsMessage.style.display = "block";
  }
}

// Load user bids
async function loadUserBids(userAddress) {
  const loadingElement = document.getElementById("loading-my-bids");
  const noBidsMessage = document.getElementById("no-my-bids");
  const bidsList = document.getElementById("myBidsList");
  
  loadingElement.style.display = "block";
  noBidsMessage.style.display = "none";
  bidsList.innerHTML = "";
  
  try {
    const auctionIds = await readOnlyAuctionContract.getUserBids(userAddress);
    
    if (auctionIds.length === 0) {
      loadingElement.style.display = "none";
      noBidsMessage.style.display = "block";
      return;
    }
    
    const details = await readOnlyAuctionContract.getManyAuctionDetails(auctionIds);
    
    for (let i = 0; i < details.length; i++) {
      const auction = details[i];
      const auctionId = auctionIds[i].toNumber();
      
      // Check if user is highest bidder and highlight
      const isHighestBidder = auction.highestBidder.toLowerCase() === userAddress.toLowerCase();
      
      await renderAuction(auction, auctionId, bidsList, false, isHighestBidder);
    }
    
    loadingElement.style.display = "none";
    
  } catch (error) {
    console.error("Error loading user bids:", error);
    showError("Failed to load your bids. Please try again later.");
    loadingElement.style.display = "none";
    noBidsMessage.style.display = "block";
  }
}

// Render a single auction card
async function renderAuction(auction, auctionId, container, isOwner = false, isHighestBidder = false) {
  const now = Math.floor(Date.now() / 1000);
  const timeRemaining = auction.endTime - now;
  const endingSoon = auction.active && timeRemaining < 900;
  const reserveMet = auction.highestBid >= auction.reservePrice;
  
  // Create auction card
  const auctionCard = document.createElement('div');
  auctionCard.className = 'auction-card';
  
  let cardClass = '';
  if (isHighestBidder) cardClass += ' border-success';
  else if (endingSoon) cardClass += ' border-warning';
  else if (reserveMet) cardClass += ' border-primary';
  
  auctionCard.className = `auction-card ${cardClass}`;
  
  // Try to fetch NFT image from Alchemy if possible
  let imageUrl = 'https://placehold.co/400x400?text=NFT+Image';
  
  if (alchemyWeb3) {
    try {
      // Create a temporary NFT contract to get the tokenURI
      const nftContract = new ethers.Contract(auction.nftContract, ERC721_ABI, readOnlyProvider);
      const tokenURI = await nftContract.tokenURI(auction.tokenId);
      
      if (tokenURI) {
        // Try to fetch metadata
        if (tokenURI.startsWith('ipfs://')) {
          const ipfsHash = tokenURI.replace('ipfs://', '');
          const ipfsUrl = `https://ipfs.io/ipfs/${ipfsHash}`;
          
          try {
            const response = await fetch(ipfsUrl);
            const metadata = await response.json();
            
            if (metadata.image) {
              if (metadata.image.startsWith('ipfs://')) {
                const imageHash = metadata.image.replace('ipfs://', '');
                imageUrl = `https://ipfs.io/ipfs/${imageHash}`;
              } else {
                imageUrl = metadata.image;
              }
            }
          } catch (error) {
            console.warn("Failed to fetch NFT metadata:", error);
          }
        } else if (tokenURI.startsWith('http')) {
          try {
            const response = await fetch(tokenURI);
            const metadata = await response.json();
            
            if (metadata.image) {
              imageUrl = metadata.image;
            }
          } catch (error) {
            console.warn("Failed to fetch NFT metadata:", error);
          }
        }
      }
    } catch (error) {
      console.warn("Failed to load NFT image:", error);
    }
  }
  
  // Create status badges
  let statusBadges = '';
  
  if (endingSoon) {
    statusBadges += '<span class="auction-status status-ending">🔥 Ending Soon</span>';
  }
  
  if (reserveMet) {
    statusBadges += '<span class="auction-status status-reserve-met">✅ Reserve Met</span>';
  }
  
  if (isHighestBidder) {
    statusBadges += '<span class="auction-status status-live">🏆 You\'re Winning</span>';
  }
  
  if (!auction.active) {
    statusBadges += '<span class="auction-status">Inactive</span>';
  }
  
  if (auction.finalized) {
    statusBadges += '<span class="auction-status">Finalized</span>';
  }
  
  // Create action buttons
  let actionButtons = '';
  
  if (auction.active && !auction.finalized) {
    if (isOwner && auction.endTime <= now) {
      actionButtons = `<button class="btn-action w-100" onclick="finalizeAuction(${auctionId})">Finalize Auction</button>`;
    } else if (isOwner && auction.highestBid.isZero()) {
      actionButtons = `<button class="btn-action w-100" onclick="cancelAuction(${auctionId})">Cancel Auction</button>`;
    } else if (!isOwner) {
      actionButtons = `<button class="btn-action w-100" onclick="openBidModal(${auctionId}, '${auction.highestBid}', '${auction.reservePrice}', '${auction.nftContract}', ${auction.tokenId})">Place Bid</button>`;
    }
  } else if (isOwner && !auction.active && auction.finalized && auction.highestBidder === ethers.constants.AddressZero) {
    actionButtons = `<button class="btn-action w-100" onclick="showRelistModal(${auctionId})">Relist Auction</button>`;
  }
  
  // Populate auction card
  auctionCard.innerHTML = `
    <div class="nft-image-container">
      <img src="${imageUrl}" class="nft-image" alt="NFT #${auction.tokenId}" onerror="this.src='https://placehold.co/400x400?text=NFT+Image'">
    </div>
    <div class="auction-info">
      <h3 class="auction-title">NFT #${auction.tokenId}</h3>
      <div class="mb-2">${statusBadges}</div>
      <p><strong>Contract:</strong> ${formatAddress(auction.nftContract)}</p>
      <p><strong>Seller:</strong> ${formatAddress(auction.seller)}</p>
      <p><strong>Reserve:</strong> ${formatEther(auction.reservePrice)} ADRIAN</p>
      <p><strong>Highest Bid:</strong> ${formatEther(auction.highestBid)} ADRIAN</p>
      <p><strong>Time Remaining:</strong> ${formatTimeRemaining(auction.endTime)}</p>
      <div class="mt-3">
        ${actionButtons}
      </div>
    </div>
  `;
  
  container.appendChild(auctionCard);
}

// Open bid modal
function openBidModal(auctionId, currentBid, reservePrice, nftContract, tokenId) {
  document.getElementById("bidAuctionId").value = auctionId;
  
  // Calculate minimum bid
  const currentBidValue = ethers.BigNumber.from(currentBid);
  const reservePriceValue = ethers.BigNumber.from(reservePrice);
  
  let minBidAmount;
  if (currentBidValue.gt(0)) {
    // If there's already a bid, minimum is current bid + 0.000001
    minBidAmount = parseFloat(ethers.utils.formatUnits(currentBidValue, 18)) + 0.000001;
  } else {
    // If no bids yet, minimum is reserve price
    minBidAmount = parseFloat(ethers.utils.formatUnits(reservePriceValue, 18));
  }
  
  document.getElementById("minBid").textContent = minBidAmount.toFixed(6);
  document.getElementById("reservePriceDisplay").textContent = ethers.utils.formatUnits(reservePriceValue, 18);
  document.getElementById("bidAmount").min = minBidAmount;
  document.getElementById("bidAmount").value = minBidAmount;
  
  // Try to load NFT image for the modal
  loadNFTForBidModal(nftContract, tokenId);
  
  // Open modal
  const modal = new bootstrap.Modal(document.getElementById('bidModal'));
  modal.show();
}

// Load NFT image for bid modal
async function loadNFTForBidModal(nftContract, tokenId) {
  const bidNftDisplay = document.getElementById("bid-nft-display");
  bidNftDisplay.innerHTML = `<div class="text-center"><div class="loading-spinner"></div><p>Loading NFT details...</p></div>`;
  
  let imageUrl = 'https://placehold.co/400x400?text=NFT+Image';
  let nftName = `NFT #${tokenId}`;
  
  try {
    if (alchemyWeb3) {
      // Try to get metadata using Alchemy
      const nftContract = new ethers.Contract(nftContract, ERC721_ABI, readOnlyProvider);
      const tokenURI = await nftContract.tokenURI(tokenId);
      
      if (tokenURI) {
        let metadata;
        
        // Handle IPFS URIs
        if (tokenURI.startsWith('ipfs://')) {
          const ipfsHash = tokenURI.replace('ipfs://', '');
          const ipfsUrl = `https://ipfs.io/ipfs/${ipfsHash}`;
          
          const response = await fetch(ipfsUrl);
          metadata = await response.json();
        } else if (tokenURI.startsWith('http')) {
          const response = await fetch(tokenURI);
          metadata = await response.json();
        }
        
        if (metadata) {
          if (metadata.image) {
            if (metadata.image.startsWith('ipfs://')) {
              const imageHash = metadata.image.replace('ipfs://', '');
              imageUrl = `https://ipfs.io/ipfs/${imageHash}`;
            } else {
              imageUrl = metadata.image;
            }
          }
          
          if (metadata.name) {
            nftName = metadata.name;
          }
        }
      }
    }
  } catch (error) {
    console.warn("Error loading NFT details:", error);
  }
  
  // Update modal with NFT details
  bidNftDisplay.innerHTML = `
    <div class="d-flex align-items-center">
      <img src="${imageUrl}" alt="${nftName}" class="me-3" style="width: 100px; height: 100px; object-fit: contain;" onerror="this.src='https://placehold.co/400x400?text=NFT+Image'">
      <div>
        <h4>${nftName}</h4>
        <p>Token ID: ${tokenId}</p>
        <p>Contract: ${formatAddress(nftContract)}</p>
      </div>
    </div>
  `;
}

// Se llamará cuando el usuario realice la acción de ofertar
async function placeBid(auctionId, bidAmount) {
  if (!window.ethereum || !currentAccount) {
    alert("Por favor, conecta tu wallet primero");
    return;
  }
  
  try {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    
    // Verificar y aprobar tokens ADRIAN
    const tokenContract = new ethers.Contract(ADRIAN_TOKEN_ADDRESS, ERC20_ABI, signer);
    const bidInWei = ethers.utils.parseEther(bidAmount.toString());
    
    // Comprobar allowance
    const allowance = await tokenContract.allowance(currentAccount, CONTRACT_ADDRESS);
    if (allowance.lt(bidInWei)) {
      const approveTx = await tokenContract.approve(CONTRACT_ADDRESS, ethers.constants.MaxUint256);
      await approveTx.wait();
      alert("Tokens ADRIAN aprobados correctamente");
    }
    
    // Realizar la oferta
    const contract = new ethers.Contract(CONTRACT_ADDRESS, AUCTION_ABI, signer);
    const tx = await contract.placeBid(auctionId, bidInWei);
    
    // Esperar confirmación
    await tx.wait();
    
    alert("¡Oferta realizada con éxito!");
    loadActiveAuctions();
    
    // Recargar la pestaña de ofertas si está activa
    if (document.getElementById("mybids-tab").classList.contains("active")) {
      loadUserBids(currentAccount);
    }
    
  } catch (error) {
    console.error("Error al realizar la oferta:", error);
    alert("Error al realizar la oferta: " + (error.message || error));
  }
}

// Se llamará cuando el usuario quiera finalizar una subasta
async function finalizeAuction(auctionId) {
  if (!window.ethereum || !currentAccount) {
    alert("Por favor, conecta tu wallet primero");
    return;
  }
  
  try {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    
    const contract = new ethers.Contract(CONTRACT_ADDRESS, AUCTION_ABI, signer);
    
    // Realizar la transacción
    const tx = await contract.endAuction(auctionId);
    await tx.wait();
    
    alert("¡Subasta finalizada con éxito!");
    
    // Recargar las vistas
    loadActiveAuctions();
    if (document.getElementById("myauctions-tab").classList.contains("active")) {
      loadUserAuctions(currentAccount);
    }
    
  } catch (error) {
    console.error("Error al finalizar la subasta:", error);
    alert("Error al finalizar la subasta: " + (error.message || error));
  }
}

// Se llamará cuando el usuario quiera cancelar una subasta
async function cancelAuction(auctionId) {
  if (!window.ethereum || !currentAccount) {
    alert("Por favor, conecta tu wallet primero");
    return;
  }
  
  if (!confirm("¿Estás seguro de que deseas cancelar esta subasta? Esta acción no se puede deshacer.")) {
    return;
  }
  
  try {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    
    const contract = new ethers.Contract(CONTRACT_ADDRESS, AUCTION_ABI, signer);
    
    // Realizar la transacción
    const tx = await contract.cancelAuction(auctionId);
    await tx.wait();
    
    alert("Subasta cancelada correctamente");
    
    // Recargar las vistas
    loadActiveAuctions();
    if (document.getElementById("myauctions-tab").classList.contains("active")) {
      loadUserAuctions(currentAccount);
    }
    
  } catch (error) {
    console.error("Error al cancelar la subasta:", error);
    alert("Error al cancelar la subasta: " + (error.message || error));
  }
}

// Función para crear una nueva subasta
async function createNewAuction(nftContract, tokenId, reservePrice, durationHours) {
  if (!window.ethereum || !currentAccount) {
    alert("Por favor, conecta tu wallet primero");
    return;
  }
  
  try {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    
    // Primero aprobamos el contrato NFT
    const nftContractInstance = new ethers.Contract(nftContract, ERC721_ABI, signer);
    
    // Comprobar si ya está aprobado
    const isApproved = await nftContractInstance.isApprovedForAll(currentAccount, CONTRACT_ADDRESS);
    if (!isApproved) {
      const approveTx = await nftContractInstance.setApprovalForAll(CONTRACT_ADDRESS, true);
      await approveTx.wait();
      alert("NFT aprobado correctamente");
    }
    
    // Crear la subasta
    const contract = new ethers.Contract(CONTRACT_ADDRESS, AUCTION_ABI, signer);
    const reservePriceWei = ethers.utils.parseEther(reservePrice.toString());
    const durationSeconds = durationHours * 3600;
    
    const tx = await contract.createAuction(nftContract, tokenId, reservePriceWei, durationSeconds);
    await tx.wait();
    
    alert("¡Subasta creada con éxito!");
    
    // Limpiar formulario
    document.getElementById("createAuctionForm").reset();
    
    // Ir a la pestaña de mis subastas
    document.getElementById("myauctions-tab").click();
    
  } catch (error) {
    console.error("Error al crear la subasta:", error);
    alert("Error al crear la subasta: " + (error.message || error));
  }
}

// Funciones adicionales que podrían ser útiles más adelante
function showAuctionDetails(auctionId) {
  // Implementar para mostrar detalles completos de una subasta específica
  console.log("Mostrar detalles de la subasta:", auctionId);
}

function createNewAuction() {
  // Implementar para crear una nueva subasta
  console.log("Crear nueva subasta");
} 