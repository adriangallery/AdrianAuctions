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
// Variables para paginación de NFTs
let nftPageKey = null; // Almacenará la clave de paginación devuelta por Alchemy
let nftPageSize = 20;
let hasMoreNfts = true;

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
      // Reiniciar estado de paginación cuando se cambia a la pestaña
      nftPageKey = null;
      ownedNFTs = [];
      hasMoreNfts = true;
      loadUserNFTs(currentAccount);
    }
  });
  
  // Botón Load More NFTs
  document.getElementById("loadMoreNftsBtn")?.addEventListener("click", () => {
    if (currentAccount && hasMoreNfts) {
      loadUserNFTs(currentAccount, true); // true = append mode
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

// Función modificada para extraer mejor las URLs de imágenes NFT
async function loadUserNFTs(userAddress, appendMode = false) {
  const loadingElement = document.getElementById("loading-nfts");
  const noNftsMessage = document.getElementById("no-nfts");
  const nftSelection = document.getElementById("nft-selection");
  const nftList = document.getElementById("nftList");
  const auctionDetails = document.getElementById("auction-details");
  const loadMoreContainer = document.getElementById("load-more-container");
  const loadMoreButton = document.getElementById("loadMoreNftsBtn");
  
  // Reset state si no estamos en modo append
  if (!appendMode) {
    ownedNFTs = [];
    selectedNFT = null;
    nftPageKey = null;
  }
  
  // Show loading indicator
  if (!appendMode) {
    loadingElement.style.display = "block";
    noNftsMessage.style.display = "none";
    nftSelection.style.display = "none";
    auctionDetails.style.display = "none";
    nftList.innerHTML = "";
    loadMoreContainer.style.display = "none";
  } else {
    // En modo append, mostrar indicador de carga en el botón
    loadMoreButton.textContent = "Loading...";
    loadMoreButton.disabled = true;
  }
  
  try {
    // Check if Alchemy is initialized
    if (!alchemyWeb3) {
      if (!initAlchemyWeb3()) {
        throw new Error("Alchemy Web3 could not be initialized");
      }
    }
    
    // Construir URL con paginación usando el pageKey si existe
    let alchemyUrl = `https://base-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_API_KEY}/getNFTsForOwner?owner=${userAddress}&withMetadata=true&pageSize=${nftPageSize}`;
    if (nftPageKey && appendMode) {
      alchemyUrl += `&pageKey=${encodeURIComponent(nftPageKey)}`;
    }
    
    console.log(`Solicitando NFTs con URL: ${alchemyUrl}`);
    
    // Use Alchemy's getNFTsForOwner method to get all NFTs owned by the user with paginación
    const alchemyResponse = await fetch(alchemyUrl);
    
    if (!alchemyResponse.ok) {
      throw new Error("Failed to fetch NFTs from Alchemy API");
    }
    
    const nftsData = await alchemyResponse.json();
    console.log(`Página NFT data received:`, nftsData);
    
    // Guardar la clave de paginación para la próxima solicitud
    nftPageKey = nftsData.pageKey;
    console.log("Nueva pageKey:", nftPageKey);
    
    // Verificar si hay más páginas disponibles
    hasMoreNfts = nftPageKey !== undefined && nftPageKey !== null;
    console.log("¿Hay más NFTs para cargar?", hasMoreNfts ? "Sí" : "No");
    
    // Imprimir un ejemplo completo del primer NFT para depuración
    if (nftsData.ownedNfts && nftsData.ownedNfts.length > 0) {
      console.log("Ejemplo de estructura NFT:", JSON.stringify(nftsData.ownedNfts[0], null, 2));
    }
    
    // Process NFTs
    if (nftsData.ownedNfts && nftsData.ownedNfts.length > 0) {
      const newNFTs = nftsData.ownedNfts.map(nft => {
        try {
          // Verificar que existan las propiedades necesarias
          if (!nft || !nft.contract) {
            console.error("NFT missing required properties:", nft);
            return null;
          }
          
          console.log("Procesando NFT completo:", nft);
          
          // Extraer tokenId - podría estar directamente en nft.tokenId o en nft.id.tokenId
          let tokenId;
          if (nft.tokenId) {
            // Si tokenId está directamente en el objeto
            tokenId = nft.tokenId;
          } else if (nft.id && nft.id.tokenId) {
            // Si tokenId está en nft.id.tokenId (formato anterior)
            tokenId = nft.id.tokenId;
          } else {
            console.error("No tokenId found in NFT:", nft);
            return null;
          }
          
          // Convertir tokenId a entero (podría ser string en formato decimal o hex)
          let tokenIdInt;
          if (typeof tokenId === 'number') {
            tokenIdInt = tokenId;
          } else if (tokenId.startsWith('0x')) {
            tokenIdInt = parseInt(tokenId, 16);
          } else {
            tokenIdInt = parseInt(tokenId, 10);
          }
          
          if (isNaN(tokenIdInt)) {
            console.error("Invalid tokenId format:", tokenId);
            return null;
          }
          
          // Extraer título/nombre - podría estar en nft.title o nft.name
          let title = `NFT #${tokenIdInt}`;
          
          // Intentar obtener un título más descriptivo
          if (nft.title) {
            title = nft.title;
          } else if (nft.name) {
            title = nft.name;
          } else if (nft.metadata && nft.metadata.name) {
            title = nft.metadata.name;
          } else if (nft.contract && nft.contract.name) {
            title = `${nft.contract.name} #${tokenIdInt}`;
          }
          
          console.log(`NFT #${tokenIdInt} Propiedades principales:`, {
            contract: nft.contract,
            media: nft.media,
            raw: nft.raw,
            metadata: nft.metadata
          });
          
          // MÉTODO MEJORADO PARA EXTRAER LA URL DE LA IMAGEN
          let mediaUrl = "";
          
          // 1. Buscar en raw data - a veces la respuesta de Alchemy tiene la estructura completa directa
          if (nft.raw && nft.raw.metadata && nft.raw.metadata.image) {
            mediaUrl = nft.raw.metadata.image;
            console.log("Imagen encontrada en raw.metadata.image:", mediaUrl);
          }
          
          // 2. Intentar extraer la URL de la imagen de varias ubicaciones posibles
          if (!mediaUrl && nft.media && Array.isArray(nft.media) && nft.media.length > 0) {
            console.log("Buscando en media array:", nft.media);
            // Revisar todas las posibles propiedades donde podría estar la imagen
            const mediaSources = ['gateway', 'raw', 'thumbnail', 'format'];
            
            for (const source of mediaSources) {
              if (nft.media[0][source] && typeof nft.media[0][source] === 'string') {
                mediaUrl = nft.media[0][source];
                console.log(`Imagen encontrada en media[0].${source}:`, mediaUrl);
                break;
              }
            }
          }
          
          // 3. Si no encontramos la URL en media, buscar en otras ubicaciones
          if (!mediaUrl && nft.metadata) {
            console.log("Buscando en metadata:", nft.metadata);
            // Buscar en varias propiedades que comúnmente contienen URLs de imágenes
            const imageProps = ['image', 'image_url', 'imageUrl', 'imageURI', 'image_uri', 'imageData'];
            
            for (const prop of imageProps) {
              if (nft.metadata[prop] && typeof nft.metadata[prop] === 'string') {
                mediaUrl = nft.metadata[prop];
                console.log(`Imagen encontrada en metadata.${prop}:`, mediaUrl);
                break;
              }
            }
          }
          
          // 4. Si no encontramos la URL en metadata, buscar directamente en el objeto
          if (!mediaUrl) {
            console.log("Buscando en el objeto NFT principal");
            const imageProps = ['image', 'image_url', 'imageUrl', 'imageURI', 'image_uri'];
            
            for (const prop of imageProps) {
              if (nft[prop] && typeof nft[prop] === 'string') {
                mediaUrl = nft[prop];
                console.log(`Imagen encontrada en nft.${prop}:`, mediaUrl);
                break;
              }
            }
          }
          
          // 5. Último recurso: buscar cualquier URL en cualquier propiedad
          if (!mediaUrl && nft.metadata) {
            console.log("Buscando cualquier URL en metadata");
            for (const key in nft.metadata) {
              const value = nft.metadata[key];
              if (typeof value === 'string' && 
                  (value.startsWith('http') || value.startsWith('ipfs://') || value.startsWith('data:image/'))) {
                mediaUrl = value;
                console.log(`Found potential image URL in metadata.${key}:`, value);
                break;
              }
            }
          }
          
          // Verificar y corregir URLs de IPFS
          if (mediaUrl && mediaUrl.startsWith('ipfs://')) {
            const originalUrl = mediaUrl;
            mediaUrl = mediaUrl.replace('ipfs://', 'https://ipfs.io/ipfs/');
            console.log(`URL IPFS convertida: ${originalUrl} -> ${mediaUrl}`);
          }
          
          // Para URLs de Arweave
          if (mediaUrl && mediaUrl.startsWith('ar://')) {
            const originalUrl = mediaUrl;
            mediaUrl = mediaUrl.replace('ar://', 'https://arweave.net/');
            console.log(`URL Arweave convertida: ${originalUrl} -> ${mediaUrl}`);
          }
          
          // Imprimir para depuración
          console.log(`NFT #${tokenIdInt} image URL FINAL:`, mediaUrl);
          
          return {
            contract: nft.contract.address,
            tokenId: tokenIdInt,
            title: title,
            description: nft.description || "",
            media: mediaUrl,
            metadata: nft.metadata
          };
        } catch (err) {
          console.error("Error processing NFT:", err, nft);
          return null;
        }
      }).filter(nft => nft !== null); // Filtrar los NFTs que fallaron al procesarse
      
      // En modo append, agregamos los nuevos NFTs a la lista existente
      if (appendMode) {
        ownedNFTs = [...ownedNFTs, ...newNFTs];
      } else {
        ownedNFTs = newNFTs;
      }
      
      console.log(`Total de NFTs procesados (${appendMode ? 'append' : 'initial'}):`, ownedNFTs.length);
      
      if (ownedNFTs.length > 0) {
        // Display NFTs
        if (appendMode) {
          // Solo renderizar los nuevos NFTs
          renderAdditionalNFTs(nftList, newNFTs);
        } else {
          renderNFTGrid(nftList);
        }
        
        loadingElement.style.display = "none";
        nftSelection.style.display = "block";
        
        // Mostrar u ocultar el botón "Load More" según corresponda
        loadMoreContainer.style.display = hasMoreNfts ? "block" : "none";
        loadMoreButton.textContent = "Load More NFTs";
        loadMoreButton.disabled = false;
      } else {
        loadingElement.style.display = "none";
        noNftsMessage.style.display = "block";
        loadMoreContainer.style.display = "none";
      }
    } else {
      if (!appendMode) {
        loadingElement.style.display = "none";
        noNftsMessage.style.display = "block";
        loadMoreContainer.style.display = "none";
      } else {
        // Si estamos en modo append pero no hay más NFTs
        loadMoreButton.textContent = "No More NFTs";
        loadMoreButton.disabled = true;
        setTimeout(() => {
          loadMoreContainer.style.display = "none";
        }, 2000);
      }
    }
  } catch (error) {
    console.error("Error loading NFTs:", error);
    if (error.response) {
      try {
        console.error("Response data:", await error.response.text());
      } catch (e) {
        console.error("Could not read response data");
      }
    }
    
    if (appendMode) {
      // Restaurar el botón en caso de error
      loadMoreButton.textContent = "Load More NFTs";
      loadMoreButton.disabled = false;
      showError("Failed to load more NFTs. Please try again.");
    } else {
      showError("Failed to load your NFTs. Please try again later.");
      loadingElement.style.display = "none";
      noNftsMessage.style.display = "block";
    }
  }
}

// Función para renderizar solo NFTs adicionales (para append)
function renderAdditionalNFTs(container, newNFTs) {
  newNFTs.forEach((nft, index) => {
    const globalIndex = ownedNFTs.findIndex(n => 
      n.contract === nft.contract && n.tokenId === nft.tokenId
    );
    
    const isSelected = selectedNFT && selectedNFT.contract === nft.contract && selectedNFT.tokenId === nft.tokenId;
    
    const nftCard = document.createElement("div");
    nftCard.className = `auction-card ${isSelected ? 'border-primary' : ''}`;
    nftCard.onclick = () => selectNFT(globalIndex);
    
    // Asegurarse de que la URL de la imagen sea una cadena válida
    const imageUrl = (typeof nft.media === 'string' && nft.media) 
      ? nft.media 
      : "https://placehold.co/400x400?text=NFT+Image";
    
    console.log(`Renderizando NFT adicional #${nft.tokenId} con imagen:`, imageUrl);
    
    nftCard.innerHTML = `
      <div class="nft-image-container">
        <img src="${imageUrl}" class="nft-image" alt="${nft.title}" 
             onerror="console.error('Error cargando imagen:', this.src); this.onerror=null; this.src='https://placehold.co/400x400?text=NFT+Image'" 
             loading="lazy">
      </div>
      <div class="token-info">
        <h3 class="auction-title">${nft.title}</h3>
        <p>Contract: ${formatAddress(nft.contract)}</p>
        <p>Token ID: ${nft.tokenId}</p>
        ${isSelected ? '<span class="auction-status status-live">Selected</span>' : ''}
      </div>
    `;
    
    container.appendChild(nftCard);
    
    // Verificar si la imagen cargó correctamente
    const img = nftCard.querySelector('.nft-image');
    img.addEventListener('load', () => {
      console.log(`NFT adicional #${nft.tokenId} image loaded successfully:`, img.src);
    });
  });
}

// Renderizar con manejo mejorado de errores de imagen
function renderNFTGrid(container) {
  container.innerHTML = "";
  
  ownedNFTs.forEach((nft, index) => {
    const isSelected = selectedNFT && selectedNFT.contract === nft.contract && selectedNFT.tokenId === nft.tokenId;
    
    const nftCard = document.createElement("div");
    nftCard.className = `auction-card ${isSelected ? 'border-primary' : ''}`;
    nftCard.onclick = () => selectNFT(index);
    
    // Asegurarse de que la URL de la imagen sea una cadena válida
    const imageUrl = (typeof nft.media === 'string' && nft.media) 
      ? nft.media 
      : "https://placehold.co/400x400?text=NFT+Image";
    
    console.log(`Renderizando NFT #${nft.tokenId} con imagen:`, imageUrl);
    
    nftCard.innerHTML = `
      <div class="nft-image-container">
        <img src="${imageUrl}" class="nft-image" alt="${nft.title}" 
             onerror="console.error('Error cargando imagen:', this.src); this.onerror=null; this.src='https://placehold.co/400x400?text=NFT+Image'" 
             loading="lazy">
      </div>
      <div class="token-info">
        <h3 class="auction-title">${nft.title}</h3>
        <p>Contract: ${formatAddress(nft.contract)}</p>
        <p>Token ID: ${nft.tokenId}</p>
        ${isSelected ? '<span class="auction-status status-live">Selected</span>' : ''}
      </div>
    `;
    
    container.appendChild(nftCard);
    
    // Verificar si la imagen cargó correctamente
    const img = nftCard.querySelector('.nft-image');
    img.addEventListener('load', () => {
      console.log(`NFT #${nft.tokenId} image loaded successfully:`, img.src);
    });
  });
}

// Select NFT for auction
function selectNFT(index) {
  selectedNFT = ownedNFTs[index];
  
  // Update display
  renderNFTGrid(document.getElementById("nftList"));
  
  // Show selected NFT in the auction details
  const selectedNftDisplay = document.getElementById("selectedNftDisplay");
  const auctionDetails = document.getElementById("auction-details");
  
  // Asegurar que la URL de la imagen es válida
  const imageUrl = (typeof selectedNFT.media === 'string' && selectedNFT.media) 
    ? selectedNFT.media 
    : "https://placehold.co/400x400?text=NFT+Image";
  
  selectedNftDisplay.innerHTML = `
    <img src="${imageUrl}" class="me-3" style="width: 50px; height: 50px; object-fit: contain;" 
         onerror="this.onerror=null; this.src='https://placehold.co/400x400?text=NFT+Image'">
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