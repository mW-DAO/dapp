"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, Atom, Plus, Pickaxe, User, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { isPublicRoute } from "@/config/auth";
import clsx from "clsx";

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [isPublishOpen, setIsPublishOpen] = useState(false);

  const navItems = [
    { name: "首页", href: "/", icon: Home },
    { name: "超级节点", href: "/node", icon: Atom },
    { name: "", href: "/publish", icon: Plus, isAction: true },
    { name: "我的矿机", href: "/miner", icon: Pickaxe },
    { name: "我的", href: "/mine", icon: User },
  ];

  return (
    <>
      <div className="pb-safe-area-inset-bottom fixed right-0 bottom-0 left-0 z-50 border-t border-gray-100 bg-white">
        <nav className="flex h-16 items-center justify-around px-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const isPublic = isPublicRoute(item.href);

            // 基础图标内容
            const NavIcon = (
              <div
                className={clsx(
                  "flex h-full w-full flex-col items-center justify-center space-y-1",
                  isActive ? "text-blue-600" : "text-gray-400"
                )}
              >
                <item.icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[10px] font-medium">{item.name}</span>
              </div>
            );

            // 1. 处理“发布”大按钮 (Action)
            if (item.isAction) {
              return (
                <div key={item.name} className="relative -top-5">
                  <AuthGuard>
                    <button
                      onClick={() => setIsPublishOpen(!isPublishOpen)}
                      className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-200 transition-transform active:scale-95"
                    >
                      <motion.div
                        animate={{ rotate: isPublishOpen ? 45 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <Plus size={32} />
                      </motion.div>
                    </button>
                  </AuthGuard>
                  <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] font-medium text-gray-500">
                    {item.name}
                  </span>
                </div>
              );
            }

            if (!isPublic) {
              return (
                <AuthGuard key={item.name} onClick={() => router.push(item.href)}>
                  <div className="flex-1 cursor-pointer">{NavIcon}</div>
                </AuthGuard>
              );
            }

            return (
              <Link key={item.name} href={item.href} className="flex-1">
                {NavIcon}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Publish Overlay */}
      <AnimatePresence>
        {isPublishOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex flex-col items-center justify-end bg-black/40 pb-24 backdrop-blur-sm"
          >
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              className="mb-8 flex w-64 flex-col gap-3"
            >
              {/* Close Button - Top Right */}
              <div className="flex hidden justify-end">
                <button
                  onClick={() => setIsPublishOpen(false)}
                  className="p-1 text-white/90 transition-colors hover:text-white"
                >
                  <X size={28} strokeWidth={2} />
                </button>
              </div>

              {/* Buttons Container */}
              <div className="flex flex-col items-center gap-5">
                <Link href="/node/create" className="w-56">
                  <button
                    onClick={() => setIsPublishOpen(false)}
                    className="w-full rounded-xl bg-white py-3 text-lg font-bold text-blue-600 shadow-xl transition-all hover:bg-gray-50 active:scale-95"
                  >
                    建立超级节点
                  </button>
                </Link>
                <Link href="/publish" className="w-56">
                  <button className="w-full rounded-xl bg-white py-3 text-lg font-bold text-blue-600 shadow-xl transition-all hover:bg-gray-50 active:scale-95">
                    发布信息
                  </button>
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
