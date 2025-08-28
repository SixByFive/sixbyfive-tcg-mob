// hooks/useToast.js
// Tiny hook returns toast.show(message, { type, duration })

import { useToastInternal } from "../components/ui/ToastProvider";

export default function useToast() {
  const ctx = useToastInternal();
  return ctx || { show: () => {}, remove: () => {} };
}
