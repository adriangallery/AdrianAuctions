import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import NFTCard from '../components/NFTCard';
import { getContract, Auction, parseEther } from '../utils/contract';
import { connectWallet } from '../utils/wallet';

interface WalletState {
  isConnected: boolean;
  address: string;
  signer: ethers.Signer | null;
}

interface MyAuctionsProps {
  walletState: WalletState;
}

const MyAuctionsPage: React.FC<MyAuctionsProps> = ({ walletState }) => {
  const [myAuctions, setMyAuctions] = useState<Auction[]>([]);
  const [myBids, setMyBids] = useState<Auction[]>([]);
  const [activeTab, setActiveTab] = useState<'created' | 'bids'>('created');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'ended'>('all');

  useEffect(() => {
    if (walletState.isConnected && walletState.address) {
      fetchMyAuctions();
    } else {
      setMyAuctions([]);
      setMyBids([]);
      setLoading(false);
    }
  }, [walletState.isConnected, walletState.address]);

  const fetchMyAuctions = async () => {
    if (!walletState.address) return;

    try {
      setLoading(true);
      setError(null);
      
      const contract = getContract(walletState.signer || ethers.getDefaultProvider());
      
      if (!contract) {
        setError('No se pudo obtener el contrato. Comprueba la conexión de red.');
        setLoading(false);
        return;
      }
      
      // Obtener IDs de subastas creadas por el usuario
      const createdAuctionIds = await contract.getUserAuctions(walletState.address);
      
      // Obtener IDs de subastas en las que el usuario ha ofertado
      const bidAuctionIds = await contract.getUserBids(walletState.address);
      
      // Si hay IDs, obtener detalles
      let createdAuctions: Auction[] = [];
      let bidAuctions: Auction[] = [];
      
      if (createdAuctionIds.length > 0) {
        const auctionDetails = await contract.getManyAuctionDetails(createdAuctionIds);
        // Filtrar resultados nulos o inválidos
        createdAuctions = auctionDetails.filter((auction: Auction) => 
          auction && auction.nftContract && auction.tokenId
        );
      }
      
      if (bidAuctionIds.length > 0) {
        const auctionDetails = await contract.getManyAuctionDetails(bidAuctionIds);
        // Filtrar resultados nulos o inválidos
        bidAuctions = auctionDetails.filter((auction: Auction) => 
          auction && auction.nftContract && auction.tokenId
        );
      }
      
      setMyAuctions(createdAuctions);
      setMyBids(bidAuctions);
    } catch (error: any) {
      console.error('Error al cargar subastas:', error);
      setError(`Error al cargar subastas: ${error.message || 'Error desconocido'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleBid = async (auctionId: ethers.BigNumber, amount: string) => {
    if (!walletState.isConnected || !walletState.signer) {
      alert('Por favor conecta tu wallet primero');
      return;
    }

    try {
      const contract = getContract(walletState.signer);
      
      if (!contract) {
        alert('No se pudo conectar con el contrato');
        return;
      }
      
      const bidAmountWei = parseEther(amount);
      
      // Mostrar mensaje de espera
      alert('Procesando la oferta, por favor confirma la transacción en tu wallet...');
      
      const tx = await contract.placeBid(auctionId, bidAmountWei);
      await tx.wait();
      
      // Recargar datos
      fetchMyAuctions();
      
      alert('¡Oferta realizada con éxito!');
    } catch (error: any) {
      console.error('Error al hacer oferta:', error);
      alert(`Error: ${error.message || 'Hubo un problema al hacer la oferta'}`);
    }
  };

  const handleEndAuction = async (auctionId: ethers.BigNumber) => {
    if (!walletState.isConnected || !walletState.signer) {
      alert('Por favor conecta tu wallet primero');
      return;
    }

    try {
      const contract = getContract(walletState.signer);
      
      if (!contract) {
        alert('No se pudo conectar con el contrato');
        return;
      }
      
      // Mostrar mensaje de espera
      alert('Finalizando la subasta, por favor confirma la transacción en tu wallet...');
      
      const tx = await contract.endAuction(auctionId);
      await tx.wait();
      
      // Recargar datos
      fetchMyAuctions();
      
      alert('¡Subasta finalizada con éxito!');
    } catch (error: any) {
      console.error('Error al finalizar subasta:', error);
      alert(`Error: ${error.message || 'Hubo un problema al finalizar la subasta'}`);
    }
  };

  const handleConnectWallet = async () => {
    await connectWallet();
  };

  // Filtrar las subastas según el filtro activo
  const filterAuctions = (auctions: Auction[]) => {
    const now = Math.floor(Date.now() / 1000);
    
    if (activeFilter === 'active') {
      return auctions.filter(auction => 
        auction.active && !auction.finalized && auction.endTime.toNumber() > now
      );
    } else if (activeFilter === 'ended') {
      return auctions.filter(auction => 
        !auction.active || auction.finalized || auction.endTime.toNumber() <= now
      );
    }
    
    return auctions;
  };

  const filteredCreatedAuctions = filterAuctions(myAuctions);
  const filteredBidAuctions = filterAuctions(myBids);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Mis Subastas</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p>{error}</p>
          <button 
            onClick={fetchMyAuctions}
            className="mt-2 bg-red-500 hover:bg-red-700 text-white py-1 px-2 rounded"
          >
            Reintentar
          </button>
        </div>
      )}
      
      {!walletState.isConnected ? (
        <div className="text-center py-12">
          <h2 className="text-xl font-medium text-gray-500 mb-4">Conecta tu wallet para ver tus subastas</h2>
          <button
            onClick={handleConnectWallet}
            className="btn btn-primary"
          >
            Conectar Wallet
          </button>
        </div>
      ) : loading ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Cargando subastas...</p>
        </div>
      ) : (
        <div>
          <div className="flex border-b mb-6">
            <button
              className={`py-2 px-4 mr-4 font-medium ${activeTab === 'created' ? 'border-b-2 border-primary-600 text-primary-600' : 'text-gray-500'}`}
              onClick={() => setActiveTab('created')}
            >
              Mis Subastas Creadas
            </button>
            <button
              className={`py-2 px-4 font-medium ${activeTab === 'bids' ? 'border-b-2 border-primary-600 text-primary-600' : 'text-gray-500'}`}
              onClick={() => setActiveTab('bids')}
            >
              Mis Ofertas
            </button>
          </div>
          
          <div className="mb-6">
            <div className="flex space-x-4 mb-4">
              <button
                className={`py-1 px-3 rounded ${activeFilter === 'all' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
                onClick={() => setActiveFilter('all')}
              >
                Todas
              </button>
              <button
                className={`py-1 px-3 rounded ${activeFilter === 'active' ? 'bg-green-500 text-white' : 'bg-gray-200'}`}
                onClick={() => setActiveFilter('active')}
              >
                Activas
              </button>
              <button
                className={`py-1 px-3 rounded ${activeFilter === 'ended' ? 'bg-gray-500 text-white' : 'bg-gray-200'}`}
                onClick={() => setActiveFilter('ended')}
              >
                Finalizadas
              </button>
            </div>
          </div>
          
          {activeTab === 'created' ? (
            filteredCreatedAuctions.length === 0 ? (
              <div className="text-center py-12">
                <h2 className="text-xl font-medium text-gray-500">
                  {myAuctions.length === 0 
                    ? 'No has creado ninguna subasta todavía' 
                    : `No hay subastas ${activeFilter === 'active' ? 'activas' : activeFilter === 'ended' ? 'finalizadas' : ''}`}
                </h2>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredCreatedAuctions.map((auction, index) => (
                  <NFTCard
                    key={index}
                    auction={auction}
                    onBid={handleBid}
                    onEndAuction={handleEndAuction}
                    currentUserAddress={walletState.address}
                  />
                ))}
              </div>
            )
          ) : (
            filteredBidAuctions.length === 0 ? (
              <div className="text-center py-12">
                <h2 className="text-xl font-medium text-gray-500">
                  {myBids.length === 0 
                    ? 'No has realizado ofertas en ninguna subasta' 
                    : `No hay ofertas en subastas ${activeFilter === 'active' ? 'activas' : activeFilter === 'ended' ? 'finalizadas' : ''}`}
                </h2>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredBidAuctions.map((auction, index) => (
                  <NFTCard
                    key={index}
                    auction={auction}
                    onBid={handleBid}
                    currentUserAddress={walletState.address}
                  />
                ))}
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
};

export default MyAuctionsPage;