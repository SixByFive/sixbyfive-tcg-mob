// hooks/useToast.js

import { useToastInternal } from "../components/ui/ToastProvider";

export default function useToast() {
  const ctx = useToastInternal();
  return ctx || { show: () => {}, remove: () => {} };
}
