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
      } else {
        currentAccount = null;
        document.getElementById("walletAddress").innerText = "";
      }
    });

    // Escuchar cambios de red
    window.ethereum.on('chainChanged', () => {
      window.location.reload();
    });
  }
});

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

// Se llamará cuando el usuario realice la acción de ofertar
async function placeBid(auctionId, bidAmount) {
  if (!window.ethereum || !currentAccount) {
    alert("Por favor, conecta tu wallet primero");
    return;
  }
  
  try {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    
    const contract = new ethers.Contract(
      "0xb502e19e62eE8D5Ee1F179b489d832EAb328Bc99", 
      [
        "function placeBid(uint256 auctionId) external payable",
      ],
      signer
    );
    
    // Convertir el monto de oferta a wei
    const bidInWei = ethers.utils.parseEther(bidAmount.toString());
    
    // Realizar la transacción
    const tx = await contract.placeBid(auctionId, { value: bidInWei });
    await tx.wait();
    
    alert("¡Oferta realizada con éxito!");
    loadActiveAuctions(); // Recargar la lista de subastas
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
    
    const contract = new ethers.Contract(
      "0xb502e19e62eE8D5Ee1F179b489d832EAb328Bc99", 
      [
        "function finalizeAuction(uint256 auctionId) external",
      ],
      signer
    );
    
    // Realizar la transacción
    const tx = await contract.finalizeAuction(auctionId);
    await tx.wait();
    
    alert("¡Subasta finalizada con éxito!");
    loadActiveAuctions(); // Recargar la lista de subastas
  } catch (error) {
    console.error("Error al finalizar la subasta:", error);
    alert("Error al finalizar la subasta: " + (error.message || error));
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