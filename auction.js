// Adrian Auction DApp - Main JavaScript functionality

// Contract Constants
const CONTRACT_ADDRESS = "0xd7d6e8b07b424e7edeac15ffffdcf2767c3745c8";
const ADRIAN_TOKEN_ADDRESS = "0x6c9c44334093eB53C7acEAE32DCEC8E945D27b28"; // Hypothetical ADRIAN token address
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
  "event TransferFailed(address nftContract, uint256 tokenId, address from, address to, string reason)" // NUEVO EVENTO
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

// Escuchar eventos del contrato
function listenForContractEvents() {
  console.log("Configurando listeners para eventos del contrato...");
  
  // Monitorear eventos AuctionCreated
  auctionContract.on("AuctionCreated", (auctionId, seller, nftContract, tokenId, reservePrice, endTime) => {
    console.log("Evento AuctionCreated detectado:", {
      auctionId: auctionId.toString(),
      seller,
      nftContract,
      tokenId: tokenId.toString(),
      reservePrice: formatEther(reservePrice),
      endTime: endTime.toString()
    });
    
    showSuccess(`¡Nueva subasta #${auctionId} creada!`);
    loadActiveAuctions();
  });
  
  // Monitorear eventos BidPlaced
  auctionContract.on("BidPlaced", (auctionId, bidder, amount) => {
    console.log("Evento BidPlaced detectado:", {
      auctionId: auctionId.toString(),
      bidder,
      amount: formatEther(amount)
    });
    
    if (bidder.toLowerCase() === currentAccount.toLowerCase()) {
      showSuccess(`Tu oferta de ${formatEther(amount)} ADRIAN en la subasta #${auctionId} ha sido recibida`);
    } else {
      showSuccess(`Nueva oferta de ${formatEther(amount)} ADRIAN en la subasta #${auctionId}`);
    }
    
    loadActiveAuctions();
  });
  
  // Monitorear eventos BidRefunded
  auctionContract.on("BidRefunded", (auctionId, bidder, amount) => {
    console.log("Evento BidRefunded detectado:", {
      auctionId: auctionId.toString(),
      bidder,
      amount: formatEther(amount)
    });
    
    if (bidder.toLowerCase() === currentAccount.toLowerCase()) {
      showSuccess(`Tu oferta de ${formatEther(amount)} ADRIAN en la subasta #${auctionId} ha sido reembolsada`);
    }
  });
  
  // Monitorear eventos AuctionEnded
  auctionContract.on("AuctionEnded", (auctionId, winner, amount) => {
    console.log("Evento AuctionEnded detectado:", {
      auctionId: auctionId.toString(),
      winner,
      amount: formatEther(amount)
    });
    
    if (winner.toLowerCase() === currentAccount.toLowerCase()) {
      showSuccess(`¡Has ganado la subasta #${auctionId} con una oferta de ${formatEther(amount)} ADRIAN!`);
    } else if (winner === ethers.constants.AddressZero) {
      showSuccess(`La subasta #${auctionId} ha finalizado sin ganador`);
    } else {
      showSuccess(`La subasta #${auctionId} ha finalizado. Ganador: ${formatAddress(winner)}`);
    }
    
    loadActiveAuctions();
  });
  
  // Monitorear eventos AuctionCancelled
  auctionContract.on("AuctionCancelled", (auctionId) => {
    console.log("Evento AuctionCancelled detectado:", {
      auctionId: auctionId.toString()
    });
    
    showSuccess(`La subasta #${auctionId} ha sido cancelada`);
    loadActiveAuctions();
  });
  
  // Monitorear eventos TransferFailed
  auctionContract.on("TransferFailed", (nftContract, tokenId, from, to, reason) => {
    console.log("Evento TransferFailed detectado:", {
      nftContract,
      tokenId: tokenId.toString(),
      from,
      to,
      reason
    });
    
    // Mostrar advertencia al usuario
    showError(`Problema al transferir NFT: ${reason}. El contrato o el administrador intentarán resolver esto.`);
  });
  
  console.log("Listeners de eventos configurados correctamente");
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
    
    // Escuchar eventos del contrato
    listenForContractEvents();
    
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
  
  // Asegurarse de que tokenId se guarde como string para manejar correctamente IDs grandes
  if (selectedNFT && typeof selectedNFT.tokenId !== 'string') {
    selectedNFT.tokenId = selectedNFT.tokenId.toString();
    console.log("TokenId convertido a string para manejo seguro:", selectedNFT.tokenId);
  }
  
  // Update display
  renderNFTGrid(document.getElementById("nftList"));
  
  // Show selected NFT in the auction details
    console.log("=== FIN DE CREACIÓN DE SUBASTA EXITOSA ===");
    
    // Navegar a la pestaña de mis subastas
    setTimeout(() => {
      document.getElementById("myauctions-tab").click();
    }, 1500);
    
  } catch (error) {
    console.error("=== ERROR AL CREAR LA SUBASTA ===");
    console.error("Error detallado:", error);
    
    if (error.data) console.error("Error data:", error.data);
    if (error.transaction) {
      console.error("Tx details:", error.transaction);
      console.error("Tx data:", error.transaction.data);
    }
    if (error.receipt) {
      console.error("Receipt:", error.receipt);
      console.error("Receipt status:", error.receipt.status);
      console.error("Gas used:", error.receipt.gasUsed?.toString());
    }
    
    // Análisis detallado del error
    let errorMessage = "Error al crear la subasta.";
    
    // Verificar si la transacción falló por gas
    const gasLimitReached = 
      error.receipt && 
      error.receipt.status === 0 && 
      error.receipt.gasUsed && 
      error.receipt.gasUsed.gt(ethers.BigNumber.from("1000000"));
    
    if (error.code === 4001) {
      errorMessage = "Transacción rechazada por el usuario.";
    } else if (error.message.includes("insufficient funds")) {
      errorMessage = "Fondos insuficientes para completar la transacción.";
    } else if (gasLimitReached) {
      errorMessage = "La transacción consumió demasiado gas. Intenta nuevamente con un límite de gas más alto o contacta al soporte.";
    } else if (error.receipt && error.receipt.status === 0) {
      // Analizar la transacción fallida con más detalle
      if (error.message.includes("transfer of token that is not own") || 
          error.message.includes("not owner") || 
          error.message.includes("ERC721: caller is not token owner")) {
        errorMessage = "No eres el propietario de este NFT. Verifica que el token existe y te pertenece.";
      } else if (error.message.includes("approved") || error.message.includes("allowance")) {
        errorMessage = "El NFT no está correctamente aprobado para la subasta. Intenta de nuevo.";
      } else {
        errorMessage = "La transacción falló en la blockchain. Posibles razones: error en el contrato, token no aprobado, o no eres propietario del NFT.";
      }
    } else if (error.message.includes("transaction failed")) {
      errorMessage = "La transacción falló. Esto puede deberse a un problema con el NFT o con los permisos de aprobación.";
    } else if (error.message.includes("gas")) {
      errorMessage = "Error con el gas de la transacción. Intenta aumentar el límite de gas en tu wallet.";
    } else if (error.message.includes("timeout") || error.message.includes("timed out")) {
      errorMessage = "La transacción expiró. La red podría estar congestionada. Revisa tu wallet para ver si la transacción se completó.";
    } else if (error.message.includes("network changed")) {
      errorMessage = "La red cambió durante la transacción. Por favor, vuelve a intentarlo.";
    } else if (error.message.includes("replacement") || error.message.includes("underpriced")) {
      errorMessage = "La transacción fue reemplazada o el precio de gas fue demasiado bajo. Intenta nuevamente con un precio de gas más alto.";
    } else {
      errorMessage = error.message || errorMessage;
    }
    
    console.error("Mensaje de error mostrado:", errorMessage);
    showError(errorMessage);
  }
} 