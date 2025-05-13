import { ethers } from 'ethers';

export const connectWallet = async () => {
  if (typeof window !== 'undefined' && typeof window.ethereum !== 'undefined') {
    try {
      // Solicitar conexión de cuenta
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      
      // Obtener proveedor y signer
      const provider = new ethers.providers.Web3Provider(window.ethereum as any);
      const signer = provider.getSigner();
      const address = await signer.getAddress();
      
      // Verificar que estamos en la red correcta (Base)
      const network = await provider.getNetwork();
      const targetChainId = Number(process.env.NEXT_PUBLIC_BASE_CHAINID || 8453);
      const isCorrectNetwork = network.chainId === targetChainId;
      
      return { 
        provider,
        signer,
        address,
        isConnected: true,
        isCorrectNetwork
      };
    } catch (error) {
      console.error('Error al conectar wallet:', error);
      return {
        provider: null,
        signer: null,
        address: '',
        isConnected: false,
        isCorrectNetwork: false
      };
    }
  } else {
    console.log('Por favor instala MetaMask u otra wallet compatible con Ethereum');
    return {
      provider: null,
      signer: null,
      address: '',
      isConnected: false,
      isCorrectNetwork: false
    };
  }
};

export const switchToBaseNetwork = async () => {
  if (typeof window !== 'undefined' && typeof window.ethereum !== 'undefined') {
    try {
      const targetChainId = Number(process.env.NEXT_PUBLIC_BASE_CHAINID || 8453);
      const chainIdHex = `0x${targetChainId.toString(16)}`;
      
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainIdHex }],
      });
      return true;
    } catch (switchError: any) {
      // Si el error es 4902, la red no está añadida
      if (switchError.code === 4902) {
        try {
          const targetChainId = Number(process.env.NEXT_PUBLIC_BASE_CHAINID || 8453);
          const chainIdHex = `0x${targetChainId.toString(16)}`;
          const infuraApiKey = process.env.NEXT_PUBLIC_INFURA_API_KEY || '';
          
          // RPC URLs alternativos en caso de que Infura no esté disponible
          const rpcUrls = infuraApiKey 
            ? [`https://base-mainnet.infura.io/v3/${infuraApiKey}`, 'https://mainnet.base.org'] 
            : ['https://mainnet.base.org'];
          
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: chainIdHex,
                chainName: 'Base Mainnet',
                nativeCurrency: {
                  name: 'ETH',
                  symbol: 'ETH',
                  decimals: 18,
                },
                rpcUrls: rpcUrls,
                blockExplorerUrls: ['https://basescan.org/'],
              },
            ],
          });
          return true;
        } catch (addError) {
          console.error('Error al añadir la red Base:', addError);
          return false;
        }
      }
      console.error('Error al cambiar a la red Base:', switchError);
      return false;
    }
  } else {
    console.log('Por favor instala MetaMask u otra wallet compatible con Ethereum');
    return false;
  }
};

export const listenToAccountChanges = (callback: (accounts: string[]) => void) => {
  if (typeof window !== 'undefined' && typeof window.ethereum !== 'undefined') {
    const ethereum = window.ethereum;
    ethereum.on('accountsChanged', callback);
    return () => {
      ethereum.removeListener('accountsChanged', callback);
    };
  }
  return () => {};
};

export const listenToChainChanges = (callback: (chainId: string) => void) => {
  if (typeof window !== 'undefined' && typeof window.ethereum !== 'undefined') {
    const ethereum = window.ethereum;
    ethereum.on('chainChanged', callback);
    return () => {
      ethereum.removeListener('chainChanged', callback);
    };
  }
  return () => {};
}; 