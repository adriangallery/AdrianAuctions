import React, { useState, useEffect } from 'react';
import type { AppProps } from 'next/app';
import Navbar from '../components/Navbar';
import { ethers } from 'ethers';
import { connectWallet, listenToAccountChanges, listenToChainChanges } from '../utils/wallet';
import '../styles/globals.css';

type WalletState = {
  provider: ethers.providers.Web3Provider | null;
  signer: ethers.Signer | null;
  address: string;
  isConnected: boolean;
  isCorrectNetwork: boolean;
};

export default function MyApp({ Component, pageProps }: AppProps) {
  const [walletState, setWalletState] = useState<WalletState>({
    provider: null,
    signer: null,
    address: '',
    isConnected: false,
    isCorrectNetwork: false
  });
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Aseguramos que el código sólo se ejecuta en el navegador
    if (typeof window === 'undefined') return;

    const initWallet = async () => {
      try {
        if (typeof window.ethereum !== 'undefined') {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' }) as string[];
          if (accounts && accounts.length > 0) {
            const walletData = await connectWallet();
            setWalletState({
              provider: walletData.provider,
              signer: walletData.signer,
              address: walletData.address,
              isConnected: walletData.isConnected,
              isCorrectNetwork: walletData.isCorrectNetwork
            });
          }
        }
      } catch (error) {
        console.error('Error al inicializar la wallet:', error);
      } finally {
        setIsInitialized(true);
      }
    };

    initWallet();

    // Configurar listeners para cambios de cuenta y red
    const accountsUnsubscribe = listenToAccountChanges(async () => {
      try {
        const walletData = await connectWallet();
        setWalletState({
          provider: walletData.provider,
          signer: walletData.signer,
          address: walletData.address,
          isConnected: walletData.isConnected,
          isCorrectNetwork: walletData.isCorrectNetwork
        });
      } catch (error) {
        console.error('Error en el cambio de cuenta:', error);
      }
    });

    const chainUnsubscribe = listenToChainChanges(async () => {
      try {
        const walletData = await connectWallet();
        setWalletState({
          provider: walletData.provider,
          signer: walletData.signer,
          address: walletData.address,
          isConnected: walletData.isConnected,
          isCorrectNetwork: walletData.isCorrectNetwork
        });
      } catch (error) {
        console.error('Error en el cambio de red:', error);
      }
    });

    return () => {
      accountsUnsubscribe();
      chainUnsubscribe();
    };
  }, []);

  return (
    <>
      <Navbar walletState={walletState} />
      <main className="container mx-auto py-8">
        <Component {...pageProps} walletState={walletState} />
      </main>
    </>
  );
} 