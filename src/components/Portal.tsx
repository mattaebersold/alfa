import React, { createContext, useContext, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';

/**
 * A layer over everything in a host, for things that must not be clipped by
 * whatever they're declared inside — an autocomplete's list, which hangs above
 * its field and was cut off at the top of the form's scroll view.
 *
 * Put a `PortalHost` at the root of the app and inside every RN Modal: a Modal
 * is its own window, so the app root's layer is underneath it. A `Portal` draws
 * into the nearest host, or in place when there isn't one.
 */
type Host = {
  set: (key: string, node: ReactNode | null) => void;
  /** The layer itself — measure it to turn window points into its own. */
  layer: React.RefObject<View | null>;
};

const HostContext = createContext<Host | null>(null);

export function PortalHost({ children }: { children: ReactNode }) {
  const [nodes, setNodes] = useState<Record<string, ReactNode>>({});
  const layer = useRef<View>(null);
  // Stable, so a portal's update re-renders the layer and not every consumer.
  const host = useMemo<Host>(() => ({
    set: (key, node) => setNodes((prev) => {
      if (node == null) {
        if (!(key in prev)) return prev;
        const { [key]: _gone, ...rest } = prev;
        return rest;
      }
      return { ...prev, [key]: node };
    }),
    layer,
  }), []);

  return (
    <HostContext.Provider value={host}>
      <View style={styles.fill}>
        {children}
        <View ref={layer} style={StyleSheet.absoluteFill} pointerEvents="box-none" collapsable={false}>
          {Object.entries(nodes).map(([key, node]) => <React.Fragment key={key}>{node}</React.Fragment>)}
        </View>
      </View>
    </HostContext.Provider>
  );
}

/** The nearest host, or null. */
export function usePortalHost(): Host | null {
  return useContext(HostContext);
}

/** Draws its children into the nearest PortalHost's layer — or here, with none. */
export function Portal({ children }: { children: ReactNode }) {
  const host = useContext(HostContext);
  const key = useId();
  useLayoutEffect(() => {
    host?.set(key, children);
  });
  useLayoutEffect(() => () => host?.set(key, null), [host, key]);
  return host ? null : <>{children}</>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
