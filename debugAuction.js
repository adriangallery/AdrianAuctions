// Debug script para diagnosticar problemas con auctiondetails.html
// Usar con la consola del navegador para probar acceso a subastas

async function debugAuctionAccess(auctionId) {
  console.log("=== INICIO DIAGNÓSTICO SUBASTA ===");
  console.log(`Intentando acceder a la subasta #${auctionId}`);
  
  // Constantes del contrato (duplicadas de auction.js)
  const CONTRACT_ADDRESS = "0x1df1de9cb0cb887f08634ec66c4c8d781691f497";
  const ALCHEMY_API_KEY = "5qIXA1UZxOAzi8b9l0nrYmsQBO9-W7Ot";
  const RPC_URL = `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
  
  // ABI mínimo requerido
  const AUCTION_ABI = [
    "function getManyAuctionDetails(uint256[]) view returns ((address nftContract,uint256 tokenId,address seller,uint256 reservePrice,uint256 endTime,address highestBidder,uint256 highestBid,bool active,bool finalized)[] memory)"
  ];
  
  try {
    console.log("1. Inicializando proveedor con URL:", RPC_URL);
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    
    console.log("2. Creando instancia del contrato en dirección:", CONTRACT_ADDRESS);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, AUCTION_ABI, provider);
    
    console.log("3. Intentando llamar a getManyAuctionDetails con ID:", auctionId);
    const auctionIdArray = [ethers.BigNumber.from(auctionId)];
    
    console.log("4. Ejecutando llamada al contrato...");
    const auctionsDetails = await contract.getManyAuctionDetails(auctionIdArray);
    
    console.log("5. Respuesta recibida del contrato:", auctionsDetails);
    
    if (!auctionsDetails || auctionsDetails.length === 0) {
      console.error("La subasta no fue encontrada - array vacío devuelto por el contrato");
      return null;
    }
    
    const auction = auctionsDetails[0];
    console.log("6. Datos de la subasta recuperados:", {
      nftContract: auction.nftContract,
      tokenId: auction.tokenId?.toString() || "N/A",
      seller: auction.seller,
      reservePrice: auction.reservePrice?.toString() || "N/A",
      endTime: auction.endTime?.toString() || "N/A",
      highestBidder: auction.highestBidder,
      highestBid: auction.highestBid?.toString() || "N/A",
      active: auction.active ? "Sí" : "No",
      finalized: auction.finalized ? "Sí" : "No"
    });
    
    return auction;
  } catch (error) {
    console.error("=== ERROR EN DIAGNÓSTICO ===");
    console.error("Detalles del error:", error);
    
    // Intentar identificar la causa del problema
    if (error.code === 'NETWORK_ERROR') {
      console.error("Problema de red detectado. Verifica tu conexión a internet.");
    } else if (error.code === 'CALL_EXCEPTION') {
      console.error("Excepción en la llamada al contrato. Posiblemente la subasta no existe o hay un problema con la forma en que accedemos a ella.");
    } else if (error.code === 'INVALID_ARGUMENT') {
      console.error("Problema con los argumentos. Verifica que el ID de la subasta es un número válido.");
    }
    
    return null;
  } finally {
    console.log("=== FIN DIAGNÓSTICO SUBASTA ===");
  }
}

// Función para obtener el balance de ETH de la dirección del contrato
async function checkContractBalance() {
  console.log("=== VERIFICANDO BALANCE DEL CONTRATO ===");
  const CONTRACT_ADDRESS = "0x1df1de9cb0cb887f08634ec66c4c8d781691f497";
  const ALCHEMY_API_KEY = "5qIXA1UZxOAzi8b9l0nrYmsQBO9-W7Ot";
  const RPC_URL = `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
  
  try {
    console.log("Inicializando proveedor...");
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    
    console.log("Obteniendo balance para la dirección:", CONTRACT_ADDRESS);
    const balance = await provider.getBalance(CONTRACT_ADDRESS);
    
    console.log("Balance del contrato:", ethers.utils.formatEther(balance), "ETH");
    console.log("Balance en wei:", balance.toString());
    
    return {
      eth: ethers.utils.formatEther(balance),
      wei: balance.toString()
    };
  } catch (error) {
    console.error("Error obteniendo balance del contrato:", error);
    return null;
  } finally {
    console.log("=== FIN VERIFICACIÓN DE BALANCE ===");
  }
}

// Función para verificar si hay subastas activas en el contrato
async function checkActiveAuctions() {
  console.log("=== VERIFICANDO SUBASTAS ACTIVAS ===");
  const CONTRACT_ADDRESS = "0x1df1de9cb0cb887f08634ec66c4c8d781691f497";
  const ALCHEMY_API_KEY = "5qIXA1UZxOAzi8b9l0nrYmsQBO9-W7Ot";
  const RPC_URL = `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
  
  // ABI mínimo para verificar subastas activas
  const AUCTION_ABI = [
    "function getActiveAuctionsCount() view returns (uint256)",
    "function getActiveAuctions(uint256,uint256) view returns (uint256[] memory)"
  ];
  
  try {
    console.log("Inicializando proveedor y contrato...");
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, AUCTION_ABI, provider);
    
    console.log("Obteniendo conteo de subastas activas...");
    const count = await contract.getActiveAuctionsCount();
    console.log("Número de subastas activas:", count.toString());
    
    if (count.gt(0)) {
      const pageSize = count.lt(10) ? count.toNumber() : 10;
      console.log("Obteniendo IDs de subastas activas (máximo 10)...");
      const ids = await contract.getActiveAuctions(0, pageSize);
      console.log("IDs de subastas activas:", ids.map(id => id.toString()));
      
      return {
        count: count.toString(),
        sampleIds: ids.map(id => id.toString())
      };
    }
    
    return {
      count: "0",
      sampleIds: []
    };
  } catch (error) {
    console.error("Error verificando subastas activas:", error);
    return null;
  } finally {
    console.log("=== FIN VERIFICACIÓN DE SUBASTAS ACTIVAS ===");
  }
}

// Función para probar acceso a una subasta específica
async function testAuctionById(auctionId) {
  return await debugAuctionAccess(auctionId);
}

// Función para probar todas las subastas activas
async function testAllActiveAuctions() {
  console.log("=== PRUEBA DE TODAS LAS SUBASTAS ACTIVAS ===");
  
  try {
    // Primero obtener las subastas activas
    const activeAuctions = await checkActiveAuctions();
    
    if (!activeAuctions || activeAuctions.count === "0") {
      console.log("No hay subastas activas para probar.");
      return [];
    }
    
    console.log(`Probando ${activeAuctions.sampleIds.length} subastas activas...`);
    
    const results = [];
    for (const id of activeAuctions.sampleIds) {
      console.log(`\nProbando subasta #${id}...`);
      const auctionData = await debugAuctionAccess(id);
      
      results.push({
        id,
        success: !!auctionData,
        data: auctionData
      });
    }
    
    console.log("\nResumen de pruebas:");
    results.forEach(result => {
      console.log(`Subasta #${result.id}: ${result.success ? 'ÉXITO' : 'FALLÓ'}`);
    });
    
    return results;
  } catch (error) {
    console.error("Error en prueba de subastas activas:", error);
    return null;
  } finally {
    console.log("=== FIN PRUEBA DE SUBASTAS ACTIVAS ===");
  }
}

// Utilizar estas funciones desde la consola con:
// await debugAuctionAccess(1); // Probar una subasta específica
// await checkContractBalance(); // Verificar balance del contrato
// await checkActiveAuctions(); // Verificar subastas activas
// await testAllActiveAuctions(); // Probar todas las subastas activas 