"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";

const leftLinks = [
  { label: "Portfolio", href: "#portfolio" },
  { label: "Investment", href: "#investment" },
  { label: "Process", href: "#process" },
];

const rightLinks = [
  { label: "About", href: "#about" },
  { label: "FAQ", href: "#faq" },
];

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

  const textColor = isScrolled || isMenuOpen ? "text-[#26221F]" : "text-white";

  return (
    <>
      <header
        id="top"
        className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-300 ${
          isScrolled || isMenuOpen ? "bg-[#FAF6F1]/95 backdrop-blur-md shadow-[0_1px_0_rgba(0,0,0,0.06)]" : ""
        }`}
      >
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-20 lg:h-24 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <nav className={`hidden lg:flex items-center gap-8 justify-start text-xs uppercase tracking-[0.18em] ${textColor}`}>
            {leftLinks.map((item) => (
              <a
                key={item.label}
                href={item.href}
                onClick={(e) => {
                  e.preventDefault();
                  handleNavClick(item.href);
                }}
                className="hover:opacity-60 transition-opacity"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              handleNavClick("#top");
            }}
            className={`[font-family:var(--font-playfair)] italic text-xl sm:text-2xl text-center whitespace-nowrap ${textColor}`}
          >
            Ivory Lane
          </a>

          <div className="hidden lg:flex items-center justify-end gap-8">
            <nav className={`flex items-center gap-8 text-xs uppercase tracking-[0.18em] ${textColor}`}>
              {rightLinks.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={(e) => {
                    e.preventDefault();
                    handleNavClick(item.href);
                  }}
                  className="hover:opacity-60 transition-opacity"
                >
                  {item.label}
                </a>
              ))}
            </nav>
            <a
              href="#inquire"
              onClick={(e) => {
                e.preventDefault();
                handleNavClick("#inquire");
              }}
              className={`px-5 py-2.5 text-xs uppercase tracking-[0.18em] border transition-colors ${
                isScrolled
                  ? "border-[#26221F] text-[#26221F] hover:bg-[#26221F] hover:text-white"
                  : "border-white text-white hover:bg-white hover:text-[#26221F]"
              }`}
            >
              Inquire
            </a>
          </div>

          <button
            onClick={() => setIsMenuOpen((v) => !v)}
            className={`lg:hidden justify-self-end ${textColor}`}
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>

      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-40 bg-[#FAF6F1] lg:hidden flex flex-col items-center justify-center gap-7"
          >
            {[...leftLinks, ...rightLinks].map((item, i) => (
              <motion.a
                key={item.label}
                href={item.href}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={(e) => {
                  e.preventDefault();
                  handleNavClick(item.href);
                }}
                className="[font-family:var(--font-playfair)] text-3xl italic text-[#26221F]"
              >
                {item.label}
              </motion.a>
            ))}
            <a
              href="#inquire"
              onClick={(e) => {
                e.preventDefault();
                handleNavClick("#inquire");
              }}
              className="mt-4 px-8 py-3 text-xs uppercase tracking-[0.18em] border border-[#26221F] text-[#26221F]"
            >
              Inquire
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
