"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X, ArrowUpRight } from "lucide-react";

const navItems = [
  { label: "Home", href: "#top", index: "01" },
  { label: "Cottages", href: "#cottages", index: "02" },
  { label: "Availability", href: "#availability", index: "03" },
  { label: "The Grounds", href: "#grounds", index: "04" },
  { label: "Amenities", href: "#amenities", index: "05" },
  { label: "FAQ", href: "#faq", index: "06" },
  { label: "Reserve", href: "#book", index: "07" },
];

// Desktop keeps the traditional inline links; the mobile trigger is the
// only thing that opens the full-screen overlay below.
const desktopLinks = navItems.slice(0, 6);

export default function Navbar() {
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

  const textColor = isMenuOpen ? "text-white" : isScrolled ? "text-[#233324]" : "text-white";

  return (
    <>
      <header
        id="top"
        className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-500 ${
          isScrolled && !isMenuOpen ? "bg-[#FBF8F2]/90 backdrop-blur-md" : ""
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 sm:px-10 h-20 lg:h-24 flex items-center justify-between">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              handleNavClick("#top");
            }}
            className={`[font-family:var(--font-cormorant)] text-2xl tracking-wide transition-colors ${textColor}`}
          >
            Cedar Cove
          </a>

          {/* Desktop: inline nav + a persistent CTA, no hamburger */}
          <nav className={`hidden lg:flex items-center gap-9 [font-family:var(--font-jost)] text-xs uppercase tracking-[0.2em] transition-colors ${textColor}`}>
            {desktopLinks.map((item) => (
              <a
                key={item.label}
                href={item.href}
                onClick={(e) => {
                  e.preventDefault();
                  handleNavClick(item.href);
                }}
                className="opacity-90 hover:opacity-100 transition-opacity"
              >
                {item.label}
              </a>
            ))}
            <a
              href="#book"
              onClick={(e) => {
                e.preventDefault();
                handleNavClick("#book");
              }}
              className={`px-5 py-2.5 rounded-full text-xs tracking-[0.2em] transition-colors ${
                isScrolled ? "bg-[#233324] text-white hover:bg-[#2F4030]" : "bg-white text-[#233324] hover:bg-[#F0D999]"
              }`}
            >
              Check Availability
            </a>
          </nav>

          {/* Mobile: single trigger for the full-screen overlay menu */}
          <button
            onClick={() => setIsMenuOpen((v) => !v)}
            className={`lg:hidden flex items-center gap-3 [font-family:var(--font-jost)] text-xs uppercase tracking-[0.25em] transition-colors ${textColor}`}
          >
            {isMenuOpen ? "Close" : "Menu"}
            <span className="w-9 h-9 rounded-full border border-current flex items-center justify-center">
              {isMenuOpen ? <X size={15} /> : <Menu size={15} />}
            </span>
          </button>
        </div>
      </header>

      {/* Full-screen overlay menu — mobile/tablet only, index-numbered oversized type */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ clipPath: "circle(0% at 100% 0%)" }}
            animate={{ clipPath: "circle(150% at 100% 0%)" }}
            exit={{ clipPath: "circle(0% at 100% 0%)" }}
            transition={{ duration: 0.6, ease: [0.65, 0, 0.35, 1] }}
            className="fixed inset-0 z-40 bg-[#1B2A1C] lg:hidden"
          >
            <div className="max-w-3xl mx-auto h-full flex flex-col justify-center px-6 sm:px-10">
              {navItems.map((item, i) => (
                <motion.a
                  key={item.label}
                  href={item.href}
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 + i * 0.06 }}
                  onClick={(e) => {
                    e.preventDefault();
                    handleNavClick(item.href);
                  }}
                  className="group flex items-baseline gap-5 py-3.5 border-b border-white/10"
                >
                  <span className="text-xs text-[#8FA391] [font-family:var(--font-jost)]">{item.index}</span>
                  <span className="[font-family:var(--font-cormorant)] text-4xl sm:text-5xl text-white group-hover:text-[#F0D999] transition-colors">
                    {item.label}
                  </span>
                  <ArrowUpRight className="w-5 h-5 text-[#8FA391] opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all ml-auto" />
                </motion.a>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
