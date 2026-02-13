export const SERVER_CONFIG = {
  name: 'Akash-MCP-Server',
  version: '1.0.0',
  port: process.env.PORT || 3000,
  environment: process.env.NODE_ENV || 'development',
  rpcEndpoint: process.env.RPC_ENDPOINT || 'https://rpc.akashnet.net:443',
  mnemonic: process.env.AKASH_MNEMONIC || '',
  privateKey: process.env.AKASH_PRIVATE_KEY || '',
} as const;

export type ServerConfig = typeof SERVER_CONFIG;
