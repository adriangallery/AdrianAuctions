# Adrian Auctions

Plataforma de subastas para NFTs en la red Base. Este proyecto permite a los usuarios crear subastas, ofertar y reclamar NFTs ganados.

## Acceso al proyecto

Puedes acceder al proyecto de dos formas:

- **Repositorio de GitHub**: [https://github.com/adriangallery/AdrianAuctions](https://github.com/adriangallery/AdrianAuctions)
- **Aplicación web**: [https://adriangallery.github.io/AdrianAuctions/](https://adriangallery.github.io/AdrianAuctions/)

## Características

- Conexión con MetaMask y otras carteras compatibles con Web3
- Exploración de subastas activas
- Creación de subastas para NFTs
- Realización de ofertas en subastas activas
- Gestión de subastas creadas
- Seguimiento de ofertas realizadas

## Tecnologías

- Next.js
- React
- ethers.js (v5)
- Solidity (Contrato inteligente desplegado en Base)

## Contrato desplegado

El contrato inteligente está desplegado en la red Base Mainnet:
- Dirección: 0xb502e19e62eE8D5Ee1F179b489d832EAb328Bc99

## Configuración local

1. Clona el repositorio:
```bash
git clone https://github.com/adriangallery/AdrianAuctions.git
cd AdrianAuctions
```

2. Instala las dependencias:
```bash
npm install
```

3. Configura las variables de entorno:
- Copia el archivo `.env.example` a `.env.local`:
```bash
cp .env.example .env.local
```
- Edita `.env.local` y añade tus propias claves de API:
```
NEXT_PUBLIC_INFURA_API_KEY=tu_clave_api_de_infura
NEXT_PUBLIC_CONTRACT_ADDRESS=0xb502e19e62eE8D5Ee1F179b489d832EAb328Bc99
NEXT_PUBLIC_BASE_CHAINID=8453
NEXT_PUBLIC_ADRIAN_TOKEN_ADDRESS=direccion_del_token_adrian
```

4. Ejecuta el proyecto en modo desarrollo:
```bash
npm run dev
```

## Estructura del proyecto

- `/components`: Componentes reutilizables de React
- `/pages`: Páginas de Next.js
- `/utils`: Utilidades para interactuar con el contrato y la wallet
- `/styles`: Estilos globales y componentes
- `/public`: Archivos estáticos

## Licencia

MIT 