import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { ethers } from 'ethers';
import { Auction, formatEther, getAuctionTimeLeft, isAuctionActive, shortenAddress } from '../utils/contract';

interface NFTCardProps {
  auction: Auction;
  onBid?: (auctionId: ethers.BigNumber, amount: string) => Promise<void>;
  onEndAuction?: (auctionId: ethers.BigNumber) => Promise<void>;
  currentUserAddress?: string;
}

const NFTCard: React.FC<NFTCardProps> = ({
  auction,
  onBid,
  onEndAuction,
  currentUserAddress
}) => {
  const [bidAmount, setBidAmount] = useState<string>('');
  const [nftMetadata, setNftMetadata] = useState<any>({
    name: 'Cargando...',
    image: '/placeholder.png'
  });
  const [timeLeft, setTimeLeft] = useState<string>(getAuctionTimeLeft(auction.endTime));
  const [loading, setLoading] = useState<boolean>(false);

  const isActive = isAuctionActive(auction);
  const isSeller = currentUserAddress?.toLowerCase() === auction.seller.toLowerCase();
  const isHighestBidder = currentUserAddress?.toLowerCase() === auction.highestBidder.toLowerCase();
  const isReserveMet = auction.highestBid.gte(auction.reservePrice);
  const canEnd = isSeller && !auction.active;

  useEffect(() => {
    // Obtener metadatos del NFT
    const fetchMetadata = async () => {
      try {
        // Aquí normalmente consultaríamos el contrato ERC721 para obtener el tokenURI
        // y luego obtendríamos los metadatos. Por simplicidad, usamos datos falsos.
        const tokenId = auction.tokenId.toString();
        setNftMetadata({
          name: `NFT #${tokenId}`,
          image: `https://via.placeholder.com/300x300?text=NFT+${tokenId}`
        });
      } catch (error) {
        console.error('Error al cargar metadatos:', error);
      }
    };

    fetchMetadata();

    // Actualizar el tiempo restante cada segundo
    const timer = setInterval(() => {
      setTimeLeft(getAuctionTimeLeft(auction.endTime));
    }, 1000);

    return () => clearInterval(timer);
  }, [auction]);

  const handleBid = async () => {
    if (!onBid || !bidAmount) return;
    
    try {
      setLoading(true);
      await onBid(auction.tokenId, bidAmount);
      setBidAmount('');
    } catch (error) {
      console.error('Error al hacer oferta:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEndAuction = async () => {
    if (!onEndAuction) return;
    
    try {
      setLoading(true);
      await onEndAuction(auction.tokenId);
    } catch (error) {
      console.error('Error al finalizar subasta:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <div className="relative h-48 w-full mb-4 bg-gray-200 rounded-md overflow-hidden">
        <Image
          src={nftMetadata.image}
          alt={nftMetadata.name}
          fill
          style={{ objectFit: 'cover' }}
          priority
        />
      </div>
      
      <h3 className="text-lg font-semibold mb-2">{nftMetadata.name}</h3>
      
      <div className="text-sm text-gray-500 mb-2">
        <span>Vendedor: {shortenAddress(auction.seller)}</span>
      </div>
      
      <div className="flex justify-between items-center mb-3">
        <div>
          <div className="text-xs text-gray-500">Precio de reserva</div>
          <div className="font-semibold">{formatEther(auction.reservePrice)} ETH</div>
        </div>
        
        <div>
          <div className="text-xs text-gray-500">Oferta actual</div>
          <div className="font-semibold">
            {auction.highestBid.gt(0) ? `${formatEther(auction.highestBid)} ETH` : 'Sin ofertas'}
          </div>
        </div>
      </div>
      
      {isActive && (
        <div className="mb-3">
          <div className="text-xs text-gray-500">Tiempo restante</div>
          <div className="font-semibold">{timeLeft}</div>
        </div>
      )}
      
      {isActive && !isSeller && onBid && (
        <div className="mb-3">
          <div className="flex space-x-2">
            <input
              type="number"
              step="0.01"
              placeholder="ETH"
              value={bidAmount}
              onChange={(e) => setBidAmount(e.target.value)}
              className="flex-1 border rounded-md p-2 text-sm"
              min={formatEther(auction.highestBid.gt(0) ? auction.highestBid : auction.reservePrice)}
            />
            <button
              onClick={handleBid}
              disabled={loading || !bidAmount}
              className="btn btn-primary text-sm"
            >
              {loading ? 'Procesando...' : 'Ofertar'}
            </button>
          </div>
        </div>
      )}
      
      {!isActive && !auction.finalized && canEnd && onEndAuction && (
        <button
          onClick={handleEndAuction}
          disabled={loading}
          className="w-full btn btn-primary text-sm"
        >
          {loading ? 'Procesando...' : 'Finalizar Subasta'}
        </button>
      )}
      
      {auction.finalized && (
        <div className="text-center text-sm font-medium text-gray-500">
          Subasta finalizada
        </div>
      )}
      
      {isHighestBidder && isReserveMet && (
        <div className="mt-2 text-center text-sm font-medium text-green-500">
          ¡Eres el ganador!
        </div>
      )}
    </div>
  );
};

export default NFTCard;