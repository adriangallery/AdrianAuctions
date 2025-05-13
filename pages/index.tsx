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
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAuctionStats = async () => {
      try {
        setLoading(true);
        setError(null);
        const provider = getProvider();
        const contract = getContract(provider);
        
        if (!contract) {
          setError('No se pudo obtener el contrato. Comprueba la conexión de red.');
          setLoading(false);
          return;
        }

        // Obtener contadores
        const activeCount = await contract.getActiveAuctionsCount();
        const totalCount = await contract.auctionCounter();

        setActiveAuctionsCount(activeCount.toNumber());
        setTotalAuctions(totalCount.toNumber());
      } catch (error: any) {
        console.error('Error al obtener estadísticas:', error);
        setError(`Error al cargar los datos: ${error.message || 'Error desconocido'}`);
      } finally {
        setLoading(false);
      }
    };

    fetchAuctionStats();
    
    // Recargar estadísticas cada minuto
    const intervalId = setInterval(() => {
      fetchAuctionStats();
    }, 60000);
    
    return () => clearInterval(intervalId);
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
        
        {error ? (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-8 max-w-lg mx-auto">
            <p>{error}</p>
            <button 
              onClick={() => {
                setError(null);
                setLoading(true);
                const fetchData = async () => {
                  try {
                    const provider = getProvider();
                    const contract = getContract(provider);
                    
                    if (!contract) {
                      setError('No se pudo obtener el contrato. Comprueba la conexión de red.');
                      return;
                    }
            
                    const activeCount = await contract.getActiveAuctionsCount();
                    const totalCount = await contract.auctionCounter();
            
                    setActiveAuctionsCount(activeCount.toNumber());
                    setTotalAuctions(totalCount.toNumber());
                    setError(null);
                  } catch (err: any) {
                    setError(`Error al recargar los datos: ${err.message || 'Error desconocido'}`);
                  } finally {
                    setLoading(false);
                  }
                };
                fetchData();
              }}
              className="mt-2 bg-red-500 hover:bg-red-700 text-white py-1 px-2 rounded"
            >
              Reintentar
            </button>
          </div>
        ) : (
          <div className="flex justify-center space-x-8 mb-12">
            <div className="text-center">
              <div className="text-3xl font-bold">
                {loading ? (
                  <span className="opacity-50">...</span>
                ) : (
                  activeAuctionsCount
                )}
              </div>
              <div className="text-gray-500">Subastas Activas</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold">
                {loading ? (
                  <span className="opacity-50">...</span>
                ) : (
                  totalAuctions
                )}
              </div>
              <div className="text-gray-500">Subastas Totales</div>
            </div>
          </div>
        )}

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