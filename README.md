# Adrian Auctions

Plataforma de subastas NFT en la red Base (Mainnet). Permite crear, ofertar y gestionar subastas de NFTs.

## Acceso a la aplicación

La aplicación está disponible directamente en:
**[https://adriangallery.github.io/AdrianAuctions/](https://adriangallery.github.io/AdrianAuctions/)**

## Características

- Conectividad con wallets Web3 (MetaMask, etc.)
- Exploración de subastas activas
- Creación de nuevas subastas para tus NFTs
- Realizar ofertas en ETH
- Gestión de tus propias subastas
- Reclamación de NFTs ganados

## Tecnologías utilizadas

- Next.js
- React
- TypeScript
- Ethers.js
- Contrato de subastas en Solidity (desplegado en Base Mainnet)

## Desarrollo local

Para ejecutar el proyecto localmente:

```bash
# Instalar dependencias
npm install

# Ejecutar servidor de desarrollo
npm run dev
```

## Dirección del contrato

El contrato de subastas está desplegado en la red Base Mainnet:
```
0xb502e19e62eE8D5Ee1F179b489d832EAb328Bc99
```

## Despliegue

El proyecto se despliega automáticamente en GitHub Pages mediante GitHub Actions cuando se realizan cambios en la rama `main`.

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