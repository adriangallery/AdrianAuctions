// Archivo auction.js - Funcionalidad principal para la DApp de subastas

document.addEventListener('DOMContentLoaded', async () => {
  // Comprobar si MetaMask está instalado al cargar la página
  if (window.ethereum) {
    // Escuchar cambios de cuenta
    window.ethereum.on('accountsChanged', (accounts) => {
      if (accounts.length > 0) {
        currentAccount = accounts[0];
        document.getElementById("walletAddress").innerText = `Conectado: ${currentAccount.slice(0,6)}...${currentAccount.slice(-4)}`;
        loadActiveAuctions();
        
        // Actualizar otras vistas si están activas
        const activeTab = document.querySelector('.nav-link.active');
        if (activeTab) {
          if (activeTab.id === 'myauctions-tab') {
            loadUserAuctions(currentAccount);
          } else if (activeTab.id === 'mybids-tab') {
            loadUserBids(currentAccount);
          }
        }
      } else {
        currentAccount = null;
        document.getElementById("walletAddress").innerText = "";
      }
    });

    // Escuchar cambios de red
    window.ethereum.on('chainChanged', () => {
      window.location.reload();
    });
    
    // Comprobación de red
    try {
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      if (chainId !== '0x2105') { // Base Mainnet
        showNetworkWarning();
      }
    } catch (error) {
      console.error("Error verificando red:", error);
    }
  }
});

// Constantes del contrato
const CONTRACT_ADDRESS = "0xb502e19e62eE8D5Ee1F179b489d832EAb328Bc99";
const RPC_URL = "https://base-mainnet.infura.io/v3/cc0c8013b1e044dcba79d4f7ec3b2ba1";
const ADRIAN_TOKEN_ADDRESS = "0x6c9c44334093eB53C7acEAE32DCEC8E945D27b28"; // Dirección hipotética del token ADRIAN

// Interfaces del contrato
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
  "function setApprovalForAll(address operator, bool approved) external"
];

// Funciones auxiliares para mostrar información de subastas
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
  
  if (secondsRemaining <= 0) return "Finalizada";
  
  const days = Math.floor(secondsRemaining / 86400);
  const hours = Math.floor((secondsRemaining % 86400) / 3600);
  const minutes = Math.floor((secondsRemaining % 3600) / 60);
  const seconds = secondsRemaining % 60;
  
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function showNetworkWarning() {
  // Crear una alerta en la parte superior
  const alertDiv = document.createElement('div');
  alertDiv.className = 'alert alert-warning alert-dismissible fade show';
  alertDiv.setAttribute('role', 'alert');
  alertDiv.innerHTML = `
    <strong>¡Red incorrecta!</strong> Por favor, cambia a la red Base Mainnet para interactuar con AdrianAuctions.
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;
  
  document.querySelector('.container').prepend(alertDiv);
}

// Cargar subastas creadas por el usuario
async function loadUserAuctions(userAddress) {
  if (!userAddress) return;
  
  try {
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, AUCTION_ABI, provider);
    
    // Obtener IDs de subastas del usuario
    const auctionIds = await contract.getUserAuctions(userAddress);
    
    if (auctionIds.length === 0) {
      document.getElementById("myAuctionsList").innerHTML = `
        <div class="col-12">
          <div class="alert alert-info">
            No has creado ninguna subasta todavía.
          </div>
        </div>
      `;
      return;
    }
    
    // Obtener detalles de todas las subastas
    const details = await contract.getManyAuctionDetails(auctionIds);
    
    // Renderizar subastas
    const container = document.getElementById("myAuctionsList");
    container.innerHTML = "";
    
    const now = Math.floor(Date.now() / 1000);
    
    details.forEach((auction, index) => {
      const auctionId = auctionIds[index];
      const timeRemaining = auction.endTime - now;
      const endsSoon = auction.active && timeRemaining < 900;
      const passedReserve = auction.highestBid >= auction.reservePrice;
      
      const cardClass = `card text-dark ${endsSoon ? 'border-warning bg-warning-subtle' : ''} ${passedReserve ? 'border-success bg-success-subtle' : ''}`.trim();
      const statusTag = `
        ${endsSoon ? '<span class="badge bg-warning text-dark me-1">🔥 Finalizando Pronto</span>' : ''}
        ${passedReserve ? '<span class="badge bg-success text-white">✅ Reserva Cubierta</span>' : ''}
        ${!auction.active ? '<span class="badge bg-secondary">Inactiva</span>' : ''}
        ${auction.finalized ? '<span class="badge bg-info text-white">Finalizada</span>' : ''}
      `;
      
      let actionButtons = '';
      
      if (auction.active && !auction.finalized) {
        if (auction.endTime <= now) {
          actionButtons = `<button class="btn btn-success btn-sm" onclick="finalizeAuction(${auctionId})">Finalizar Subasta</button>`;
        } else if (auction.highestBid === 0) {
          actionButtons = `<button class="btn btn-danger btn-sm" onclick="cancelAuction(${auctionId})">Cancelar Subasta</button>`;
        }
      } else if (!auction.active && auction.finalized && auction.highestBidder === ethers.constants.AddressZero) {
        actionButtons = `<button class="btn btn-primary btn-sm" onclick="showRelistModal(${auctionId})">Volver a Subastar</button>`;
      }
      
      const html = `
        <div class="col-md-4 mb-3">
          <div class="${cardClass}">
            <div class="card-body">
              <h5 class="card-title">Subasta #${auctionId.toString()}</h5>
              <p>${statusTag}</p>
              <p>NFT: ${formatAddress(auction.nftContract)}</p>
              <p>Token ID: ${auction.tokenId}</p>
              <p>Reserva: ${formatEther(auction.reservePrice)} ADRIAN</p>
              <p>Oferta Más Alta: ${formatEther(auction.highestBid)} ADRIAN</p>
              <p>Mejor Postor: ${auction.highestBidder !== ethers.constants.AddressZero ? formatAddress(auction.highestBidder) : 'Ninguno'}</p>
              <p>Tiempo: ${auction.active ? formatTimeRemaining(auction.endTime) : 'Finalizada'}</p>
              
              <div class="mt-3">
                ${actionButtons}
              </div>
            </div>
          </div>
        </div>
      `;
      
      container.innerHTML += html;
    });
    
  } catch (error) {
    console.error("Error cargando subastas del usuario:", error);
    document.getElementById("myAuctionsList").innerHTML = `
      <div class="col-12">
        <div class="alert alert-danger">
          Error al cargar tus subastas. Por favor, intenta de nuevo.
        </div>
      </div>
    `;
  }
}

// Cargar ofertas realizadas por el usuario
async function loadUserBids(userAddress) {
  if (!userAddress) return;
  
  try {
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, AUCTION_ABI, provider);
    
    // Obtener IDs de subastas donde el usuario ha ofertado
    const auctionIds = await contract.getUserBids(userAddress);
    
    if (auctionIds.length === 0) {
      document.getElementById("myBidsList").innerHTML = `
        <div class="col-12">
          <div class="alert alert-info">
            No has realizado ninguna oferta todavía.
          </div>
        </div>
      `;
      return;
    }
    
    // Obtener detalles de todas las subastas
    const details = await contract.getManyAuctionDetails(auctionIds);
    
    // Renderizar subastas
    const container = document.getElementById("myBidsList");
    container.innerHTML = "";
    
    const now = Math.floor(Date.now() / 1000);
    
    details.forEach((auction, index) => {
      const auctionId = auctionIds[index];
      const timeRemaining = auction.endTime - now;
      const isHighestBidder = auction.highestBidder.toLowerCase() === userAddress.toLowerCase();
      const endsSoon = auction.active && timeRemaining < 900;
      
      let cardClass = "card";
      if (isHighestBidder) {
        cardClass += " border-success bg-success-subtle";
      } else if (endsSoon) {
        cardClass += " border-warning bg-warning-subtle";
      }
      
      const statusTag = `
        ${isHighestBidder ? '<span class="badge bg-success text-white me-1">🏆 Mejor Postor</span>' : ''}
        ${endsSoon ? '<span class="badge bg-warning text-dark me-1">🔥 Finalizando Pronto</span>' : ''}
        ${!auction.active ? '<span class="badge bg-secondary">Inactiva</span>' : ''}
        ${auction.finalized ? '<span class="badge bg-info text-white">Finalizada</span>' : ''}
      `;
      
      const html = `
        <div class="col-md-4 mb-3">
          <div class="${cardClass}">
            <div class="card-body">
              <h5 class="card-title">Subasta #${auctionId.toString()}</h5>
              <p>${statusTag}</p>
              <p>NFT: ${formatAddress(auction.nftContract)}</p>
              <p>Token ID: ${auction.tokenId}</p>
              <p>Vendedor: ${formatAddress(auction.seller)}</p>
              <p>Reserva: ${formatEther(auction.reservePrice)} ADRIAN</p>
              <p>Tu Posición: ${isHighestBidder ? '🏆 Ganando' : '❌ Superado'}</p>
              <p>Oferta Más Alta: ${formatEther(auction.highestBid)} ADRIAN</p>
              <p>Tiempo: ${auction.active ? formatTimeRemaining(auction.endTime) : 'Finalizada'}</p>
              
              <div class="mt-3">
                ${auction.active && !isHighestBidder ? 
                  `<button class="btn btn-primary btn-sm" onclick="openBidModal(${auctionId}, ${auction.highestBid}, ${auction.reservePrice})">Ofertar de nuevo</button>` : 
                  ''}
              </div>
            </div>
          </div>
        </div>
      `;
      
      container.innerHTML += html;
    });
    
  } catch (error) {
    console.error("Error cargando ofertas del usuario:", error);
    document.getElementById("myBidsList").innerHTML = `
      <div class="col-12">
        <div class="alert alert-danger">
          Error al cargar tus ofertas. Por favor, intenta de nuevo.
        </div>
      </div>
    `;
  }
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