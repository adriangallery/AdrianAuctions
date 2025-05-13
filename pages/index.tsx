import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ethers } from 'ethers';
import { getContract, getProvider } from '../utils/contract';
import { connectWallet } from '../utils/wallet';

interface WalletState {
  isConnected: boolean;
  address: string;
}

interface HomeProps {
  walletState: WalletState;
}

const Home: React.FC<HomeProps> = ({ walletState }) => {
  const [activeAuctionsCount, setActiveAuctionsCount] = useState<number>(0);
  const [totalAuctions, setTotalAuctions] = useState<number>(0);

  useEffect(() => {
    const fetchAuctionStats = async () => {
      try {
        const provider = getProvider();
        const contract = getContract(provider);

        // Obtener contadores
        const activeCount = await contract.getActiveAuctionsCount();
        const totalCount = await contract.auctionCounter();

        setActiveAuctionsCount(activeCount.toNumber());
        setTotalAuctions(totalCount.toNumber());
      } catch (error) {
        console.error('Error al obtener estadísticas:', error);
      }
    };

    fetchAuctionStats();
  }, []);

  const handleConnectWallet = async () => {
    await connectWallet();
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Bienvenido a Adrian Auctions</h1>
        <p className="text-xl text-gray-600 mb-8">
          Plataforma de subastas NFT en la red Base
        </p>
        
        <div className="flex justify-center space-x-8 mb-12">
          <div className="text-center">
            <div className="text-3xl font-bold">{activeAuctionsCount}</div>
            <div className="text-gray-500">Subastas Activas</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold">{totalAuctions}</div>
            <div className="text-gray-500">Subastas Totales</div>
          </div>
        </div>

        <div className="flex justify-center space-x-4">
          {!walletState?.isConnected ? (
            <button
              onClick={handleConnectWallet}
              className="btn btn-primary text-lg px-6 py-3"
            >
              Conectar Wallet
            </button>
          ) : (
            <>
              <Link href="/explore">
                <button className="btn btn-primary text-lg px-6 py-3">
                  Explorar Subastas
                </button>
              </Link>
              
              <Link href="/myauctions">
                <button className="btn btn-outline text-lg px-6 py-3">
                  Mis Subastas
                </button>
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="w-full max-w-4xl">
        <h2 className="text-2xl font-bold mb-6">¿Cómo funciona?</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card p-6">
            <div className="text-xl font-bold mb-2">1. Conecta tu wallet</div>
            <p className="text-gray-600">
              Conéctate con MetaMask u otra wallet compatible con Base Mainnet.
            </p>
          </div>
          
          <div className="card p-6">
            <div className="text-xl font-bold mb-2">2. Explora las subastas</div>
            <p className="text-gray-600">
              Navega por las subastas activas o crea tu propia subasta para tus NFTs.
            </p>
          </div>
          
          <div className="card p-6">
            <div className="text-xl font-bold mb-2">3. Oferta o reclama</div>
            <p className="text-gray-600">
              Haz ofertas en subastas activas o reclama tus NFTs ganados.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;