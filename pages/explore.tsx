import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import NFTCard from '../components/NFTCard';
import { getContract, getProvider, Auction, parseEther } from '../utils/contract';

interface WalletState {
  isConnected: boolean;
  address: string;
  signer: ethers.Signer | null;
}

interface ExploreProps {
  walletState: WalletState;
}

const ExplorePage: React.FC<ExploreProps> = ({ walletState }) => {
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [page, setPage] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const pageSize = 10;

  const fetchAuctions = async (pageNum: number, reset: boolean = false) => {
    try {
      setLoading(true);
      const provider = getProvider();
      const contract = getContract(provider);

      // Obtener IDs de subastas activas
      const auctionIds = await contract.getActiveAuctions(pageNum, pageSize);
      
      // Si no hay resultados, no hay más páginas
      if (auctionIds.length === 0) {
        setHasMore(false);
        setLoading(false);
        return;
      }

      // Obtener detalles de las subastas
      const auctionDetails = await contract.getManyAuctionDetails(auctionIds);
      
      setAuctions(reset ? auctionDetails : [...auctions, ...auctionDetails]);
      setPage(pageNum);
    } catch (error) {
      console.error('Error al cargar subastas:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuctions(0, true);
  }, []);

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      fetchAuctions(page + 1);
    }
  };

  const handleBid = async (auctionId: ethers.BigNumber, amount: string) => {
    if (!walletState.isConnected || !walletState.signer) {
      alert('Por favor conecta tu wallet primero');
      return;
    }

    try {
      const contract = getContract(walletState.signer);
      const bidAmountWei = parseEther(amount);
      
      const tx = await contract.placeBid(auctionId, bidAmountWei);
      await tx.wait();
      
      // Recargar datos
      fetchAuctions(0, true);
      
      alert('¡Oferta realizada con éxito!');
    } catch (error: any) {
      console.error('Error al hacer oferta:', error);
      alert(`Error: ${error.message || 'Hubo un problema al hacer la oferta'}`);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Explorar Subastas</h1>
      
      {loading && auctions.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Cargando subastas...</p>
        </div>
      ) : auctions.length === 0 ? (
        <div className="text-center py-12">
          <h2 className="text-xl font-medium text-gray-500">No hay subastas activas en este momento</h2>
          <p className="mt-2 text-gray-400">Vuelve más tarde para ver nuevas subastas</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {auctions.map((auction, index) => (
              <NFTCard
                key={index}
                auction={auction}
                onBid={handleBid}
                currentUserAddress={walletState.address}
              />
            ))}
          </div>
          
          {hasMore && (
            <div className="text-center mt-8">
              <button
                onClick={handleLoadMore}
                disabled={loading}
                className="btn btn-outline"
              >
                {loading ? 'Cargando...' : 'Cargar más'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ExplorePage;
