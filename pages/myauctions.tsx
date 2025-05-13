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
      
      const contract = getContract(walletState.signer || ethers.getDefaultProvider());
      
      // Obtener IDs de subastas creadas por el usuario
      const createdAuctionIds = await contract.getUserAuctions(walletState.address);
      
      // Obtener IDs de subastas en las que el usuario ha ofertado
      const bidAuctionIds = await contract.getUserBids(walletState.address);
      
      // Si hay IDs, obtener detalles
      let createdAuctions: Auction[] = [];
      let bidAuctions: Auction[] = [];
      
      if (createdAuctionIds.length > 0) {
        createdAuctions = await contract.getManyAuctionDetails(createdAuctionIds);
      }
      
      if (bidAuctionIds.length > 0) {
        bidAuctions = await contract.getManyAuctionDetails(bidAuctionIds);
      }
      
      setMyAuctions(createdAuctions);
      setMyBids(bidAuctions);
    } catch (error) {
      console.error('Error al cargar subastas:', error);
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
      const bidAmountWei = parseEther(amount);
      
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

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Mis Subastas</h1>
      
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
          
          {activeTab === 'created' ? (
            myAuctions.length === 0 ? (
              <div className="text-center py-12">
                <h2 className="text-xl font-medium text-gray-500">No has creado ninguna subasta todavía</h2>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {myAuctions.map((auction, index) => (
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
            myBids.length === 0 ? (
              <div className="text-center py-12">
                <h2 className="text-xl font-medium text-gray-500">No has realizado ofertas en ninguna subasta</h2>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {myBids.map((auction, index) => (
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