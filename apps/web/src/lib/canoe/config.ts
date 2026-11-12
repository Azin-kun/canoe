export type NearNetwork = 'mainnet' | 'testnet';

export const CANOE_NETWORK: NearNetwork =
  process.env.NEXT_PUBLIC_NEAR_NETWORK === 'mainnet' ? 'mainnet' : 'testnet';
export const CANOE_CONTRACT = process.env.NEXT_PUBLIC_CANOE_CONTRACT || 'budget.canoe-dev.testnet';
export const CANOE_MERCHANT = process.env.NEXT_PUBLIC_CANOE_MERCHANT || 'canoe-dev.testnet';
export const CANOE_RPC_URLS: Record<NearNetwork, string[]> = {
  mainnet: ['https://free.rpc.fastnear.com'],
  testnet: ['https://test.rpc.fastnear.com'],
};

/** Basis points applied to every quote so real prices fit testnet balances (100 = 1%). */
const parsedScale = Number.parseInt(process.env.NEXT_PUBLIC_CANOE_DEMO_SCALE_BPS ?? '100', 10);
export const CANOE_DEMO_SCALE_BPS = Number.isInteger(parsedScale) && parsedScale > 0 && parsedScale <= 10_000 ? parsedScale : 100;

export const QUOTE_TTL_MS = 10 * 60 * 1000;

const EXPLORER = CANOE_NETWORK === 'mainnet' ? 'https://nearblocks.io' : 'https://testnet.nearblocks.io';
export const explorerTxUrl = (hash: string) => `${EXPLORER}/txns/${hash}`;
export const explorerAccountUrl = (account: string) => `${EXPLORER}/address/${account}`;

/** Wallets meant for developers; hidden from the picker unless NEXT_PUBLIC_CANOE_SHOW_DEV_WALLETS=true. */
export const DEV_WALLET_IDS = ['near-cli', 'ethereum-wallets'] as const;
export const CANOE_EXCLUDED_WALLETS: string[] =
  process.env.NEXT_PUBLIC_CANOE_SHOW_DEV_WALLETS === 'true' ? [] : [...DEV_WALLET_IDS];

export const METEOR_WALLET_URL = 'https://wallet.meteorwallet.app';
export const TESTNET_FAUCET_URL = 'https://docs.near.org/tools/faucet';
