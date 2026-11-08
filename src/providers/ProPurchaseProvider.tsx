import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useGetIapConfigQuery, useVerifyIapPurchaseMutation } from '../api/apiService';
import { useAppSelector } from '../store/store';

/**
 * Buying Pro in the app: the App Store on iOS, Google Play on Android. $10 a
 * month, set in App Store Connect and the Play Console. What's shown here is
 * the store's own localised price, never a number of ours.
 *
 * ## The flow
 *
 * The store takes the money and reports a purchase to the listener below,
 * which posts it to horacio (`api/billing/iap/verify`). horacio checks it with
 * Apple or Google and grants Pro. Only then is the transaction finished. A
 * purchase that can't be verified stays unfinished, and the store hands it
 * back on the next launch to try again. That's also how a purchase interrupted
 * by a crash or a dead network still lands. Renewals, cancellations and
 * refunds after that go store → horacio directly; the app only reads the
 * result off the profile.
 *
 * ## Off until the server says otherwise
 *
 * `enabled` comes from `api/billing/iap/config`. Until it's true, `ready` is
 * false and the Pro sheet keeps its "get notified" button, so nothing changes
 * for anyone. horacio can switch it on for testers first (IAP_TESTER_IDS)
 * without a build.
 *
 * The store module is loaded lazily and guarded, so a binary built before
 * react-native-iap was added just reports itself unavailable instead of
 * crashing at import.
 *
 * Status, server side, store setup and the launch checklist:
 * horacio/IN_APP_PURCHASE.md.
 */

type Rniap = typeof import('react-native-iap');

let iapModule: Rniap | null | undefined;
function loadIap(): Rniap | null {
  if (iapModule !== undefined) return iapModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod: Rniap = require('react-native-iap');
    iapModule = mod.isNitroReady() ? mod : null;
  } catch {
    iapModule = null;
  }
  return iapModule;
}

export type ProPurchaseState = {
  /** The store is connected and Pro can be bought right now. */
  ready: boolean;
  /** The store's own price string, e.g. "$9.99" — localised, with currency. */
  price: string | null;
  /** A purchase or restore is under way. */
  busy: boolean;
  /** The last thing that went wrong, in words for the member. Cleared on retry. */
  error: string | null;
  /** True once a purchase or restore has been verified this session. */
  purchased: boolean;
  /** Which store, for the "cancel anytime in …" line. */
  storeName: string;
  subscribe: () => Promise<void>;
  restore: () => Promise<void>;
  /** The store's own subscription settings: cancel, change card. */
  manage: () => Promise<void>;
};

const STORE_NAME = Platform.OS === 'ios' ? 'App Store' : 'Google Play';

const noop = async () => {};
const UNAVAILABLE: ProPurchaseState = {
  ready: false, price: null, busy: false, error: null, purchased: false,
  storeName: STORE_NAME, subscribe: noop, restore: noop, manage: noop,
};

const ProPurchaseContext = createContext<ProPurchaseState>(UNAVAILABLE);

/** The Pro purchase, for the sheet that sells it. */
export function useProPurchase(): ProPurchaseState {
  return useContext(ProPurchaseContext);
}

/** Store errors that are the member changing their mind, not something broken. */
const SILENT_ERRORS = new Set(['user-cancelled', 'deferred-payment']);

export function ProPurchaseProvider({ children }: { children: React.ReactNode }) {
  const isLoggedIn = useAppSelector((s) => s.auth.isLoggedIn);
  const platform = Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : null;
  const { data: config } = useGetIapConfigQuery(undefined, { skip: !isLoggedIn || !platform });
  const [verify] = useVerifyIapPurchaseMutation();

  const enabled = !!(isLoggedIn && platform && config?.enabled && loadIap());
  const sku = config && platform ? config.productIds[platform] : null;

  const [connected, setConnected] = useState(false);
  const [price, setPrice] = useState<string | null>(null);
  const [offerToken, setOfferToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [purchased, setPurchased] = useState(false);

  // A different member on this device hasn't bought anything yet.
  useEffect(() => {
    if (!isLoggedIn) { setPurchased(false); setError(null); }
  }, [isLoggedIn]);

  // The listener outlives renders. It reads the latest of these through refs.
  const verifyRef = useRef(verify);
  verifyRef.current = verify;

  /**
   * Verify with horacio, then finish. Returns whether it was verified. A
   * rejection leaves the transaction open for the store to replay.
   */
  const settle = useCallback(async (purchase: import('react-native-iap').Purchase) => {
    const iap = loadIap();
    if (!iap || !platform || !purchase.purchaseToken) return false;
    try {
      await verifyRef.current({ platform, purchaseToken: purchase.purchaseToken }).unwrap();
    } catch (err: any) {
      setError(err?.data?.error ?? "We couldn't confirm your purchase yet. It'll retry the next time the app opens.");
      return false;
    }
    try {
      await iap.finishTransaction({ purchase, isConsumable: false });
    } catch {
      // Verified and granted; an unfinished transaction is just replayed and
      // verified again, which is harmless.
    }
    setPurchased(true);
    return true;
  }, [platform]);

  // Connect, load the product, and listen — for as long as selling is on.
  useEffect(() => {
    const iap = loadIap();
    if (!enabled || !iap || !sku) return;
    let cancelled = false;

    const updated = iap.purchaseUpdatedListener((purchase) => {
      if (purchase.productId !== sku) return;
      void settle(purchase).finally(() => { if (!cancelled) setBusy(false); });
    });
    const failed = iap.purchaseErrorListener((err) => {
      if (cancelled) return;
      setBusy(false);
      if (!SILENT_ERRORS.has(err.code)) setError(err.message || 'The purchase didn’t go through.');
    });

    (async () => {
      try {
        const ok = await iap.initConnection();
        if (!ok || cancelled) return;
        const products = await iap.fetchProducts({ skus: [sku], type: 'subs' });
        const product: any = (products ?? []).find((p: any) => p.id === sku);
        if (!product || cancelled) return;
        setPrice(product.displayPrice ?? null);
        // Google sells a subscription through an offer on a base plan; the
        // first is the plain monthly one unless an intro offer is set up.
        setOfferToken(product.subscriptionOffers?.[0]?.offerTokenAndroid ?? null);
        setConnected(true);
      } catch {
        // No store (a simulator without a StoreKit config, a device without
        // Play): stays unavailable, and the sheet keeps "get notified".
      }
    })();

    return () => {
      cancelled = true;
      updated.remove();
      failed.remove();
      setConnected(false);
    };
  }, [enabled, sku, settle]);

  const subscribe = useCallback(async () => {
    const iap = loadIap();
    if (!iap || !connected || !sku || !config) return;
    setError(null);
    setBusy(true);
    try {
      await iap.requestPurchase({
        type: 'subs',
        request: {
          apple: { sku, appAccountToken: config.appAccountToken },
          google: {
            skus: [sku],
            obfuscatedAccountId: config.obfuscatedAccountId,
            subscriptionOffers: offerToken ? [{ sku, offerToken }] : undefined,
          },
        },
      });
      // The outcome arrives through the listeners above, which clear `busy`.
    } catch (err: any) {
      setBusy(false);
      if (!SILENT_ERRORS.has(err?.code)) setError(err?.message ?? 'The purchase didn’t go through.');
    }
  }, [connected, sku, config, offerToken]);

  /** For a member who bought on another device or reinstalled. */
  const restore = useCallback(async () => {
    const iap = loadIap();
    if (!iap || !connected || !sku) return;
    setError(null);
    setBusy(true);
    try {
      const owned = (await iap.getAvailablePurchases()).filter((p) => p.productId === sku);
      // Newest first: that's the one carrying the current period.
      owned.sort((a, b) => b.transactionDate - a.transactionDate);
      if (owned.length === 0) {
        setError(`No Pro subscription found on this ${STORE_NAME} account.`);
      } else {
        await settle(owned[0]);
      }
    } catch (err: any) {
      setError(err?.message ?? "Couldn't reach the store. Please try again.");
    } finally {
      setBusy(false);
    }
  }, [connected, sku, settle]);

  const manage = useCallback(async () => {
    const iap = loadIap();
    if (!iap) return;
    try {
      await iap.deepLinkToSubscriptions({
        skuAndroid: sku ?? undefined,
        packageNameAndroid: 'co.openroadsociety.app',
      });
    } catch {
      // Nothing to do. The store's settings are still where they always are.
    }
  }, [sku]);

  const value = useMemo<ProPurchaseState>(() => ({
    ready: enabled && connected,
    price, busy, error, purchased,
    storeName: STORE_NAME,
    subscribe, restore, manage,
  }), [enabled, connected, price, busy, error, purchased, subscribe, restore, manage]);

  return <ProPurchaseContext.Provider value={value}>{children}</ProPurchaseContext.Provider>;
}
