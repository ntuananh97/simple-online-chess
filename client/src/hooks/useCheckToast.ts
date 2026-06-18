import { useEffect } from "react";
import { toast } from "sonner";

export function useCheckToast(isInCheck: boolean) {
  useEffect(() => {
    if (!isInCheck) {
      return;
    }

    toast.error("Check!");
  }, [isInCheck]);
}
