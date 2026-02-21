"use client";

import { Drawer } from "vaul";
import React, { useState } from "react";
import { X } from "lucide-react";

interface InfoDrawerProps {
  title: string;
  trigger: React.ReactNode;
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * A generic bottom sheet drawer for displaying information.
 * Suitable for mobile help/context.
 */
export function InfoDrawer({ title, trigger, children, open, onOpenChange }: InfoDrawerProps) {
  const [internalOpen, setInternalOpen] = useState(false);

  // Determine controlled vs uncontrolled state
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const setIsOpen = isControlled ? onOpenChange! : setInternalOpen;

  return (
    <Drawer.Root open={isOpen} onOpenChange={setIsOpen}>
      <Drawer.Trigger asChild>{trigger}</Drawer.Trigger>

      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/40 transition-opacity" />
        <Drawer.Content className="fixed right-0 bottom-0 left-0 z-[60] flex max-h-[85vh] flex-col rounded-t-[20px] bg-white outline-none">
          {/* Handle Bar */}
          <div className="mx-auto mt-4 mb-2 h-1.5 w-12 flex-shrink-0 rounded-full bg-gray-300" />

          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 px-6 pb-2">
            <Drawer.Title className="text-lg font-bold text-gray-900">{title}</Drawer.Title>
            <button
              onClick={() => setIsOpen(false)}
              className="-mr-2 rounded-full p-2 text-gray-400 transition-colors hover:text-gray-600 active:bg-gray-100"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="overflow-y-auto p-4">
            <div className="text-sm leading-relaxed font-medium text-gray-600">{children}</div>
          </div>

          {/* Safe Area Padding for iOS Home Indicator */}
          <div className="pb-safe" />
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
