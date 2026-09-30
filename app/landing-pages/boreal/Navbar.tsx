"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X, Heart, ShoppingBag } from "lucide-react";

const navItems = [
  { label: "Collection", href: "#collection" },
  { label: "Technology", href: "#technology" },
  { label: "Lookbook", href: "#lookbook" },
  { label: "Reviews", href: "#testimonials" },
  { label: "Sizing", href: "#sizing" },
  { label: "FAQ", href: "#faq" },
];

export default function Navbar({
  cartCount = 0,
  favoritesCount = 0,
  onCartClick,
  onFavoritesClick,
}: {
  cartCount?: number;
  favoritesCount?: number;
  onCartClick?: () => void;
  onFavoritesClick?: () => void;
}) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 16);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleNavClick = (href: string) => {
    setIsMenuOpen(false);
    document.querySelector(href)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const iconButtonClass = "relative w-9 h-9 flex items-center justify-center text-white hover:text-[#E14A2E] transition-colors";
  const badgeClass =
    "absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#E14A2E] text-white text-[10px] font-bold flex items-center justify-center";

  return (
    <>
      <header
        id="top"
        className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-300 ${
          isScrolled || isMenuOpen ? "bg-[#0F1115]" : "bg-gradient-to-b from-black/60 to-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-20 flex items-center justify-between">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              handleNavClick("#top");
            }}
            className="[font-family:var(--font-anton)] text-2xl sm:text-3xl tracking-wide text-white"
          >
            BOREAL
          </a>

          <div className="flex items-center gap-5">
            <nav className="hidden lg:flex items-center gap-8">
              {navItems.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={(e) => {
                    e.preventDefault();
                    handleNavClick(item.href);
                  }}
                  className="relative text-xs uppercase tracking-[0.15em] text-white/80 hover:text-white transition-colors group"
                >
                  {item.label}
                  <span className="absolute -bottom-1 left-0 w-0 h-px bg-[#E14A2E] group-hover:w-full transition-all duration-300" />
                </a>
              ))}
              <a
                href="#join"
                onClick={(e) => {
                  e.preventDefault();
                  handleNavClick("#join");
                }}
                className="px-5 py-2.5 bg-[#E14A2E] text-white text-xs font-bold uppercase tracking-[0.1em] hover:bg-[#C93D24] transition-colors"
              >
                Join the Drop
              </a>
            </nav>

            <div className="flex items-center gap-1">
              <button type="button" onClick={onFavoritesClick} className={iconButtonClass} aria-label="Favorites">
                <Heart size={19} />
                {favoritesCount > 0 && <span className={badgeClass}>{favoritesCount}</span>}
              </button>
              <button type="button" onClick={onCartClick} className={iconButtonClass} aria-label="Cart">
                <ShoppingBag size={19} />
                {cartCount > 0 && <span className={badgeClass}>{cartCount}</span>}
              </button>
            </div>

            <button
              onClick={() => setIsMenuOpen((v) => !v)}
              className="lg:hidden text-white"
              aria-label="Toggle menu"
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed top-20 left-0 right-0 z-40 bg-[#0F1115] border-t border-white/10 overflow-hidden lg:hidden"
          >
            <div className="px-5 sm:px-8 py-6 flex flex-col gap-1">
              {navItems.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={(e) => {
                    e.preventDefault();
                    handleNavClick(item.href);
                  }}
                  className="py-3 text-sm uppercase tracking-[0.15em] text-white/85 border-b border-white/10"
                >
                  {item.label}
                </a>
              ))}
              <a
                href="#join"
                onClick={(e) => {
                  e.preventDefault();
                  handleNavClick("#join");
                }}
                className="mt-5 px-5 py-3.5 bg-[#E14A2E] text-white text-sm font-bold uppercase tracking-[0.1em] text-center"
              >
                Join the Drop
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
