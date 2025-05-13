import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { connectWallet, switchToBaseNetwork } from '../utils/wallet';
import { shortenAddress } from '../utils/contract';

const Navbar: React.FC = () => {
  const [address, setAddress] = useState<string>('');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isCorrectNetwork, setIsCorrectNetwork] = useState<boolean>(false);

  useEffect(() => {
    // Verificar si ya hay una conexión previa en localStorage
    const checkConnection = async () => {
      if (typeof window.ethereum !== 'undefined') {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' }) as string[];
        if (accounts && accounts.length > 0) {
          handleConnectWallet();
        }
      }
    };

    checkConnection();

    // Escuchar cambios de cuenta
    if (typeof window.ethereum !== 'undefined') {
      window.ethereum.on('accountsChanged', () => {
        handleConnectWallet();
      });
      
      window.ethereum.on('chainChanged', () => {
        handleConnectWallet();
      });
    }

    return () => {
      if (typeof window.ethereum !== 'undefined') {
        window.ethereum.removeListener('accountsChanged', handleConnectWallet);
        window.ethereum.removeListener('chainChanged', handleConnectWallet);
      }
    };
  }, []);

  const handleConnectWallet = async () => {
    const walletData = await connectWallet();
    setAddress(walletData.address);
    setIsConnected(walletData.isConnected);
    setIsCorrectNetwork(walletData.isCorrectNetwork);
  };

  const handleSwitchNetwork = async () => {
    const success = await switchToBaseNetwork();
    if (success) {
      setIsCorrectNetwork(true);
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