"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSafeNav } from "@/hooks/useSafeNav";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, Wallet } from "lucide-react";
import { useAppKit, useAppKitAccount } from "@reown/appkit/react";
import { useAppKitWallet } from "@reown/appkit-wallet-button/react";

function LoginContent() {
  const { safeBack, ...router } = useSafeNav();
  const searchParams = useSearchParams();
  const { open } = useAppKit();
  const { isConnected } = useAppKitAccount();
  const { connect } = useAppKitWallet();
  const [email, setEmail] = useState("");

  const callbackUrl = searchParams.get("callbackUrl");

  useEffect(() => {
    if (isConnected) {
      const isSafePath =
        callbackUrl &&
        callbackUrl.startsWith("/") &&
        !callbackUrl.startsWith("//") &&
        !callbackUrl.startsWith("/api/");

      if (isSafePath) {
        console.log(`[Login] Redirecting back to original target: ${callbackUrl}`);
        router.replace(callbackUrl as string);
      } else {
        router.replace("/");
      }
    }
  }, [isConnected, router, callbackUrl]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) return;
    try {
      await connect("email");
    } catch (error) {
      (open as any)({ view: "Connect", email: email });
    }
  };

  const handleSocialLogin = async (provider: "google" | "x") => {
    try {
      await connect(provider);
    } catch (error) {
      (open as any)({ view: "Connect", socialProvider: provider });
    }
  };

  const handleWalletLogin = () => {
    open();
  };

  return (
    <div className="relative flex h-[100dvh] flex-col overflow-hidden bg-white">
      {/* 返回按钮 */}
      <button
        onClick={() => router.push("/")}
        className="absolute top-4 left-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-gray-50 text-gray-600 shadow-sm transition-all hover:bg-gray-100 active:scale-95"
        aria-label="返回"
      >
        <ChevronLeft size={22} />
      </button>

      {/* 主内容区域 - 居中 */}
      <div className="flex flex-1 items-center justify-center overflow-hidden px-6">
        <div className="w-full max-w-[420px]">
          {/* Logo 区域 */}
          <div className="mb-5 text-center">
            <div className="mb-1 flex items-center justify-center gap-2">
              <svg width="36" height="36" viewBox="0 0 48 48" fill="none">
                <path
                  d="M12 24L24 12L36 24L24 36L12 24Z"
                  fill="#2563EB"
                  stroke="#2563EB"
                  strokeWidth="2"
                />
                <path d="M24 12V36M12 24H36" stroke="white" strokeWidth="2" />
              </svg>
              <div className="text-left">
                <div className="text-xs font-medium text-gray-400">EcoFi</div>
                <div className="text-2xl font-bold tracking-tight text-gray-900">m&W</div>
              </div>
            </div>
            <p className="text-xs tracking-[0.2em] text-gray-400">加密生态共建社区</p>
          </div>

          {/* 表单区域 */}
          <div className="space-y-3">
            <form onSubmit={handleEmailLogin} className="space-y-3">
              <div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="邮箱 / X / gmail ID"
                  className="w-full rounded-xl border-0 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-300 transition-colors focus:bg-gray-100 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={!email.trim()}
                className="mt-3 w-full rounded-xl bg-blue-600 py-2.5 text-base font-bold text-white shadow-lg shadow-blue-600/30 transition-all hover:bg-blue-700 hover:shadow-blue-600/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                登录
              </button>

              <div className="flex items-center justify-between pt-0 text-sm">
                <button
                  type="button"
                  className="text-gray-300 transition-colors hover:text-gray-500"
                >
                  忘记密码？
                </button>
                <button
                  type="button"
                  className="font-medium text-blue-600 transition-colors hover:text-blue-700"
                >
                  新用户注册
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* 第三方登录 - 固定在底部 */}
      <div className="px-6 pb-4">
        <div className="mx-auto w-full max-w-[420px]">
          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-100"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-4 text-gray-300">第三方登录</span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-8">
            <button
              onClick={() => handleSocialLogin("google")}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-100 bg-white transition-all hover:bg-gray-50 active:scale-95"
              aria-label="使用 Google 登录"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  fill="var(--brand-blue)"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
            </button>

            <button
              onClick={() => handleSocialLogin("x")}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-100 bg-white transition-all hover:bg-gray-50 active:scale-95"
              aria-label="使用 X 登录"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </button>

            <button
              onClick={handleWalletLogin}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-100 bg-white transition-all hover:bg-gray-50 active:scale-95"
              aria-label="使用钱包登录"
            >
              <Wallet className="h-4 w-4 text-gray-400" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[100dvh] items-center justify-center bg-white text-gray-400">
          正在进入...
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
