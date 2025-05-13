import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  const basePath = process.env.NODE_ENV === 'production' ? '/AdrianAuctions' : '';
  
  return (
    <Html lang="es">
      <Head>
        <meta charSet="utf-8" />
        <meta name="description" content="Plataforma de subastas NFT en la red Base" />
        <link rel="icon" href={`${basePath}/favicon.ico`} />
        <meta name="theme-color" content="#000000" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
} 