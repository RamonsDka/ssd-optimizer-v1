// ─── useCopyFeedback ─────────────────────────────────────────────────────────
// Custom hook that copies text to the clipboard and shows a transient
// "copied" state (green checkmark) for 1.8 seconds.
//
// Usage:
//   const { copied, copy } = useCopyFeedback();
//   <button onClick={() => copy("some text")}>
//     {copied ? <Check /> : <Copy />}
//   </button>

import { useState, useCallback, useRef } from "react";

const FEEDBACK_DURATION_MS = 1800;

export interface UseCopyFeedbackReturn {
  /** True during the feedback window after a successful copy. */
  copied: boolean;
  /**
   * Copy `text` to the clipboard. Resolves to `true` on success,
   * `false` if the Clipboard API is unavailable or the copy fails.
   */
  copy: (text: string) => Promise<boolean>;
}

export function useCopyFeedback(): UseCopyFeedbackReturn {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copy = useCallback(async (text: string): Promise<boolean> => {
    // Clear any existing timer
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for older browsers / non-secure contexts
        const el = document.createElement("textarea");
        el.value = text;
        el.style.position = "fixed";
        el.style.opacity = "0";
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
      }

      setCopied(true);
      timerRef.current = setTimeout(() => {
        setCopied(false);
        timerRef.current = null;
      }, FEEDBACK_DURATION_MS);

      return true;
    } catch {
      return false;
    }
  }, []);

  return { copied, copy };
}
