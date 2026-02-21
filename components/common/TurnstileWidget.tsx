"use client";
import { Turnstile, TurnstileInstance } from "@marsidev/react-turnstile";
import { forwardRef } from "react";

interface Props {
  onSuccess?: (token: string) => void;
  className?: string;
  options?: any;
}

export const TurnstileWidget = forwardRef<TurnstileInstance, Props>(
  ({ onSuccess, className, options }, ref) => {
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

    if (!siteKey) {
      console.warn("Turnstile site key is missing!");
      return null;
    }

    return (
      <div className={className}>
        <Turnstile
          ref={ref}
          siteKey={siteKey}
          onSuccess={onSuccess}
          options={{
            size: "invisible", // 默认设为隐藏模式，无感验证
            ...options,
          }}
        />
      </div>
    );
  }
);

TurnstileWidget.displayName = "TurnstileWidget";
