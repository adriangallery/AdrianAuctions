// Variables globales
const CONTRACT_ADDRESS = '0xb502e19e62eE8D5Ee1F179b489d832EAb328Bc99';
const BASE_CHAIN_ID = 8453;

// Estado de la aplicación
const appState = {
  isConnected: false,
  address: null,
  activeSection: 'home',
  activeTab: 'created',
  auctions: [],
  myAuctions: [],
  myBids: []
};

// Funciones de utilidad
function shortenAddress(address) {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatEther(wei) {
  // Función simplificada, en una app real usaríamos ethers.js
  if (!wei) return '0';
  return parseFloat(wei) / 1e18;
}

function getTimeLeft(endTime) {
  const now = Math.floor(Date.now() / 1000);
  const end = parseInt(endTime);
  
  if (now >= end) {
    return 'Finalizada';
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
}

// Manejo de wallet
async function connectWallet() {
  if (typeof window.ethereum === 'undefined') {
    showNotification('Por favor instala MetaMask para conectar tu wallet', 'error');
    return;
  }
  
  try {
    // Solicitar conexión de cuentas
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    
    if (accounts.length === 0) {
      showNotification('No se pudo conectar a MetaMask', 'error');
      return;
    }
    
    // Verificar si estamos en la red correcta
    const chainId = await window.ethereum.request({ method: 'eth_chainId' });
    const isCorrectNetwork = parseInt(chainId) === BASE_CHAIN_ID;
    
    appState.isConnected = true;
    appState.address = accounts[0];
    
    updateUI();
    
    if (!isCorrectNetwork) {
      showNetworkWarning();
    } else {
      // Si estamos en la red correcta, podemos cargar datos
      if (appState.activeSection === 'explore') {
        loadExploreAuctions();
      } else if (appState.activeSection === 'myauctions') {
        loadMyAuctions();
      }
    }
    
    showNotification('Wallet conectada: ' + shortenAddress(accounts[0]), 'success');
  } catch (error) {
    console.error('Error al conectar wallet:', error);
    showNotification('Error al conectar la wallet', 'error');
  }
}

async function switchToBaseNetwork() {
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: `0x${BASE_CHAIN_ID.toString(16)}` }]
    });
    return true;
  } catch (error) {
    // Si la red no está agregada, intenta agregarla
    if (error.code === 4902) {
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: `0x${BASE_CHAIN_ID.toString(16)}`,
            chainName: 'Base Mainnet',
            nativeCurrency: {
              name: 'ETH',
              symbol: 'ETH',
              decimals: 18
            },
            rpcUrls: ['https://mainnet.base.org'],
            blockExplorerUrls: ['https://basescan.org']
          }]
        });
        return true;
      } catch (addError) {
        console.error('Error al añadir la red Base:', addError);
        return false;
      }
    }
    console.error('Error al cambiar a la red Base:', error);
    return false;
  }
}

function showNetworkWarning() {
  const warningElement = document.createElement('div');
  warningElement.className = 'wallet-connect';
  warningElement.innerHTML = `
    <h3>Red incorrecta</h3>
    <p>Por favor cambia a la red Base Mainnet para interactuar con la aplicación.</p>
    <button id="switchNetworkBtn" class="btn btn-primary">Cambiar a Base</button>
  `;
  
  // Inyectar en el contenedor principal, justo después del navbar
  const mainElement = document.querySelector('main');
  mainElement.insertBefore(warningElement, mainElement.firstChild);
  
  // Añadir evento al botón
  document.getElementById('switchNetworkBtn').addEventListener('click', async () => {
    const success = await switchToBaseNetwork();
    if (success) {
      warningElement.remove();
      showNotification('¡Conectado a la red Base!', 'success');
      
      // Recargar datos
      if (appState.activeSection === 'explore') {
        loadExploreAuctions();
      } else if (appState.activeSection === 'myauctions') {
        loadMyAuctions();
      }
    } else {
      showNotification('No se pudo cambiar a la red Base', 'error');
    }
  });
}

// UI y navegación
function updateUI() {
  // Actualizar navbar
  const connectButton = document.getElementById('connectWalletBtn');
  if (appState.isConnected) {
    connectButton.textContent = shortenAddress(appState.address);
    connectButton.classList.remove('btn-outline-primary');
    connectButton.classList.add('btn-secondary');
  } else {
    connectButton.textContent = 'Conectar Wallet';
    connectButton.classList.add('btn-outline-primary');
    connectButton.classList.remove('btn-secondary');
  }
  
  // Actualizar enlaces activos
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active');
    if (link.getAttribute('data-section') === appState.activeSection) {
      link.classList.add('active');
    }
  });
}

function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  notification.style.position = 'fixed';
  notification.style.bottom = '20px';
  notification.style.right = '20px';
  notification.style.padding = '10px 20px';
  notification.style.borderRadius = '4px';
  notification.style.color = 'white';
  notification.style.zIndex = '1100';
  
  if (type === 'error') {
    notification.style.backgroundColor = 'var(--danger-color)';
  } else if (type === 'success') {
    notification.style.backgroundColor = 'var(--success-color)';
  } else {
    notification.style.backgroundColor = 'var(--primary-color)';
  }
  
  document.body.appendChild(notification);
  
  // Eliminar después de 3 segundos
  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transition = 'opacity 0.5s';
    setTimeout(() => notification.remove(), 500);
  }, 3000);
}

function navigateTo(section) {
  appState.activeSection = section;
  
  // Ocultar todas las secciones
  document.querySelectorAll('section[data-section]').forEach(section => {
    section.style.display = 'none';
  });
  
  // Mostrar la sección actual
  const currentSection = document.querySelector(`section[data-section="${section}"]`);
  if (currentSection) {
    currentSection.style.display = 'block';
  }
  
  updateUI();
  
  // Cargar datos según la sección
  if (section === 'explore' && appState.isConnected) {
    loadExploreAuctions();
  } else if (section === 'myauctions' && appState.isConnected) {
    loadMyAuctions();
  }
}

// Renderizado de componentes
function renderNFTCard(auction, showActions = true) {
  const card = document.createElement('div');
  card.className = 'card';
  
  // Determinar si la subasta está activa
  const now = Math.floor(Date.now() / 1000);
  const isActive = auction.active && !auction.finalized && parseInt(auction.endTime) > now;
  const isOwner = appState.address && auction.seller.toLowerCase() === appState.address.toLowerCase();
  const isHighestBidder = appState.address && auction.highestBidder.toLowerCase() === appState.address.toLowerCase();
  const hasEnded = parseInt(auction.endTime) <= now;
  
  const timeLeft = getTimeLeft(auction.endTime);
  const price = formatEther(auction.reservePrice);
  const highestBid = formatEther(auction.highestBid);
  
  // HTML del card
  card.innerHTML = `
    <img src="https://via.placeholder.com/400x200?text=NFT+${auction.tokenId}" class="card-img-top" alt="NFT Image">
    <div class="card-body">
      <h5 class="card-title">NFT #${auction.tokenId}</h5>
      <p class="card-text">Precio mínimo: ${price} ETH</p>
      <p class="card-text">Oferta actual: ${highestBid} ETH</p>
      <p class="card-text">Vendedor: ${shortenAddress(auction.seller)}</p>
      <p class="card-text"><small>${timeLeft}</small></p>
      
      ${showActions ? `
        <div class="card-actions mt-4">
          ${isActive && !isOwner ? `
            <button class="btn btn-primary btn-block bid-btn" data-auction-id="${auction.auctionId}">Ofertar</button>
          ` : ''}
          
          ${isOwner && hasEnded && !auction.finalized ? `
            <button class="btn btn-success btn-block end-auction-btn" data-auction-id="${auction.auctionId}">Finalizar Subasta</button>
          ` : ''}
          
          ${isHighestBidder && hasEnded && !auction.finalized ? `
            <button class="btn btn-success btn-block claim-nft-btn" data-auction-id="${auction.auctionId}">Reclamar NFT</button>
          ` : ''}
        </div>
      ` : ''}
    </div>
  `;
  
  // Eventos para botones
  if (showActions) {
    setTimeout(() => {
      const bidBtn = card.querySelector('.bid-btn');
      if (bidBtn) {
        bidBtn.addEventListener('click', () => {
          showBidModal(auction);
        });
      }
      
      const endAuctionBtn = card.querySelector('.end-auction-btn');
      if (endAuctionBtn) {
        endAuctionBtn.addEventListener('click', () => {
          endAuction(auction.auctionId);
        });
      }
      
      const claimNFTBtn = card.querySelector('.claim-nft-btn');
      if (claimNFTBtn) {
        claimNFTBtn.addEventListener('click', () => {
          claimNFT(auction.auctionId);
        });
      }
    }, 0);
  }
  
  return card;
}

function showBidModal(auction) {
  alert('Funcionalidad de oferta no implementada en esta versión estática');
  // En una implementación real, mostraríamos un modal para hacer la oferta
}

function endAuction(auctionId) {
  alert('Funcionalidad de finalizar subasta no implementada en esta versión estática');
  // En una implementación real, llamaríamos al contrato para finalizar la subasta
}

function claimNFT(auctionId) {
  alert('Funcionalidad de reclamar NFT no implementada en esta versión estática');
  // En una implementación real, llamaríamos al contrato para reclamar el NFT
}

// Carga de datos
function loadExploreAuctions() {
  showNotification('Cargando subastas activas...', 'info');
  
  // En una implementación real, aquí haríamos la llamada al contrato
  // Como es una versión estática, usamos datos de ejemplo
  const mockAuctions = [
    {
      auctionId: '1',
      nftContract: '0x1234567890123456789012345678901234567890',
      tokenId: '42',
      seller: '0x9876543210987654321098765432109876543210',
      reservePrice: '500000000000000000', // 0.5 ETH
      endTime: (Math.floor(Date.now() / 1000) + 86400).toString(), // 1 día
      highestBidder: '0x0000000000000000000000000000000000000000',
      highestBid: '0',
      active: true,
      finalized: false
    },
    {
      auctionId: '2',
      nftContract: '0x1234567890123456789012345678901234567890',
      tokenId: '123',
      seller: '0x9876543210987654321098765432109876543210',
      reservePrice: '300000000000000000', // 0.3 ETH
      endTime: (Math.floor(Date.now() / 1000) + 18000).toString(), // 5 horas
      highestBidder: '0x1111111111111111111111111111111111111111',
      highestBid: '400000000000000000', // 0.4 ETH
      active: true,
      finalized: false
    },
    {
      auctionId: '3',
      nftContract: '0x1234567890123456789012345678901234567890',
      tokenId: '789',
      seller: '0x9876543210987654321098765432109876543210',
      reservePrice: '800000000000000000', // 0.8 ETH
      endTime: (Math.floor(Date.now() / 1000) + 172800).toString(), // 2 días
      highestBidder: '0x2222222222222222222222222222222222222222',
      highestBid: '900000000000000000', // 0.9 ETH
      active: true,
      finalized: false
    }
  ];
  
  appState.auctions = mockAuctions;
  
  // Mostrar las subastas en la página
  const exploreContainer = document.querySelector('#explore-auctions');
  exploreContainer.innerHTML = '';
  
  if (mockAuctions.length === 0) {
    exploreContainer.innerHTML = `
      <div class="text-center py-4">
        <h3>No hay subastas activas en este momento</h3>
        <p>Vuelve más tarde para ver nuevas subastas</p>
      </div>
    `;
    return;
  }
  
  const rowElement = document.createElement('div');
  rowElement.className = 'row';
  
  mockAuctions.forEach(auction => {
    const colElement = document.createElement('div');
    colElement.className = 'col-md-4';
    colElement.appendChild(renderNFTCard(auction));
    rowElement.appendChild(colElement);
  });
  
  exploreContainer.appendChild(rowElement);
}

function loadMyAuctions() {
  if (!appState.isConnected) {
    showNotification('Conecta tu wallet para ver tus subastas', 'error');
    return;
  }
  
  showNotification('Cargando tus subastas...', 'info');
  
  // Datos de ejemplo para la versión estática
  const mockMyAuctions = [
    {
      auctionId: '4',
      nftContract: '0x1234567890123456789012345678901234567890',
      tokenId: '555',
      seller: appState.address || '0x9876543210987654321098765432109876543210',
      reservePrice: '1000000000000000000', // 1 ETH
      endTime: (Math.floor(Date.now() / 1000) + 86400).toString(), // 1 día
      highestBidder: '0x3333333333333333333333333333333333333333',
      highestBid: '1100000000000000000', // 1.1 ETH
      active: true,
      finalized: false
    }
  ];
  
  const mockMyBids = [
    {
      auctionId: '5',
      nftContract: '0x1234567890123456789012345678901234567890',
      tokenId: '777',
      seller: '0x9876543210987654321098765432109876543210',
      reservePrice: '2000000000000000000', // 2 ETH
      endTime: (Math.floor(Date.now() / 1000) + 43200).toString(), // 12 horas
      highestBidder: appState.address || '0x1111111111111111111111111111111111111111',
      highestBid: '2200000000000000000', // 2.2 ETH
      active: true,
      finalized: false
    }
  ];
  
  appState.myAuctions = mockMyAuctions;
  appState.myBids = mockMyBids;
  
  // Mostrar las subastas del usuario según la pestaña activa
  renderMyAuctionsTab();
}

function renderMyAuctionsTab() {
  const myAuctionsContainer = document.querySelector('#my-auctions-content');
  myAuctionsContainer.innerHTML = '';
  
  const auctions = appState.activeTab === 'created' ? appState.myAuctions : appState.myBids;
  
  if (auctions.length === 0) {
    const message = appState.activeTab === 'created' 
      ? 'No has creado ninguna subasta todavía'
      : 'No has realizado ofertas en ninguna subasta';
      
    myAuctionsContainer.innerHTML = `
      <div class="text-center py-4">
        <h3>${message}</h3>
      </div>
    `;
    return;
  }
  
  const rowElement = document.createElement('div');
  rowElement.className = 'row';
  
  auctions.forEach(auction => {
    const colElement = document.createElement('div');
    colElement.className = 'col-md-4';
    colElement.appendChild(renderNFTCard(auction));
    rowElement.appendChild(colElement);
  });
  
  myAuctionsContainer.appendChild(rowElement);
}

function switchTab(tab) {
  appState.activeTab = tab;
  
  // Actualizar clases de las pestañas
  document.querySelectorAll('.tab-item').forEach(item => {
    item.classList.remove('active');
    if (item.getAttribute('data-tab') === tab) {
      item.classList.add('active');
    }
  });
  
  renderMyAuctionsTab();
}

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
  // Eventos para la navegación
  document.querySelectorAll('[data-section]').forEach(element => {
    element.addEventListener('click', (e) => {
      e.preventDefault();
      const section = element.getAttribute('data-section');
      navigateTo(section);
    });
  });
  
  // Evento para conectar wallet
  document.getElementById('connectWalletBtn').addEventListener('click', connectWallet);
  
  // Eventos para las pestañas en la sección "Mis Subastas"
  document.querySelectorAll('[data-tab]').forEach(element => {
    element.addEventListener('click', () => {
      const tab = element.getAttribute('data-tab');
      switchTab(tab);
    });
  });
  
  // Establecer sección inicial
  navigateTo('home');
  
  // Manejar el cambio de cuentas y red en MetaMask
  if (typeof window.ethereum !== 'undefined') {
    window.ethereum.on('accountsChanged', (accounts) => {
      if (accounts.length === 0) {
        appState.isConnected = false;
        appState.address = null;
      } else {
        appState.isConnected = true;
        appState.address = accounts[0];
      }
      updateUI();
    });
    
    window.ethereum.on('chainChanged', () => {
      window.location.reload();
    });
  }
}); 