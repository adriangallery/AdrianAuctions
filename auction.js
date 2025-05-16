// Adrian Auction DApp - Main JavaScript functionality

// Contract Constants
const CONTRACT_ADDRESS = "0x1df1de9cb0cb887f08634ec66c4c8d781691f497";
const ADRIAN_TOKEN_ADDRESS = "0x7E99075Ce287F1cF8cBCAaa6A1C7894e404fD7Ea"; // ADRIAN token address
const ALCHEMY_API_KEY = "5qIXA1UZxOAzi8b9l0nrYmsQBO9-W7Ot";
const ALCHEMY_RPC_URL = `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
const RPC_URL = ALCHEMY_RPC_URL;

// Contract ABIs
const AUCTION_ABI = [
  // Read functions
  "function getActiveAuctionsCount() view returns (uint256)",
  "function getActiveAuctions(uint256,uint256) view returns (uint256[] memory)",
  "function getManyAuctionDetails(uint256[]) view returns ((address,uint256,address,uint256,uint256,address,uint256,bool,bool)[] memory)",
  "function getUserAuctions(address) view returns (uint256[] memory)",
  "function getUserBids(address) view returns (uint256[] memory)",
  
  // NUEVAS FUNCIONES
  "function depositNFT(address,uint256) external",
  "function createAuctionFromDeposit(address,uint256,uint256,uint256) external",
  "function withdrawDepositedNFT(address,uint256) external",
  "function getDepositInfo(address,uint256) external view returns (address)",
  
  // Write functions
  "function createAuction(address,uint256,uint256,uint256) external",
  "function placeBid(uint256,uint256) external",
  "function endAuction(uint256) external",
  "function cancelAuction(uint256) external",
  "function relistAuction(uint256,uint256,uint256) external",
  "function finalizeExpiredAuction(uint256) external", // NUEVA FUNCIÓN
  
  // Events
  "event AuctionCreated(uint256 indexed auctionId, address seller, address nftContract, uint256 tokenId, uint256 reservePrice, uint256 endTime)",
  "event BidPlaced(uint256 indexed auctionId, address bidder, uint256 amount)",
  "event BidRefunded(uint256 indexed auctionId, address bidder, uint256 amount)",
  "event AuctionEnded(uint256 indexed auctionId, address winner, uint256 amount)",
  "event AuctionCancelled(uint256 indexed auctionId)",
  "event AuctionExtended(uint256 indexed auctionId, uint256 newEndTime)",
  "event TransferFailed(address nftContract, uint256 tokenId, address from, address to, string reason)", // NUEVO EVENTO
  
  // NUEVOS EVENTOS
  "event NFTDeposited(address indexed nftContract, uint256 indexed tokenId, address indexed depositor)",
  "event NFTWithdrawn(address indexed nftContract, uint256 indexed tokenId, address indexed withdrawer)"
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
  "function tokenURI(uint256 tokenId) external view returns (string memory)",
  "function getApproved(uint256 tokenId) external view returns (address)",
  "function approve(address to, uint256 tokenId) external"
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
      showError("Por favor, conecta tu wallet primero");
      return;
    }
    
    if (!selectedNFT) {
      showError("Por favor, selecciona un NFT primero");
      return;
    }
    
    const reservePrice = document.getElementById("reservePrice").value;
    const duration = document.getElementById("duration").value;
    
    // Validación de los inputs
    if (parseFloat(reservePrice) <= 0) {
      showError("El precio de reserva debe ser mayor que 0");
      return;
    }
    
    if (parseInt(duration) < 1) {
      showError("La duración debe ser de al menos 1 hora");
      return;
    }
    
    console.log("Iniciando creación de subasta con parámetros:", {
      nftContract: selectedNFT.contract,
      tokenId: selectedNFT.tokenId,
      reservePrice: reservePrice,
      duration: duration
    });
    
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
  
  // Check for deposited NFTs when loading the Create tab
  document.getElementById("create-tab").addEventListener("click", async () => {
    if (currentAccount && auctionContract) {
      // When switching to create tab, check if there are deposited NFTs
      try {
        if (selectedNFT) {
          const tokenIdBN = ethers.BigNumber.from(String(selectedNFT.tokenId));
          const depositor = await auctionContract.getDepositInfo(selectedNFT.contract, tokenIdBN);
          
          // If the selected NFT is deposited by the current user
          if (depositor.toLowerCase() === currentAccount.toLowerCase()) {
            document.getElementById("depositStatus").style.display = "block";
            document.getElementById("withdrawNFTBtn").onclick = () => {
              withdrawDepositedNFT(selectedNFT.contract, tokenIdBN);
            };
          } else {
            document.getElementById("depositStatus").style.display = "none";
          }
        } else {
          document.getElementById("depositStatus").style.display = "none";
        }
      } catch (error) {
        console.warn("Error checking deposit status:", error);
        document.getElementById("depositStatus").style.display = "none";
      }
    }
  });
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
async function selectNFT(index) {
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
  
  // Verify if the NFT is deposited
  if (auctionContract) {
    try {
      const tokenIdBN = ethers.BigNumber.from(String(selectedNFT.tokenId));
      const depositor = await auctionContract.getDepositInfo(selectedNFT.contract, tokenIdBN);
      
      // If the selected NFT is deposited by the current user
      if (depositor.toLowerCase() === currentAccount.toLowerCase()) {
        document.getElementById("depositStatus").style.display = "block";
        document.getElementById("withdrawNFTBtn").onclick = () => {
          withdrawDepositedNFT(selectedNFT.contract, tokenIdBN);
        };
      } else {
        document.getElementById("depositStatus").style.display = "none";
      }
    } catch (error) {
      console.warn("Error checking deposit status:", error);
      document.getElementById("depositStatus").style.display = "none";
    }
  }
  
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
      // Ensure values are BigNumber objects
      const highestBid = ethers.BigNumber.from(String(auction.highestBid || '0'));
      const reservePrice = ethers.BigNumber.from(String(auction.reservePrice || '0'));
      const endTime = auction.endTime ? Number(auction.endTime.toString()) : 0;
      
      // Handle boolean values
      const isActive = auction.active === true || auction.active === 1;
      
      const timeLeft = endTime - now;
      if (filter === "active") return isActive;
      if (filter === "reserveMet") return highestBid.gte(reservePrice);
      if (filter === "endingSoon") return isActive && timeLeft < 900;
      return true;
    });
    
    // Sort auctions - ending soon first
    filtered.sort((a, b) => {
      // Convert to Number for safe comparison
      const aTime = a.endTime ? Number(a.endTime.toString()) : 0;
      const bTime = b.endTime ? Number(b.endTime.toString()) : 0;
      return aTime - bTime;
    });
    
    if (filtered.length === 0) {
      loadingElement.style.display = "none";
      noAuctionsMessage.style.display = "block";
      return;
    }
    
    console.log(`Displaying ${filtered.length} auctions`);
    
    // Create a mapping of auction IDs to their original indices
    const idToIndexMap = {};
    allIds.forEach((id, index) => {
      idToIndexMap[id] = index;
    });
    
    for (let i = 0; i < filtered.length; i++) {
      const auction = filtered[i];
      // Find the proper auctionId by looking up the original index
      const originalIndex = idToIndexMap[allIds[i]] !== undefined ? idToIndexMap[allIds[i]] : i;
      const auctionId = allIds[originalIndex];
      
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
  console.log(`Renderizando subasta #${auctionId}:`, auction);
  
  // Debug the auction structure
  console.log("Auction structure", {
    nftContract: auction.nftContract,
    tokenId: auction.tokenId?.toString(),
    active: auction.active,
    typeofActive: typeof auction.active,
    endTime: auction.endTime?.toString(),
    highestBid: auction.highestBid?.toString(),
    reservePrice: auction.reservePrice?.toString(),
    finalized: auction.finalized
  });
  
  const now = Math.floor(Date.now() / 1000);
  const endTime = auction.endTime ? Number(auction.endTime.toString()) : 0;
  const timeRemaining = endTime - now;
  
  // Ensure values are BigNumber objects
  const highestBid = ethers.BigNumber.from(String(auction.highestBid || '0'));
  const reservePrice = ethers.BigNumber.from(String(auction.reservePrice || '0'));
  
  // Explicitly convert boolean values from contract (they might be coming as 0/1)
  const isActive = auction.active === true || auction.active === 1;
  const isFinalized = auction.finalized === true || auction.finalized === 1;
  
  const endingSoon = isActive && timeRemaining < 900;
  const reserveMet = highestBid.gte(reservePrice);
  const isEnded = !isActive || timeRemaining <= 0;
  const hasWinner = auction.highestBidder !== ethers.constants.AddressZero && 
                   highestBid.gt(0) && 
                   highestBid.gte(reservePrice);
  
  console.log(`Subasta #${auctionId} estado:`, {
    isActive,
    isFinalized,
    timeRemaining,
    endingSoon,
    reserveMet,
    isEnded,
    hasWinner,
    isOwner,
    isHighestBidder
  });
  
  // Create auction card
  const auctionCard = document.createElement('div');
  auctionCard.className = 'auction-card';
  
  // Determinar la clase de borde para la tarjeta
  let cardClass = '';
  if (isHighestBidder) cardClass += ' border-success'; // Verde si eres el mayor postor
  else if (isOwner) cardClass += ' border-primary'; // Azul si eres el dueño
  else if (endingSoon) cardClass += ' border-warning'; // Amarillo si está por terminar
  else if (reserveMet) cardClass += ' border-info'; // Info si se cumplió el precio de reserva
  else if (isEnded) cardClass += ' border-secondary'; // Gris si ya terminó
  
  auctionCard.className = `auction-card ${cardClass}`;
  
  // Convert tokenId to a usable format
  const tokenId = auction.tokenId ? ethers.BigNumber.from(auction.tokenId).toString() : '0';
  
  // Try to fetch NFT image from Alchemy if possible
  let imageUrl = 'https://placehold.co/400x400?text=NFT+Image';
  let nftName = `NFT #${tokenId}`;
  
  // Improved image loading
  if (alchemyWeb3 && auction.nftContract) {
    try {
      console.log(`Obteniendo metadata para NFT en contrato ${auction.nftContract}, token ID ${tokenId}`);
      
      // Create a temporary NFT contract to get the tokenURI
      const nftContract = new ethers.Contract(auction.nftContract, ERC721_ABI, readOnlyProvider);
      
      try {
        const tokenURI = await nftContract.tokenURI(tokenId);
        console.log(`Token URI obtenido:`, tokenURI);
        
        if (tokenURI) {
          // Try to fetch metadata
          let metadata = null;
          
          if (tokenURI.startsWith('ipfs://')) {
            const ipfsHash = tokenURI.replace('ipfs://', '');
            const ipfsUrl = `https://ipfs.io/ipfs/${ipfsHash}`;
            
            try {
              console.log(`Obteniendo metadata desde IPFS:`, ipfsUrl);
              const response = await fetch(ipfsUrl);
              metadata = await response.json();
            } catch (error) {
              console.warn("Error al obtener metadata desde IPFS:", error);
            }
          } else if (tokenURI.startsWith('http')) {
            try {
              console.log(`Obteniendo metadata desde HTTP:`, tokenURI);
              const response = await fetch(tokenURI);
              metadata = await response.json();
            } catch (error) {
              console.warn("Error al obtener metadata HTTP:", error);
            }
          }
          
          if (metadata) {
            console.log("Metadata obtenido:", metadata);
            
            if (metadata.name) {
              nftName = metadata.name;
            }
            
            if (metadata.image) {
              if (metadata.image.startsWith('ipfs://')) {
                const imageHash = metadata.image.replace('ipfs://', '');
                imageUrl = `https://ipfs.io/ipfs/${imageHash}`;
              } else {
                imageUrl = metadata.image;
              }
              console.log(`Imagen URL:`, imageUrl);
            }
          }
        }
      } catch (err) {
        console.warn(`Error fetching tokenURI:`, err);
      }
    } catch (error) {
      console.warn(`Error al cargar la imagen del NFT para la subasta #${auctionId}:`, error);
    }
  }
  
  // Create status badges
  let statusBadges = '';
  
  if (isActive) {
    if (endingSoon) {
      statusBadges += '<span class="auction-status status-ending">🔥 Finalizando Pronto</span>';
    } else {
      statusBadges += '<span class="auction-status status-live">🔄 Activa</span>';
    }
    
    if (reserveMet) {
      statusBadges += '<span class="auction-status status-reserve-met">✅ Reserva Alcanzada</span>';
    }
    
    if (isHighestBidder) {
      statusBadges += '<span class="auction-status status-live">🏆 Eres el Ganador</span>';
    }
  } else {
    if (isFinalized) {
      if (hasWinner) {
        statusBadges += '<span class="auction-status">✅ Finalizada con Ganador</span>';
      } else {
        statusBadges += '<span class="auction-status">❌ Finalizada sin Ganador</span>';
      }
    } else {
      statusBadges += '<span class="auction-status">⏸️ Inactiva</span>';
    }
  }
  
  if (isOwner) {
    statusBadges += '<span class="auction-status">👑 Tu Subasta</span>';
  }
  
  // Create action buttons
  let actionButtons = '';
  
  if (isActive && !isFinalized) {
    if (isOwner && endTime <= now) {
      actionButtons = `<button class="btn-action w-100" onclick="finalizeAuction(${auctionId})">Finalizar Subasta</button>`;
    } else if (isOwner && highestBid.isZero()) {
      actionButtons = `<button class="btn-action w-100" onclick="cancelAuction(${auctionId})">Cancelar Subasta</button>`;
    } else if (!isOwner) {
      actionButtons = `<button class="btn-action w-100" onclick="openBidModal(${auctionId}, '${highestBid}', '${reservePrice}', '${auction.nftContract}', ${tokenId})">Ofertar</button>`;
    }
  } else if (isOwner && !isActive && isFinalized && 
            (auction.highestBidder === ethers.constants.AddressZero || highestBid.lt(reservePrice))) {
    // Show relist option if auction is finalized and had no winner (either no bids or reserve not met)
    actionButtons = `<button class="btn-action w-100" onclick="showRelistModal(${auctionId})">Volver a Listar</button>`;
  }
  
  // Calcular el tiempo restante o pasado
  let timeDisplay = '';
  if (isActive) {
    timeDisplay = `<p><strong>Tiempo Restante:</strong> ${formatTimeRemaining(endTime)}</p>`;
  } else {
    const endedAgo = now - endTime;
    timeDisplay = `<p><strong>Terminó:</strong> hace ${formatTimeAgo(endedAgo)}</p>`;
  }
  
  // Populate auction card
  auctionCard.innerHTML = `
    <div class="nft-image-container">
      <img src="${imageUrl}" class="nft-image" alt="${nftName}" onerror="this.src='https://placehold.co/400x400?text=NFT+Image'">
    </div>
    <div class="auction-info">
      <h3 class="auction-title">${nftName}</h3>
      <div class="mb-2">${statusBadges}</div>
      <p><strong>ID Subasta:</strong> #${auctionId}</p>
      <p><strong>Contrato:</strong> ${formatAddress(auction.nftContract)}</p>
      <p><strong>Vendedor:</strong> ${formatAddress(auction.seller)}</p>
      <p><strong>Precio Reserva:</strong> ${formatEther(reservePrice)} ADRIAN</p>
      <p><strong>Oferta Más Alta:</strong> ${formatEther(highestBid)} ADRIAN</p>
      ${timeDisplay}
      <div class="mt-3">
        ${actionButtons}
      </div>
    </div>
  `;
  
  container.appendChild(auctionCard);
}

// Función para formatear tiempo transcurrido
function formatTimeAgo(seconds) {
  if (seconds < 60) return `${seconds} segundos`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutos`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} horas`;
  return `${Math.floor(seconds / 86400)} días`;
}

// Open bid modal
function openBidModal(auctionId, currentBid, reservePrice, nftContract, tokenId) {
  document.getElementById("bidAuctionId").value = auctionId;
  
  console.log("Bid modal params:", { auctionId, currentBid, reservePrice, nftContract, tokenId });
  
  // Calculate minimum bid
  const currentBidValue = ethers.BigNumber.from(String(currentBid || '0'));
  const reservePriceValue = ethers.BigNumber.from(String(reservePrice || '0'));
  
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
  
  // Ensure tokenId is properly formatted
  const formattedTokenId = tokenId ? (typeof tokenId === 'string' ? tokenId : String(tokenId)) : '0';
  
  // Try to load NFT image for the modal
  loadNFTForBidModal(nftContract, formattedTokenId);
  
  // Open modal
  const modal = new bootstrap.Modal(document.getElementById('bidModal'));
  modal.show();
}

// Load NFT image for bid modal
async function loadNFTForBidModal(nftContract, tokenId) {
  const bidNftDisplay = document.getElementById("bid-nft-display");
  bidNftDisplay.innerHTML = `<div class="text-center"><div class="loading-spinner"></div><p>Loading NFT details...</p></div>`;
  
  console.log("Loading NFT for bid modal:", { nftContract, tokenId });
  
  let imageUrl = 'https://placehold.co/400x400?text=NFT+Image';
  let nftName = `NFT #${tokenId}`;
  
  try {
    if (alchemyWeb3 && nftContract) {
      // Try to get metadata using Alchemy
      const nftContractInstance = new ethers.Contract(nftContract, ERC721_ABI, readOnlyProvider);
      
      try {
        const tokenURI = await nftContractInstance.tokenURI(tokenId);
        console.log("Token URI for bid modal:", tokenURI);
        
        if (tokenURI) {
          let metadata = null;
          
          // Handle IPFS URIs
          if (tokenURI.startsWith('ipfs://')) {
            const ipfsHash = tokenURI.replace('ipfs://', '');
            const ipfsUrl = `https://ipfs.io/ipfs/${ipfsHash}`;
            
            try {
              const response = await fetch(ipfsUrl);
              metadata = await response.json();
              console.log("IPFS metadata for bid modal:", metadata);
            } catch (error) {
              console.warn("Error fetching IPFS metadata for bid modal:", error);
            }
          } else if (tokenURI.startsWith('http')) {
            try {
              const response = await fetch(tokenURI);
              metadata = await response.json();
              console.log("HTTP metadata for bid modal:", metadata);
            } catch (error) {
              console.warn("Error fetching HTTP metadata for bid modal:", error);
            }
          }
          
          if (metadata) {
            if (metadata.name) {
              nftName = metadata.name;
            }
            
            if (metadata.image) {
              if (metadata.image.startsWith('ipfs://')) {
                const imageHash = metadata.image.replace('ipfs://', '');
                imageUrl = `https://ipfs.io/ipfs/${imageHash}`;
              } else {
                imageUrl = metadata.image;
              }
              console.log("Image URL for bid modal:", imageUrl);
            }
          }
        }
      } catch (err) {
        console.warn("Error getting tokenURI for bid modal:", err);
      }
    }
  } catch (error) {
    console.warn("Error loading NFT details for bid modal:", error);
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
    showError("Por favor, conecta tu wallet primero");
    return;
  }
  
  // Validación del monto de oferta
  if (parseFloat(bidAmount) <= 0) {
    showError("El monto de la oferta debe ser mayor que 0");
    return;
  }
  
  console.log("=== INICIO DE PROCESO DE OFERTA ===");
  console.log("Parámetros:", { auctionId, bidAmount });
  
  try {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    
    // Verificar y aprobar tokens ADRIAN
    console.log("Inicializando contrato de token ADRIAN:", ADRIAN_TOKEN_ADDRESS);
    const tokenContract = new ethers.Contract(ADRIAN_TOKEN_ADDRESS, ERC20_ABI, signer);
    const bidInWei = ethers.utils.parseEther(bidAmount.toString());
    console.log("Cantidad de oferta en wei:", bidInWei.toString());
    
    // Comprobar allowance
    console.log("Verificando allowance actual para el contrato de subastas");
    const allowance = await tokenContract.allowance(currentAccount, CONTRACT_ADDRESS);
    console.log("Allowance actual:", allowance.toString());
    
    if (allowance.lt(bidInWei)) {
      console.log("Allowance insuficiente, solicitando aprobación...");
      showSuccess("Aprobando tokens ADRIAN para ofertar...");
      
      const approveTx = await tokenContract.approve(CONTRACT_ADDRESS, ethers.constants.MaxUint256);
      console.log("Transacción de aprobación enviada:", approveTx.hash);
      
      showSuccess("Confirmando aprobación de tokens...");
      const approveReceipt = await approveTx.wait();
      console.log("Recibo de aprobación:", approveReceipt);
      
      if (approveReceipt.status === 0) {
        throw new Error("La transacción de aprobación falló");
      }
      
      // Verificar la aprobación después de la transacción
      const newAllowance = await tokenContract.allowance(currentAccount, CONTRACT_ADDRESS);
      console.log("Nuevo allowance después de la aprobación:", newAllowance.toString());
      
      if (newAllowance.lt(bidInWei)) {
        throw new Error("La aprobación se completó pero el allowance sigue siendo insuficiente");
      }
      
      showSuccess("Tokens ADRIAN aprobados correctamente");
    } else {
      console.log("Allowance suficiente para la oferta");
    }
    
    // Realizar la oferta
    console.log("Inicializando contrato de subastas para ofertar");
    const contract = new ethers.Contract(CONTRACT_ADDRESS, AUCTION_ABI, signer);
    
    showSuccess("Enviando oferta...");
    console.log("Enviando transacción placeBid con parámetros:", {
      auctionId,
      bidInWei: bidInWei.toString()
    });
    
    const tx = await contract.placeBid(auctionId, bidInWei);
    console.log("Transacción de oferta enviada:", tx.hash);
    
    // Esperar confirmación
    showSuccess("Confirmando tu oferta...");
    const receipt = await tx.wait();
    console.log("Recibo de la transacción de oferta:", receipt);
    
    if (receipt.status === 0) {
      throw new Error("La transacción de oferta falló");
    }
    
    // Buscar evento BidPlaced en los logs
    const bidPlacedEvent = receipt.events?.find(e => e.event === 'BidPlaced');
    console.log("Evento BidPlaced:", bidPlacedEvent);
    
    if (bidPlacedEvent && bidPlacedEvent.args) {
      console.log("Argumentos del evento:", bidPlacedEvent.args);
      showSuccess(`¡Oferta por ${formatEther(bidPlacedEvent.args.amount)} ADRIAN realizada con éxito!`);
    } else {
      showSuccess("¡Oferta realizada con éxito!");
    }
    
    console.log("=== FIN DE PROCESO DE OFERTA EXITOSO ===");
    
    // Recargar las vistas
    loadActiveAuctions();
    
    // Recargar la pestaña de ofertas si está activa
    if (document.getElementById("mybids-tab").classList.contains("active")) {
      loadUserBids(currentAccount);
    }
    
  } catch (error) {
    console.error("=== ERROR AL REALIZAR LA OFERTA ===");
    console.error("Error detallado:", error);
    
    // Información detallada del error para depuración
    if (error.data) {
      console.error("Error data:", error.data);
    }
    if (error.transaction) {
      console.error("Detalles de la transacción:", error.transaction);
    }
    if (error.receipt) {
      console.error("Recibo de la transacción:", error.receipt);
    }
    
    // Proporcionar mensaje de error más específico
    let errorMessage = "Error al realizar la oferta.";
    
    if (error.code === 4001) {
      errorMessage = "Transacción rechazada por el usuario.";
    } else if (error.message.includes("insufficient funds")) {
      errorMessage = "Fondos insuficientes para completar la transacción.";
    } else if (error.message.includes("execution reverted")) {
      // Extraer el mensaje de error específico
      const revertReason = error.data?.message || error.message;
      
      // Interpretar errores comunes del contrato
      if (revertReason.includes("auction ended")) {
        errorMessage = "La subasta ya ha finalizado.";
      } else if (revertReason.includes("not active")) {
        errorMessage = "La subasta no está activa.";
      } else if (revertReason.includes("bid too low")) {
        errorMessage = "La oferta es demasiado baja. Debe ser mayor que la oferta actual.";
      } else if (revertReason.includes("finalized")) {
        errorMessage = "La subasta ya ha sido finalizada.";
      } else if (revertReason.includes("insufficient allowance")) {
        errorMessage = "No hay suficiente allowance de tokens ADRIAN.";
      } else if (revertReason.includes("insufficient balance")) {
        errorMessage = "No tienes suficientes tokens ADRIAN.";
      } else {
        errorMessage = `La transacción falló: ${revertReason}`;
      }
    } else if (error.message.includes("transaction failed")) {
      errorMessage = "La transacción falló. Revisa la consola para más detalles.";
    } else if (error.message.includes("user rejected")) {
      errorMessage = "Transacción rechazada por el usuario.";
    } else if (error.message.includes("gas")) {
      errorMessage = "Error con el gas de la transacción. Puede que el límite sea demasiado bajo.";
    }
    
    console.error("Mensaje de error mostrado al usuario:", errorMessage);
    showError(errorMessage);
  }
}

// Se llamará cuando el usuario quiera finalizar una subasta
async function finalizeAuction(auctionId) {
  if (!window.ethereum || !currentAccount) {
    showError("Por favor, conecta tu wallet primero");
    return;
  }
  
  console.log("=== INICIO DE FINALIZACIÓN DE SUBASTA ===");
  console.log("Finalizando subasta ID:", auctionId);
  
  try {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    
    const contract = new ethers.Contract(CONTRACT_ADDRESS, AUCTION_ABI, signer);
    
    // Realizar la transacción
    showSuccess("Enviando transacción para finalizar la subasta...");
    console.log("Enviando transacción endAuction");
    
    const tx = await contract.endAuction(auctionId);
    console.log("Transacción enviada:", tx.hash);
    
    showSuccess("Confirmando finalización de la subasta...");
    const receipt = await tx.wait();
    console.log("Recibo de la transacción:", receipt);
    
    if (receipt.status === 0) {
      throw new Error("La transacción de finalización falló");
    }
    
    // Buscar evento AuctionEnded en los logs
    const auctionEndedEvent = receipt.events?.find(e => e.event === 'AuctionEnded');
    console.log("Evento AuctionEnded:", auctionEndedEvent);
    
    if (auctionEndedEvent && auctionEndedEvent.args) {
      console.log("Argumentos del evento:", auctionEndedEvent.args);
      const winner = auctionEndedEvent.args.winner;
      const amount = auctionEndedEvent.args.amount;
      
      if (winner !== ethers.constants.AddressZero) {
        showSuccess(`¡Subasta finalizada con éxito! Ganador: ${formatAddress(winner)} con ${formatEther(amount)} ADRIAN`);
      } else {
        showSuccess("¡Subasta finalizada sin ganador! Puedes volver a listar el NFT si lo deseas.");
      }
    } else {
      showSuccess("¡Subasta finalizada con éxito!");
    }
    
    console.log("=== FIN DE FINALIZACIÓN DE SUBASTA EXITOSA ===");
    
    // Recargar las vistas
    loadActiveAuctions();
    if (document.getElementById("myauctions-tab").classList.contains("active")) {
      loadUserAuctions(currentAccount);
    }
    
  } catch (error) {
    console.error("=== ERROR AL FINALIZAR LA SUBASTA ===");
    console.error("Error detallado:", error);
    
    // Información detallada del error para depuración
    if (error.data) {
      console.error("Error data:", error.data);
    }
    if (error.transaction) {
      console.error("Detalles de la transacción:", error.transaction);
    }
    if (error.receipt) {
      console.error("Recibo de la transacción:", error.receipt);
    }
    
    // Proporcionar mensaje de error más específico
    let errorMessage = "Error al finalizar la subasta.";
    
    if (error.code === 4001) {
      errorMessage = "Transacción rechazada por el usuario.";
    } else if (error.message.includes("insufficient funds")) {
      errorMessage = "Fondos insuficientes para completar la transacción.";
    } else if (error.message.includes("execution reverted")) {
      // Extraer el mensaje de error específico
      const revertReason = error.data?.message || error.message;
      
      // Interpretar errores comunes del contrato
      if (revertReason.includes("not seller")) {
        errorMessage = "Solo el vendedor puede finalizar esta subasta.";
      } else if (revertReason.includes("not ended")) {
        errorMessage = "La subasta aún no ha terminado.";
      } else if (revertReason.includes("already finalized")) {
        errorMessage = "La subasta ya ha sido finalizada.";
      } else if (revertReason.includes("not active")) {
        errorMessage = "La subasta no está activa.";
      } else {
        errorMessage = `La transacción falló: ${revertReason}`;
      }
    } else if (error.message.includes("transaction failed")) {
      errorMessage = "La transacción falló. Revisa la consola para más detalles.";
    } else if (error.message.includes("user rejected")) {
      errorMessage = "Transacción rechazada por el usuario.";
    }
    
    console.error("Mensaje de error mostrado al usuario:", errorMessage);
    showError(errorMessage);
  }
}

// Se llamará cuando el usuario quiera cancelar una subasta
async function cancelAuction(auctionId) {
  if (!window.ethereum || !currentAccount) {
    showError("Por favor, conecta tu wallet primero");
    return;
  }
  
  if (!confirm("¿Estás seguro de que deseas cancelar esta subasta? Esta acción no se puede deshacer.")) {
    return;
  }
  
  console.log("=== INICIO DE CANCELACIÓN DE SUBASTA ===");
  console.log("Cancelando subasta ID:", auctionId);
  
  try {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    
    const contract = new ethers.Contract(CONTRACT_ADDRESS, AUCTION_ABI, signer);
    
    // Realizar la transacción
    showSuccess("Enviando transacción para cancelar la subasta...");
    console.log("Enviando transacción cancelAuction");
    
    const tx = await contract.cancelAuction(auctionId);
    console.log("Transacción enviada:", tx.hash);
    
    showSuccess("Confirmando cancelación de la subasta...");
    const receipt = await tx.wait();
    console.log("Recibo de la transacción:", receipt);
    
    if (receipt.status === 0) {
      throw new Error("La transacción de cancelación falló");
    }
    
    // Buscar evento AuctionCancelled en los logs
    const auctionCancelledEvent = receipt.events?.find(e => e.event === 'AuctionCancelled');
    console.log("Evento AuctionCancelled:", auctionCancelledEvent);
    
    showSuccess("Subasta cancelada correctamente. El NFT ha sido devuelto a tu wallet.");
    console.log("=== FIN DE CANCELACIÓN DE SUBASTA EXITOSA ===");
    
    // Recargar las vistas
    loadActiveAuctions();
    if (document.getElementById("myauctions-tab").classList.contains("active")) {
      loadUserAuctions(currentAccount);
    }
    
  } catch (error) {
    console.error("=== ERROR AL CANCELAR LA SUBASTA ===");
    console.error("Error detallado:", error);
    
    // Información detallada del error para depuración
    if (error.data) {
      console.error("Error data:", error.data);
    }
    if (error.transaction) {
      console.error("Detalles de la transacción:", error.transaction);
    }
    if (error.receipt) {
      console.error("Recibo de la transacción:", error.receipt);
    }
    
    // Proporcionar mensaje de error más específico
    let errorMessage = "Error al cancelar la subasta.";
    
    if (error.code === 4001) {
      errorMessage = "Transacción rechazada por el usuario.";
    } else if (error.message.includes("insufficient funds")) {
      errorMessage = "Fondos insuficientes para completar la transacción.";
    } else if (error.message.includes("execution reverted")) {
      // Extraer el mensaje de error específico
      const revertReason = error.data?.message || error.message;
      
      // Interpretar errores comunes del contrato
      if (revertReason.includes("not seller")) {
        errorMessage = "Solo el vendedor puede cancelar esta subasta.";
      } else if (revertReason.includes("has bids")) {
        errorMessage = "No puedes cancelar una subasta que ya tiene ofertas.";
      } else if (revertReason.includes("already finalized")) {
        errorMessage = "La subasta ya ha sido finalizada.";
      } else if (revertReason.includes("not active")) {
        errorMessage = "La subasta no está activa.";
      } else {
        errorMessage = `La transacción falló: ${revertReason}`;
      }
    } else if (error.message.includes("transaction failed")) {
      errorMessage = "La transacción falló. Revisa la consola para más detalles.";
    } else if (error.message.includes("user rejected")) {
      errorMessage = "Transacción rechazada por el usuario.";
    }
    
    console.error("Mensaje de error mostrado al usuario:", errorMessage);
    showError(errorMessage);
  }
}

// Function to deposit an NFT to the contract
async function depositNFT(nftContract, tokenId) {
  if (!window.ethereum || !currentAccount) {
    showError("Please connect your wallet first");
    return false;
  }
  
  console.log("=== STARTING NFT DEPOSIT ===");
  console.log("Parameters:", { nftContract, tokenId });
  
  try {
    // Convert tokenId to BigNumber
    const tokenIdBN = ethers.BigNumber.from(String(tokenId));
    
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    
    // Verify ownership
    const nftContractInstance = new ethers.Contract(nftContract, ERC721_ABI, signer);
    const owner = await nftContractInstance.ownerOf(tokenIdBN);
    
    if (owner.toLowerCase() !== currentAccount.toLowerCase()) {
      showError("You are not the owner of this NFT");
      return false;
    }
    
    // *** ADD APPROVAL STEP BEFORE DEPOSIT ***
    console.log("Requesting NFT approval...");
    showSuccess("Step 1/2: Approving NFT...");
    
    // You can use approve or setApprovalForAll
    const approveTx = await nftContractInstance.approve(CONTRACT_ADDRESS, tokenIdBN, {
      gasLimit: 200000
    });
    
    console.log("Approval transaction sent:", approveTx.hash);
    showSuccess("Confirming approval...");
    
    const approveReceipt = await approveTx.wait();
    console.log("Approval confirmed:", approveReceipt);
    
    // Small pause to ensure the approval is registered
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Now deposit the NFT
    showSuccess("Step 2/2: Depositing NFT...");
    const auctionContract = new ethers.Contract(CONTRACT_ADDRESS, AUCTION_ABI, signer);
    
    const tx = await auctionContract.depositNFT(nftContract, tokenIdBN, {
      gasLimit: 300000
    });
    
    console.log("Deposit transaction sent:", tx.hash);
    showSuccess("Confirming deposit...");
    
    const receipt = await tx.wait();
    console.log("Deposit receipt:", receipt);
    
    if (receipt.status === 0) {
      throw new Error("Deposit failed on the blockchain");
    }
    
    // Find NFTDeposited event
    const depositEvent = receipt.events?.find(e => e.event === 'NFTDeposited');
    if (depositEvent) {
      console.log("NFT deposited successfully:", depositEvent);
      showSuccess("NFT deposited successfully! You can now create the auction.");
      
      // Update UI to show NFT is deposited
      document.getElementById("depositStatus").style.display = "block";
      
      // Set event handler for withdraw button
      document.getElementById("withdrawNFTBtn").onclick = () => {
        withdrawDepositedNFT(nftContract, tokenIdBN);
      };
      
      return true;
    }
    
    return false;
    
  } catch (error) {
    console.error("Error depositing NFT:", error);
    
    let errorMessage = "Error depositing the NFT.";
    
    if (error.code === 4001) {
      errorMessage = "Transaction rejected by user.";
    } else if (error.message.includes("NFT already deposited")) {
      errorMessage = "This NFT is already deposited in the contract.";
    } else if (error.message.includes("not owner")) {
      errorMessage = "You are not the owner of this NFT.";
    } else if (error.message.includes("ERC721: transfer")) {
      errorMessage = "Transfer failed. Make sure the NFT is approved for the contract.";
    }
    
    showError(errorMessage);
    return false;
  }
}

// Function to withdraw a deposited NFT
async function withdrawDepositedNFT(nftContract, tokenId) {
  if (!window.ethereum || !currentAccount) {
    showError("Please connect your wallet first");
    return;
  }
  
  try {
    // Convert tokenId to BigNumber if needed
    const tokenIdBN = ethers.BigNumber.from(String(tokenId));
    
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    
    const auctionContract = new ethers.Contract(CONTRACT_ADDRESS, AUCTION_ABI, signer);
    
    showSuccess("Retrieving deposited NFT...");
    
    const tx = await auctionContract.withdrawDepositedNFT(nftContract, tokenIdBN, {
      gasLimit: 250000
    });
    
    showSuccess("Confirming withdrawal...");
    const receipt = await tx.wait();
    
    if (receipt.status === 0) {
      throw new Error("Withdrawal failed on the blockchain");
    }
    
    showSuccess("NFT successfully withdrawn to your wallet!");
    
    // Update UI
    document.getElementById("depositStatus").style.display = "none";
    
  } catch (error) {
    console.error("Error withdrawing NFT:", error);
    
    let errorMessage = "Error withdrawing the NFT.";
    
    if (error.code === 4001) {
      errorMessage = "Transaction rejected by user.";
    } else if (error.message.includes("Not the depositor")) {
      errorMessage = "You are not the depositor of this NFT.";
    } else if (error.message.includes("NFT not found")) {
      errorMessage = "The NFT is not deposited in the contract.";
    }
    
    showError(errorMessage);
  }
}

// Function to create a new auction - WITH SIMPLIFIED FLOW
async function createNewAuction(nftContract, tokenId, reservePrice, durationHours) {
  if (!window.ethereum || !currentAccount) {
    showError("Please connect your wallet first");
    return;
  }
  
  console.log("=== STARTING AUCTION CREATION ===");
  console.log("Received parameters:", { nftContract, tokenId, reservePrice, durationHours });
  
  // Check if simplified flow should be used
  const useSimplifiedFlow = document.getElementById("useSimplifiedFlow")?.checked || false;
  console.log("Using simplified flow?", useSimplifiedFlow);
  
  // 1. INITIAL VERIFICATION - PARAMETER VALIDATION AND CONVERSION
  // Validate nftContract is a valid address
  if (!ethers.utils.isAddress(nftContract)) {
    showError("Invalid NFT contract address");
    return;
  }

  // Convert tokenId to BigNumber
  let tokenIdBN;
  try {
    tokenIdBN = ethers.BigNumber.from(String(tokenId));
    console.log("TokenID as BigNumber:", tokenIdBN.toString());
  } catch (err) {
    console.error("Error converting tokenId to BigNumber:", err);
    showError("Invalid token ID: " + err.message);
    return;
  }

  // Format reserve price
  let formattedReservePrice;
  try {
    const floatPrice = parseFloat(reservePrice);
    if (isNaN(floatPrice) || floatPrice <= 0) {
      showError("Price must be a positive number");
      return;
    }
    formattedReservePrice = floatPrice.toFixed(6);
    console.log("Formatted price:", formattedReservePrice);
  } catch (err) {
    showError("Invalid price format: " + err.message);
    return;
  }

  // Convert price to wei
  const reservePriceWei = ethers.utils.parseEther(formattedReservePrice);
  console.log("Reserve price in ADRIAN tokens (wei):", reservePriceWei.toString());

  // Validate duration
  let durationSecs;
  try {
    const hoursNum = parseFloat(durationHours);
    if (isNaN(hoursNum) || hoursNum < 1) {
      showError("Duration must be at least 1 hour");
      return;
    }
    durationSecs = Math.floor(hoursNum * 3600);
    console.log("Duration in seconds:", durationSecs);
  } catch (err) {
    showError("Invalid duration: " + err.message);
    return;
  }
  
  try {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    
    console.log("Provider and signer initialized correctly");
    
    // 2. EXECUTE THE CORRECT FLOW BASED ON SELECTION
    if (useSimplifiedFlow) {
      // SIMPLIFIED FLOW: FIRST DEPOSIT, THEN CREATEAUCTIONFROMDEPOSIT
      
      // 2. CHECK IF NFT IS ALREADY DEPOSITED
      const auctionContract = new ethers.Contract(CONTRACT_ADDRESS, AUCTION_ABI, signer);
      let isDeposited = false;
      
      try {
        const depositor = await auctionContract.getDepositInfo(nftContract, tokenIdBN);
        isDeposited = (depositor.toLowerCase() === currentAccount.toLowerCase());
        console.log("NFT already deposited?", isDeposited);
      } catch (error) {
        console.warn("Error checking deposit status:", error);
        // If we can't check, assume it's not deposited to ensure the process continues
        isDeposited = false;
      }
      
      // 3. DEPOSIT NFT TO CONTRACT (STEP 1/2)
      if (!isDeposited) {
        showSuccess("Depositing NFT...");
        console.log("NFT not deposited yet, proceeding with deposit");
        
        // Use the separate depositNFT function which includes approval
        const depositSuccess = await depositNFT(nftContract, tokenIdBN);
        
        if (!depositSuccess) {
          throw new Error("Failed to deposit NFT. Please make sure the NFT is approved for the contract.");
        }
      } else {
        console.log("NFT already deposited by current user, proceeding to auction creation");
      }
      
      // 4. CREATE AUCTION FROM DEPOSIT (STEP 2/2)
      showSuccess("Creating auction...");
      
      try {
        // TRANSACTION #2: createAuctionFromDeposit
        // Call createAuctionFromDeposit function with exact parameters required
        const tx = await auctionContract.createAuctionFromDeposit(
          nftContract,     // _nftContract: address
          tokenIdBN,       // _tokenId: uint256
          reservePriceWei, // _reservePrice: uint256
          durationSecs,    // _durationSecs: uint256
          { 
            gasLimit: 500000 
          }
        );
        
        console.log("Auction creation transaction sent:", tx.hash);
        showSuccess("Confirming auction creation...");
        
        // Wait for confirmation
        const receipt = await tx.wait();
        
        if (receipt.status === 0) {
          throw new Error("Auction creation failed on the blockchain");
        }
        
        // 5. FINALIZATION - Verify success through AuctionCreated event
        const auctionCreatedEvent = receipt.events?.find(e => e.event === 'AuctionCreated');
        
        if (auctionCreatedEvent && auctionCreatedEvent.args) {
          const auctionId = auctionCreatedEvent.args.auctionId.toString();
          console.log("New auction ID:", auctionId);
          showSuccess(`Auction #${auctionId} created successfully!`);
        } else {
          showSuccess("Auction created successfully!");
        }
      } catch (error) {
        console.error("Error in auction creation transaction:", error);
        throw new Error("Failed to create auction: " + (error.message || "Unknown error"));
      }
      
      // Update UI - Hide deposit status
      document.getElementById("depositStatus").style.display = "none";
    } else {
      // TRADITIONAL FLOW (original)
      console.log("Using traditional flow with approvals...");
      
      // 1. Create NFT contract instance and approve directly
      console.log("Creating NFT contract instance:", nftContract);
      const nftContractInstance = new ethers.Contract(nftContract, ERC721_ABI, signer);
      
      // 2. APPROVE TOKEN USING setApprovalForAll
      console.log("Requesting approval using setApprovalForAll...");
      showSuccess("Requesting permission to use NFT...");
      
      try {
        const approveTx = await nftContractInstance.setApprovalForAll(CONTRACT_ADDRESS, true, {
          gasLimit: 250000
        });
        console.log("Approval transaction sent:", approveTx.hash);
        
        showSuccess("Confirming approval...");
        const approveReceipt = await approveTx.wait();
        console.log("Approval confirmed:", approveReceipt);
        
        // Wait to ensure blockchain has processed the approval
        console.log("Waiting 3 seconds to ensure approval has been processed...");
        await new Promise(resolve => setTimeout(resolve, 3000));
        
      } catch (error) {
        if (error.code === 4001) {
          throw new Error("Approval transaction rejected by user");
        }
        console.warn("Error in global approval:", error);
      }
      
      // 3. Verify and approve ADRIAN tokens for the reserve price
      console.log("Initializing ADRIAN token contract:", ADRIAN_TOKEN_ADDRESS);
      const tokenContract = new ethers.Contract(ADRIAN_TOKEN_ADDRESS, ERC20_ABI, signer);
      
      // Check allowance
      console.log("Checking current ADRIAN token allowance for auction contract");
      const allowance = await tokenContract.allowance(currentAccount, CONTRACT_ADDRESS);
      console.log("Current ADRIAN allowance:", allowance.toString());
      
      if (allowance.lt(reservePriceWei)) {
        console.log("Insufficient ADRIAN token allowance, requesting approval...");
        showSuccess("Approving ADRIAN tokens for auction...");
        
        const approveTx = await tokenContract.approve(CONTRACT_ADDRESS, ethers.constants.MaxUint256);
        console.log("ADRIAN token approval transaction sent:", approveTx.hash);
        
        showSuccess("Confirming ADRIAN token approval...");
        const approveReceipt = await approveTx.wait();
        console.log("ADRIAN token approval receipt:", approveReceipt);
        
        if (approveReceipt.status === 0) {
          throw new Error("ADRIAN token approval transaction failed");
        }
        
        // Verify approval after transaction
        const newAllowance = await tokenContract.allowance(currentAccount, CONTRACT_ADDRESS);
        console.log("New ADRIAN token allowance after approval:", newAllowance.toString());
        
        if (newAllowance.lt(reservePriceWei)) {
          throw new Error("ADRIAN token approval completed but allowance is still insufficient");
        }
        
        showSuccess("ADRIAN tokens approved successfully");
      } else {
        console.log("Sufficient ADRIAN token allowance for auction");
      }
      
      // 4. Create auction with traditional method
      console.log("Creating auction contract instance:", CONTRACT_ADDRESS);
      const auctionContract = new ethers.Contract(CONTRACT_ADDRESS, AUCTION_ABI, signer);
      
      showSuccess("Sending transaction to create auction...");
      
      // Configure gas options
      const gasLimit = 500000;
      
      // Call createAuction method
      const tx = await auctionContract.createAuction(
        nftContract,
        tokenIdBN,
        reservePriceWei,
        durationSecs,
        { gasLimit }
      );
      
      console.log("Transaction sent:", tx.hash);
      showSuccess(`Transaction sent. Waiting for confirmation...`);
      
      const receipt = await tx.wait();
      
      if (receipt.status === 0) {
        throw new Error("Transaction failed on the blockchain");
      }
      
      // Find AuctionCreated event in logs
      const auctionCreatedEvent = receipt.events?.find(e => e.event === 'AuctionCreated');
      
      if (auctionCreatedEvent && auctionCreatedEvent.args) {
        const auctionId = auctionCreatedEvent.args.auctionId.toString();
        console.log("New auction ID:", auctionId);
        showSuccess(`Auction #${auctionId} created successfully!`);
      } else {
        showSuccess("Auction created successfully!");
      }
    }
    
    // Clean form and update UI
    document.getElementById("createAuctionForm").reset();
    document.getElementById("auction-details").style.display = "none";
    document.getElementById("depositStatus").style.display = "none";
    selectedNFT = null;
    renderNFTGrid(document.getElementById("nftList"));
    
    console.log("=== AUCTION CREATION SUCCESSFUL ===");
    
    // Navigate to My Auctions tab
    setTimeout(() => {
      document.getElementById("myauctions-tab").click();
    }, 1500);
    
  } catch (error) {
    console.error("=== ERROR CREATING AUCTION ===");
    console.error("Detailed error:", error);
    
    if (error.data) console.error("Error data:", error.data);
    
    // Detailed error analysis
    let errorMessage = "Error creating auction.";
    
    if (error.code === 4001) {
      errorMessage = "Transaction rejected by user.";
    } else if (error.message.includes("Not the depositor")) {
      errorMessage = "You are not the depositor of this NFT.";
    } else if (error.message.includes("NFT not in contract")) {
      errorMessage = "NFT is not in the contract. Deposit it first.";
    } else {
      errorMessage = error.message || errorMessage;
    }
    
    console.error("Error message displayed:", errorMessage);
    showError(errorMessage);
  }
}

// Funciones adicionales que podrían ser útiles más adelante
function showAuctionDetails(auctionId) {
  // Implementar para mostrar detalles completos de una subasta específica
  console.log("Mostrar detalles de la subasta:", auctionId);
}

// Function to relist an auction (new function based on contract capability)
async function relistAuction(auctionId, newReservePrice, durationHours) {
  if (!window.ethereum || !currentAccount) {
    showError("Por favor, conecta tu wallet primero");
    return;
  }
  
  // Validación de entradas
  if (parseFloat(newReservePrice) <= 0) {
    showError("El precio de reserva debe ser mayor que 0");
    return;
  }
  
  if (parseInt(durationHours) < 1) {
    showError("La duración debe ser de al menos 1 hora");
    return;
  }
  
  console.log("=== INICIO DE RELISTING DE SUBASTA ===");
  console.log("Parámetros:", { auctionId, newReservePrice, durationHours });
  
  try {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    
    // Convert to contract parameters
    const reservePriceWei = ethers.utils.parseEther(newReservePrice.toString());
    const durationSeconds = durationHours * 3600;
    
    console.log("Parámetros convertidos:", {
      reservePriceWei: reservePriceWei.toString(),
      durationSeconds
    });
    
    showSuccess("Enviando transacción para volver a listar la subasta...");
    
    const contract = new ethers.Contract(CONTRACT_ADDRESS, AUCTION_ABI, signer);
    console.log("Llamando a relistAuction con parámetros:", {
      auctionId,
      reservePriceWei: reservePriceWei.toString(),
      durationSeconds
    });
    
    const tx = await contract.relistAuction(auctionId, reservePriceWei, durationSeconds);
    console.log("Transacción enviada:", tx.hash);
    
    showSuccess("Confirmando relisting de subasta...");
    console.log("Esperando confirmación de la transacción...");
    
    const receipt = await tx.wait();
    console.log("Recibo de la transacción:", receipt);
    
    if (receipt.status === 0) {
      throw new Error("La transacción de relisting falló");
    }
    
    // Find the AuctionCreated event to get the new auction ID
    console.log("Buscando evento AuctionCreated en los logs...");
    const auctionCreatedEvent = receipt.events?.find(e => e.event === 'AuctionCreated');
    console.log("Evento AuctionCreated encontrado:", auctionCreatedEvent);
    
    let newAuctionId = null;
    
    if (auctionCreatedEvent && auctionCreatedEvent.args) {
      console.log("Argumentos del evento:", auctionCreatedEvent.args);
      newAuctionId = auctionCreatedEvent.args.auctionId.toString();
      console.log("ID de la nueva subasta:", newAuctionId);
      showSuccess(`¡NFT vuelto a listar con éxito en la subasta #${newAuctionId}!`);
    } else {
      console.log("No se pudo encontrar el ID de la nueva subasta en los eventos");
      showSuccess("¡NFT vuelto a listar con éxito!");
    }
    
    console.log("=== FIN DE RELISTING EXITOSO ===");
    
    // Refresh auction display
    loadUserAuctions(currentAccount);
    
  } catch (error) {
    console.error("=== ERROR AL VOLVER A LISTAR LA SUBASTA ===");
    console.error("Error detallado:", error);
    
    // Información detallada del error para depuración
    if (error.data) {
      console.error("Error data:", error.data);
    }
    if (error.transaction) {
      console.error("Detalles de la transacción:", error.transaction);
    }
    if (error.receipt) {
      console.error("Recibo de la transacción:", error.receipt);
    }
    
    // Proporcionar mensaje de error más específico
    let errorMessage = "Error al volver a listar la subasta.";
    
    if (error.code === 4001) {
      errorMessage = "Transacción rechazada por el usuario.";
    } else if (error.message.includes("insufficient funds")) {
      errorMessage = "Fondos insuficientes para completar la transacción.";
    } else if (error.message.includes("execution reverted")) {
      // Extraer el mensaje de error de la blockchain si está disponible
      const revertReason = error.data?.message || error.message;
      errorMessage = `La transacción falló: ${revertReason}`;
    } else if (error.message.includes("transaction failed")) {
      errorMessage = "La transacción falló. Revisa la consola para más detalles.";
    } else if (error.message.includes("user rejected")) {
      errorMessage = "Usuario rechazó la transacción.";
    } else if (error.message.includes("gas")) {
      errorMessage = "Error con el gas de la transacción. Puede que el límite sea demasiado bajo.";
    }
    
    console.error("Mensaje de error mostrado al usuario:", errorMessage);
    showError(errorMessage);
  }
}

// Function to show relist modal
function showRelistModal(auctionId) {
  console.log("Mostrando modal para volver a listar la subasta ID:", auctionId);
  
  // Create modal if it doesn't exist
  if (!document.getElementById('relistModal')) {
    console.log("Creando modal de relisting por primera vez");
    
    const modalHTML = `
      <div class="modal fade" id="relistModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Volver a listar subasta</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
              <p class="mb-3">Puedes volver a listar este NFT en una nueva subasta con los siguientes parámetros:</p>
              <form id="relistForm">
                <input type="hidden" id="relistAuctionId" value="${auctionId}">
                <div class="mb-3">
                  <label for="newReservePrice" class="form-label">Nuevo precio de reserva (ADRIAN)</label>
                  <input type="number" class="form-control" id="newReservePrice" min="0.000001" step="0.000001" required>
                  <small class="text-muted">El precio mínimo que debe alcanzar una oferta para que la subasta sea válida</small>
                </div>
                <div class="mb-3">
                  <label for="newDuration" class="form-label">Nueva duración (horas)</label>
                  <input type="number" class="form-control" id="newDuration" min="1" value="24" required>
                  <small class="text-muted">Duración de la subasta en horas (mínimo 1 hora)</small>
                </div>
              </form>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
              <button type="button" class="btn-action" id="relistAuctionBtn">Volver a listar</button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Append modal to body
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Add event listener for relist button
    document.getElementById('relistAuctionBtn').addEventListener('click', () => {
      const auctionId = document.getElementById('relistAuctionId').value;
      const newReservePrice = document.getElementById('newReservePrice').value;
      const newDuration = document.getElementById('newDuration').value;
      
      // Validación básica
      let isValid = true;
      
      if (parseFloat(newReservePrice) <= 0) {
        showError("El precio de reserva debe ser mayor que 0");
        isValid = false;
      }
      
      if (parseInt(newDuration) < 1) {
        showError("La duración debe ser de al menos 1 hora");
        isValid = false;
      }
      
      if (isValid) {
        console.log("Validación superada, procediendo con relisting");
        relistAuction(auctionId, newReservePrice, newDuration);
        
        // Hide modal
        const relistModal = bootstrap.Modal.getInstance(document.getElementById('relistModal'));
        relistModal.hide();
      }
    });
  } else {
    // Update auction ID if modal already exists
    console.log("Modal de relisting ya existe, actualizando ID de subasta");
    document.getElementById('relistAuctionId').value = auctionId;
  }
  
  // Show modal
  const relistModal = new bootstrap.Modal(document.getElementById('relistModal'));
  relistModal.show();
} 