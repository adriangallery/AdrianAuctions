import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { connectWallet, switchToBaseNetwork } from '../utils/wallet';
import { shortenAddress } from '../utils/contract';
import { ethers } from 'ethers';

type WalletState = {
  provider: ethers.providers.Web3Provider | null;
  signer: ethers.Signer | null;
  address: string;
  isConnected: boolean;
  isCorrectNetwork: boolean;
};

interface NavbarProps {
  walletState?: WalletState;
}

const Navbar: React.FC<NavbarProps> = ({ walletState }) => {
  const [localWalletState, setLocalWalletState] = useState<{
    address: string;
    isConnected: boolean;
    isCorrectNetwork: boolean;
  }>({
    address: '',
    isConnected: false,
    isCorrectNetwork: false
  });

  // Usar props de walletState si están disponibles, de lo contrario usar estado local
  const address = walletState?.address || localWalletState.address;
  const isConnected = walletState?.isConnected || localWalletState.isConnected;
  const isCorrectNetwork = walletState?.isCorrectNetwork || localWalletState.isCorrectNetwork;

  // Mantener el estado local solo si no recibimos props de walletState
  useEffect(() => {
    if (walletState) return;

    // Verificar si ya hay una conexión previa
    const checkConnection = async () => {
      if (typeof window !== 'undefined' && typeof window.ethereum !== 'undefined') {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' }) as string[];
        if (accounts && accounts.length > 0) {
          handleConnectWallet();
        }
      }
    };

    checkConnection();

    // Escuchar cambios de cuenta
    if (typeof window !== 'undefined' && typeof window.ethereum !== 'undefined') {
      window.ethereum.on('accountsChanged', () => {
        handleConnectWallet();
      });
      
      window.ethereum.on('chainChanged', () => {
        handleConnectWallet();
      });
    }

    return () => {
      if (typeof window !== 'undefined' && typeof window.ethereum !== 'undefined') {
        window.ethereum.removeListener('accountsChanged', handleConnectWallet);
        window.ethereum.removeListener('chainChanged', handleConnectWallet);
      }
    };
  }, [walletState]);

  const handleConnectWallet = async () => {
    const walletData = await connectWallet();
    setLocalWalletState({
      address: walletData.address,
      isConnected: walletData.isConnected,
      isCorrectNetwork: walletData.isCorrectNetwork
    });
  };

  const handleSwitchNetwork = async () => {
    const success = await switchToBaseNetwork();
    if (success) {
      setLocalWalletState(prev => ({
        ...prev,
        isCorrectNetwork: true
      }));
    }
  };

  return (
    <nav className="bg-white shadow-md py-4">
      <div className="container mx-auto flex justify-between items-center">
        <Link href="/">
          <div className="text-xl font-bold text-primary-600">Adrian Auctions</div>
        </Link>

        <div className="flex items-center space-x-4">
          <Link href="/explore">
            <div className="hover:text-primary-600">Explorar</div>
          </Link>
          
          {isConnected && (
            <Link href="/myauctions">
              <div className="hover:text-primary-600">Mis Subastas</div>
            </Link>
          )}

          {!isConnected ? (
            <button
              onClick={handleConnectWallet}
              className="btn btn-primary"
            >
              Conectar Wallet
            </button>
          ) : !isCorrectNetwork ? (
            <button
              onClick={handleSwitchNetwork}
              className="btn btn-secondary"
            >
              Cambiar a Red Base
            </button>
          ) : (
            <div className="flex items-center bg-gray-100 rounded-full px-4 py-2">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
              <span>{shortenAddress(address)}</span>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar; 