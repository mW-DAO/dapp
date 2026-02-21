"use client";

import React, { useRef, useEffect } from "react";
import { useAuthAction } from "@/hooks/useAuthAction";
import { useAppKitState } from "@reown/appkit/react";

interface AuthGuardProps {
  children: React.ReactElement;
  /**
   * 鉴权通过后点击执行的回调（可选，通常直接继承 children 的 onClick）
   */
  onClick?: (e: React.MouseEvent) => void;
  /**
   * 登录成功后是否自动恢复执行被拦截的操作
   * @default true
   */
  autoResume?: boolean;
}

export function AuthGuard({ children, onClick, autoResume = true }: AuthGuardProps) {
  const { runWithAuth, isConnected } = useAuthAction();
  const { open: isModalOpen } = useAppKitState();

  const pendingActionRef = useRef<(() => void) | null>(null);
  const isRequesterRef = useRef(false);

  useEffect(() => {
    if (isConnected && isRequesterRef.current && pendingActionRef.current) {
      console.log("[AuthGuard] Login successful (this tab), resuming pending action...");
      pendingActionRef.current();
      pendingActionRef.current = null;
      isRequesterRef.current = false;
    }
  }, [isConnected]);

  useEffect(() => {
    if (!isModalOpen && !isConnected && (pendingActionRef.current || isRequesterRef.current)) {
      console.log("[AuthGuard] Modal closed without login, clearing session.");
      pendingActionRef.current = null;
      isRequesterRef.current = false;
    }
  }, [isModalOpen, isConnected]);

  const handleInterceptClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const triggerAction = () => {
      if (onClick) {
        onClick(e);
      } else if ((children.props as any).onClick) {
        (children.props as any).onClick(e);
      }
    };

    if (isConnected) {
      triggerAction();
    } else {
      if (autoResume) {
        console.log("[AuthGuard] Not connected, locking session for resume...");
        pendingActionRef.current = triggerAction;
        isRequesterRef.current = true;
      } else {
        pendingActionRef.current = null;
        isRequesterRef.current = false;
      }

      runWithAuth(() => {});
    }
  };

  if (!React.isValidElement(children)) {
    return <>{children}</>;
  }

  return React.cloneElement(children as React.ReactElement<any>, {
    onClick: handleInterceptClick,
  });
}
