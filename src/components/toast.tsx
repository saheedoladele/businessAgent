"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CircleAlert, CircleCheck, X } from "lucide-react";

/**
 * Shows ?notice= / ?error= messages from server actions as a toast, then
 * removes them from the URL so a refresh doesn't show them again.
 */
export function Toast() {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const notice = params.get("notice");
  const error = params.get("error");
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  useEffect(() => {
    if (!notice && !error) return;
    setMessage({ text: (error ?? notice)!, error: !!error });
    const rest = new URLSearchParams(params);
    rest.delete("notice");
    rest.delete("error");
    router.replace(rest.size ? `${path}?${rest}` : path, { scroll: false });
  }, [notice, error, params, path, router]);

  useEffect(() => {
    if (!message || message.error) return; // errors stay until dismissed
    const t = setTimeout(() => setMessage(null), 5000);
    return () => clearTimeout(t);
  }, [message]);

  if (!message) return null;
  return (
    <div className={`toast${message.error ? " error" : ""}`} role={message.error ? "alert" : "status"}>
      {message.error ? <CircleAlert size={18} aria-hidden /> : <CircleCheck size={18} aria-hidden />}
      <span>{message.text}</span>
      <button onClick={() => setMessage(null)} aria-label="Dismiss">
        <X size={16} />
      </button>
    </div>
  );
}
