// components/ui/ToastProvider.js
// Global provider + host renders a stack of animated toasts.
// Usage: const toast = useToast(); toast.show("Saved!", { type: "success" });

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import Toast from "./Toast";

const ToastCtx = createContext(null);

export function ToastProvider({ children, max = 3 }) {
  const [items, setItems] = useState([]); // [{ id, message, type, anim }]
  const idRef = useRef(0);

  const remove = useCallback((id) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((message, opts = {}) => {
    if (!message) return;
    const id = ++idRef.current;
    const type = opts.type || "info";
    const duration = Math.max(1200, Math.min(opts.duration ?? 2200, 8000));
    const anim = new Animated.Value(0);

    setItems((prev) => {
      const next = [...prev, { id, message, type, anim }];
      return next.slice(-max);
    });

    // in animation
    Animated.timing(anim, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();

    // schedule out
    const hide = () => {
      Animated.timing(anim, {
        toValue: 0,
        duration: 180,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start(({ finished }) => finished && remove(id));
    };

    const t = setTimeout(hide, duration);
    return () => {
      clearTimeout(t);
      hide();
    };
  }, [max, remove]);

  const api = useMemo(() => ({ show, remove }), [show, remove]);

  return (
    <ToastCtx.Provider value={api}>
      <View style={{ flex: 1 }}>{children}</View>

      {/* Host overlay */}
      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        <View pointerEvents="none" style={styles.container}>
          {items.map((t) => {
            const translateY = t.anim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] });
            const opacity = t.anim;
            return (
              <Animated.View
                key={t.id}
                style={[styles.item, { transform: [{ translateY }], opacity }]}
              >
                <Toast message={t.message} type={t.type} />
              </Animated.View>
            );
          })}
        </View>
      </View>
    </ToastCtx.Provider>
  );
}

export function useToastInternal() {
  return useContext(ToastCtx);
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 20,
    gap: 8,
    alignItems: "center",
  },
  item: { alignSelf: "stretch" },
});
