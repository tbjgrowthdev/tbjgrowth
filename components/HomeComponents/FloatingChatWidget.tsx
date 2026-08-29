"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, Phone, X } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";

export default function FloatingChatWidget({
  phone,
}: {
  phone?: string | null;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const contactPhone = phone || "+44 (0) 123 456 7890";
  const callHref = `tel:${contactPhone.replace(/[^\d+]/g, "")}`;
  const whatsappHref = `https://wa.me/${contactPhone.replace(/[^\d]/g, "")}`;

  const options = [
    {
      key: "call",
      label: "Call Us",
      sublabel: contactPhone,
      href: callHref,
      icon: Phone,
      color: "from-brand-orange-deep to-brand-orange",
    },
    {
      key: "whatsapp",
      label: "WhatsApp",
      sublabel: "Chat with us",
      href: whatsappHref,
      icon: FaWhatsapp,
      color: "from-green-600 to-green-500",
      external: true,
    },
  ];

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col gap-3"
          >
            {options.map((option, index) => {
              const Icon = option.icon;
              return (
                <motion.a
                  key={option.key}
                  href={option.href}
                  target={option.external ? "_blank" : undefined}
                  rel={option.external ? "noopener noreferrer" : undefined}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="group flex items-center gap-3 pl-4 pr-5 py-3 bg-card rounded-2xl shadow-xl border border-border hover:border-accent-border transition-colors"
                >
                  <div
                    className={`p-2.5 rounded-xl bg-gradient-to-br ${option.color} text-white shadow-sm`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-semibold text-foreground">
                      {option.label}
                    </div>
                    <div className="text-xs text-caption">
                      {option.sublabel}
                    </div>
                  </div>
                </motion.a>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        aria-label={isOpen ? "Close contact options" : "Open contact options"}
        aria-expanded={isOpen}
        className="relative flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-brand-orange-deep to-brand-orange text-white shadow-xl shadow-brand-orange/30 hover:shadow-2xl hover:shadow-brand-orange/40 transition-shadow duration-300"
      >
        {!isOpen && (
          <span className="absolute inset-0 rounded-full bg-brand-orange/40 animate-ping" />
        )}
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={isOpen ? "close" : "chat"}
            initial={{ opacity: 0, rotate: -90 }}
            animate={{ opacity: 1, rotate: 0 }}
            exit={{ opacity: 0, rotate: 90 }}
            transition={{ duration: 0.15 }}
            className="relative"
          >
            {isOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <MessageCircle className="w-6 h-6" />
            )}
          </motion.span>
        </AnimatePresence>
      </motion.button>
    </div>
  );
}
