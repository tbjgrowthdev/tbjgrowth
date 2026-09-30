"use client";

import { useState } from "react";
import Image, { type StaticImageData } from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { X, Minus, Plus, Trash2, ShoppingBag, Heart, CheckCircle2, Send } from "lucide-react";
import { submitContactForm } from "@/app/(admin)/actions/forms";

export interface CartItem {
  id: string;
  name: string;
  price: number;
  image: string | StaticImageData;
  quantity: number;
}

export interface FavoriteItem {
  id: string;
  name: string;
  price: number;
  image: string | StaticImageData;
}

export default function CartDrawer({
  isOpen,
  onClose,
  activeTab,
  onTabChange,
  cartItems,
  favorites,
  onUpdateQuantity,
  onRemoveFromCart,
  onRemoveFavorite,
  onMoveFavoriteToCart,
  onOrderComplete,
}: {
  isOpen: boolean;
  onClose: () => void;
  activeTab: "cart" | "favorites";
  onTabChange: (tab: "cart" | "favorites") => void;
  cartItems: CartItem[];
  favorites: FavoriteItem[];
  onUpdateQuantity: (id: string, delta: number) => void;
  onRemoveFromCart: (id: string) => void;
  onRemoveFavorite: (id: string) => void;
  onMoveFavoriteToCart: (item: FavoriteItem) => void;
  onOrderComplete: () => void;
}) {
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [checkoutForm, setCheckoutForm] = useState({ name: "", email: "", phone: "" });

  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const resetAndClose = () => {
    setIsCheckingOut(false);
    setOrderPlaced(false);
    setCheckoutForm({ name: "", email: "", phone: "" });
    onClose();
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

    const itemLines = cartItems.map((item) => `${item.quantity}x ${item.name} — $${item.price * item.quantity}`);
    const message = [`Demo order (no payment taken):`, ...itemLines, `Total: $${subtotal}`].join("\n");

    const result = await submitContactForm({
      name: checkoutForm.name,
      email: checkoutForm.email,
      phone: checkoutForm.phone,
      message,
      source: "Boreal Cart Checkout",
    });

    if (result.success) {
      setOrderPlaced(true);
      onOrderComplete();
    } else {
      setSubmitError("Something went wrong sending your order request. Please try again.");
    }
    setIsSubmitting(false);
  };

  const inputClass =
    "w-full px-4 py-2.5 rounded-lg bg-[#F5F5F3] border border-[#D8D9DC] text-[#14161A] placeholder-[#9A9DA5] focus:outline-none focus:border-[#E14A2E] focus:ring-1 focus:ring-[#E14A2E]/40 transition-all text-sm";

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={resetAndClose}
            className="fixed inset-0 bg-black/50 z-[60]"
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.3, ease: "easeOut" }}
            className="fixed top-0 right-0 bottom-0 w-full sm:w-[420px] bg-white z-[70] flex flex-col [font-family:var(--font-manrope)]"
          >
            <div className="flex items-center justify-between border-b border-[#EAEAE7] px-5 py-4 flex-shrink-0">
              <div className="flex items-center gap-1 bg-[#F5F5F3] rounded-full p-1">
                <button
                  type="button"
                  onClick={() => onTabChange("cart")}
                  className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-colors ${
                    activeTab === "cart" ? "bg-[#14161A] text-white" : "text-[#6B6E75]"
                  }`}
                >
                  Cart ({cartCount})
                </button>
                <button
                  type="button"
                  onClick={() => onTabChange("favorites")}
                  className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-colors ${
                    activeTab === "favorites" ? "bg-[#14161A] text-white" : "text-[#6B6E75]"
                  }`}
                >
                  Favorites ({favorites.length})
                </button>
              </div>
              <button
                type="button"
                onClick={resetAndClose}
                className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[#F5F5F3] transition-colors flex-shrink-0"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5">
              {activeTab === "cart" ? (
                orderPlaced ? (
                  <div className="h-full flex flex-col items-center justify-center text-center py-10">
                    <div className="w-16 h-16 rounded-full border border-[#14161A]/20 flex items-center justify-center mb-4">
                      <CheckCircle2 className="w-8 h-8 text-[#E14A2E]" />
                    </div>
                    <h3 className="[font-family:var(--font-anton)] uppercase text-2xl mb-2">Order Request Sent</h3>
                    <p className="text-sm text-[#5A5D64] max-w-[260px]">
                      This is a demo checkout — no payment was taken. We&apos;ll follow up by email to confirm.
                    </p>
                  </div>
                ) : cartItems.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center py-10">
                    <ShoppingBag className="w-8 h-8 text-[#D8D9DC] mb-4" />
                    <p className="text-sm text-[#6B6E75]">Your cart is empty.</p>
                  </div>
                ) : isCheckingOut ? (
                  <form onSubmit={handlePlaceOrder} className="space-y-4">
                    <p className="text-xs uppercase tracking-wider text-[#6B6E75] mb-1">Demo Checkout — No Payment Taken</p>
                    <input
                      type="text"
                      required
                      placeholder="Full name"
                      value={checkoutForm.name}
                      onChange={(e) => setCheckoutForm({ ...checkoutForm, name: e.target.value })}
                      className={inputClass}
                    />
                    <input
                      type="email"
                      required
                      placeholder="Email"
                      value={checkoutForm.email}
                      onChange={(e) => setCheckoutForm({ ...checkoutForm, email: e.target.value })}
                      className={inputClass}
                    />
                    <input
                      type="tel"
                      placeholder="Phone"
                      value={checkoutForm.phone}
                      onChange={(e) => setCheckoutForm({ ...checkoutForm, phone: e.target.value })}
                      className={inputClass}
                    />
                    {submitError && <p className="text-xs text-red-700">{submitError}</p>}
                    <div className="flex items-center justify-between text-sm font-bold pt-2 border-t border-[#EAEAE7]">
                      <span>Total</span>
                      <span>${subtotal}</span>
                    </div>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-[#E14A2E] text-white text-sm font-bold uppercase tracking-[0.1em] hover:bg-[#C93D24] transition-colors disabled:opacity-50"
                    >
                      <Send className="w-4 h-4" />
                      {isSubmitting ? "Sending..." : "Place Demo Order"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsCheckingOut(false)}
                      className="w-full text-xs uppercase tracking-wider text-[#6B6E75] hover:text-[#14161A] transition-colors"
                    >
                      Back to cart
                    </button>
                  </form>
                ) : (
                  <div className="space-y-4">
                    {cartItems.map((item) => (
                      <div key={item.id} className="flex gap-3">
                        <div className="relative w-16 h-20 flex-shrink-0 bg-[#F5F5F3] overflow-hidden">
                          <Image src={item.image} alt={item.name} fill sizes="64px" className="object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[#14161A] truncate">{item.name}</p>
                          <p className="text-sm text-[#6B6E75] mt-0.5">${item.price}</p>
                          <div className="flex items-center gap-3 mt-2">
                            <div className="flex items-center border border-[#D8D9DC]">
                              <button
                                type="button"
                                onClick={() => onUpdateQuantity(item.id, -1)}
                                className="w-7 h-7 flex items-center justify-center hover:bg-[#F5F5F3] transition-colors"
                                aria-label="Decrease quantity"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="w-7 text-center text-xs font-semibold">{item.quantity}</span>
                              <button
                                type="button"
                                onClick={() => onUpdateQuantity(item.id, 1)}
                                className="w-7 h-7 flex items-center justify-center hover:bg-[#F5F5F3] transition-colors"
                                aria-label="Increase quantity"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => onRemoveFromCart(item.id)}
                              className="text-[#9A9DA5] hover:text-[#E14A2E] transition-colors"
                              aria-label="Remove item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : favorites.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-10">
                  <Heart className="w-8 h-8 text-[#D8D9DC] mb-4" />
                  <p className="text-sm text-[#6B6E75]">No favorites yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {favorites.map((item) => (
                    <div key={item.id} className="flex gap-3">
                      <div className="relative w-16 h-20 flex-shrink-0 bg-[#F5F5F3] overflow-hidden">
                        <Image src={item.image} alt={item.name} fill sizes="64px" className="object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#14161A] truncate">{item.name}</p>
                        <p className="text-sm text-[#6B6E75] mt-0.5">${item.price}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <button
                            type="button"
                            onClick={() => onMoveFavoriteToCart(item)}
                            className="text-xs font-bold uppercase tracking-wider text-[#14161A] border-b border-[#E14A2E]"
                          >
                            Add to Cart
                          </button>
                          <button
                            type="button"
                            onClick={() => onRemoveFavorite(item.id)}
                            className="text-[#9A9DA5] hover:text-[#E14A2E] transition-colors"
                            aria-label="Remove favorite"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {activeTab === "cart" && cartItems.length > 0 && !isCheckingOut && !orderPlaced && (
              <div className="border-t border-[#EAEAE7] px-5 py-5 flex-shrink-0">
                <div className="flex items-center justify-between text-sm font-bold mb-4">
                  <span>Subtotal</span>
                  <span>${subtotal}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCheckingOut(true)}
                  className="w-full px-6 py-3.5 bg-[#14161A] text-white text-sm font-bold uppercase tracking-[0.1em] hover:bg-[#0F1115] transition-colors"
                >
                  Checkout (Demo)
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
