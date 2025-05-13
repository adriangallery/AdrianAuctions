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

  useEffect(() => {
    const initWallet = async () => {
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
    };

    initWallet();

    // Configurar listeners para cambios de cuenta y red
    const accountsUnsubscribe = listenToAccountChanges(async () => {
      const walletData = await connectWallet();
      setWalletState({
        provider: walletData.provider,
        signer: walletData.signer,
        address: walletData.address,
        isConnected: walletData.isConnected,
        isCorrectNetwork: walletData.isCorrectNetwork
      });
    });

    const chainUnsubscribe = listenToChainChanges(async () => {
      const walletData = await connectWallet();
      setWalletState({
        provider: walletData.provider,
        signer: walletData.signer,
        address: walletData.address,
        isConnected: walletData.isConnected,
        isCorrectNetwork: walletData.isCorrectNetwork
      });
    });

    return () => {
      accountsUnsubscribe();
      chainUnsubscribe();
    };
  }, []);

  return (
    <>
      <Navbar />
      <main className="container mx-auto py-8">
        <Component {...pageProps} walletState={walletState} />
      </main>
    </>
  );
} 