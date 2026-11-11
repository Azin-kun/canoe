'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { FailoverRpcProvider, JsonRpcProvider } from 'near-api-js';
import { NearConnector, type EventMap } from '@hot-labs/near-connect';
import { CANOE_NETWORK, CANOE_RPC_URLS } from '@/lib/canoe/config';

type Wallet = Awaited<ReturnType<NearConnector['wallet']>>;
type ViewParams = { contractId: string; method: string; args?: Record<string, unknown> };
type CallParams = ViewParams & { gas?: string; deposit?: string };

interface NearContextValue {
  loading: boolean;
  signedAccountId: string;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  viewFunction: <T>(params: ViewParams) => Promise<T>;
  callFunction: (params: CallParams) => Promise<{ hash: string }>;
}

const NearContext = createContext<NearContextValue | undefined>(undefined);

function txHash(outcome: unknown): string {
  if (outcome && typeof outcome === 'object' && 'transaction_outcome' in outcome) {
    const tx = (outcome as { transaction_outcome?: { id?: unknown } }).transaction_outcome;
    if (tx && typeof tx.id === 'string') return tx.id;
  }
  return '';
}

export function NearProvider({ children }: PropsWithChildren) {
  const connector = useMemo(
    () => new NearConnector({ network: CANOE_NETWORK, providers: { mainnet: CANOE_RPC_URLS.mainnet, testnet: CANOE_RPC_URLS.testnet } }),
    [],
  );
  const rpc = useMemo(
    () => new FailoverRpcProvider(CANOE_RPC_URLS[CANOE_NETWORK].map((url) => new JsonRpcProvider({ url }))),
    [],
  );
  const [wallet, setWallet] = useState<Wallet | undefined>();
  const [signedAccountId, setSignedAccountId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const handleSignIn = (payload: EventMap['wallet:signIn']) => {
      if (cancelled) return;
      setWallet(payload.wallet);
      setSignedAccountId(payload.accounts[0]?.accountId ?? '');
    };
    const handleSignOut = () => {
      if (cancelled) return;
      setWallet(undefined);
      setSignedAccountId('');
    };
    connector.on('wallet:signIn', handleSignIn);
    connector.on('wallet:signOut', handleSignOut);
    connector
      .getConnectedWallet()
      .catch(() => null)
      .then((connected) => {
        if (cancelled) return;
        if (connected) {
          setWallet(connected.wallet);
          setSignedAccountId(connected.accounts[0]?.accountId ?? '');
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
      connector.off('wallet:signIn', handleSignIn);
      connector.off('wallet:signOut', handleSignOut);
    };
  }, [connector]);

  const signIn = useCallback(async () => {
    const connected = await connector.connect();
    setWallet(connected);
    const accounts = await connected.getAccounts();
    setSignedAccountId(accounts[0]?.accountId ?? '');
  }, [connector]);

  const signOut = useCallback(async () => {
    if (!wallet) return;
    await connector.disconnect(wallet);
    setWallet(undefined);
    setSignedAccountId('');
  }, [connector, wallet]);

  const viewFunction = useCallback(
    async <T,>({ contractId, method, args = {} }: ViewParams): Promise<T> =>
      (await rpc.callFunction({ contractId, method, args })) as T,
    [rpc],
  );

  const callFunction = useCallback(
    async ({ contractId, method, args = {}, gas = '50000000000000', deposit = '0' }: CallParams) => {
      if (!wallet) throw new Error('Wallet is not connected');
      const outcome: unknown = await wallet.signAndSendTransaction({
        receiverId: contractId,
        actions: [{ type: 'FunctionCall', params: { methodName: method, args, gas, deposit } }],
      });
      return { hash: txHash(outcome) };
    },
    [wallet],
  );

  const value = useMemo(
    () => ({ loading, signedAccountId, signIn, signOut, viewFunction, callFunction }),
    [loading, signedAccountId, signIn, signOut, viewFunction, callFunction],
  );
  return <NearContext.Provider value={value}>{children}</NearContext.Provider>;
}

export function useNearWallet(): NearContextValue {
  const context = useContext(NearContext);
  if (!context) throw new Error('useNearWallet must be used within NearProvider');
  return context;
}
