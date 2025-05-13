import { ethers } from 'ethers';

export const connectWallet = async () => {
  if (typeof window.ethereum !== 'undefined') {
    try {
      // Solicitar conexión de cuenta
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      
      // Obtener proveedor y signer
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const address = await signer.getAddress();
      
      // Verificar que estamos en la red correcta (Base)
      const network = await provider.getNetwork();
      const isCorrectNetwork = network.chainId === Number(process.env.NEXT_PUBLIC_BASE_CHAINID);
      
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
  if (typeof window.ethereum !== 'undefined') {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${Number(process.env.NEXT_PUBLIC_BASE_CHAINID).toString(16)}` }],
      });
      return true;
    } catch (switchError: any) {
      // Si el error es 4902, la red no está añadida
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: `0x${Number(process.env.NEXT_PUBLIC_BASE_CHAINID).toString(16)}`,
                chainName: 'Base Mainnet',
                nativeCurrency: {
                  name: 'ETH',
                  symbol: 'ETH',
                  decimals: 18,
                },
                rpcUrls: [`https://base-mainnet.infura.io/v3/${process.env.NEXT_PUBLIC_INFURA_API_KEY}`],
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
  if (typeof window.ethereum !== 'undefined') {
    window.ethereum.on('accountsChanged', callback);
    return () => {
      window.ethereum.removeListener('accountsChanged', callback);
    };
  }
  return () => {};
};

export const listenToChainChanges = (callback: (chainId: string) => void) => {
  if (typeof window.ethereum !== 'undefined') {
    window.ethereum.on('chainChanged', callback);
    return () => {
      window.ethereum.removeListener('chainChanged', callback);
    };
  }
  return () => {};
}; 