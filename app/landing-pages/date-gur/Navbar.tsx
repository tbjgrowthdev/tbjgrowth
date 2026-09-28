"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";

const navItems = [
  { label: "হোম", href: "#top" },
  { label: "পণ্যসমূহ", href: "#products" },
  { label: "আমাদের গল্প", href: "#story" },
  { label: "কেন নলেন", href: "#benefits" },
  { label: "সচরাচর জিজ্ঞাসা", href: "#faq" },
];

export default function Navbar({ whatsappHref }: { whatsappHref: string }) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 16);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleNavClick = (href: string) => {
    setIsMenuOpen(false);
    const el = document.querySelector(href);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      <header
        id="top"
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          isScrolled
            ? "bg-[#FCF6EC]/90 backdrop-blur-xl border-b border-[#E8D6B8] shadow-[0_4px_24px_rgba(166,71,43,0.06)]"
            : "bg-gradient-to-b from-[#FCF6EC]/70 to-transparent"
        }`}
      >
        <nav className="max-w-6xl mx-auto px-5 sm:px-8 h-20 flex items-center justify-between">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              handleNavClick("#top");
            }}
            className="flex items-baseline gap-2.5"
          >
            <span className="[font-family:var(--font-tiro-bangla)] text-3xl text-[#2B1D12]">
              নলেন
            </span>
            <span className="hidden sm:inline text-[10px] uppercase tracking-[0.2em] text-[#B8752A] [font-family:var(--font-hind-siliguri)]">
              শীতের সোনা
            </span>
          </a>

          <div className="hidden lg:flex items-center gap-8 [font-family:var(--font-hind-siliguri)]">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                onClick={(e) => {
                  e.preventDefault();
                  handleNavClick(item.href);
                }}
                className="text-[15px] text-[#6B5842] hover:text-[#2B1D12] transition-colors"
              >
                {item.label}
              </a>
            ))}
          </div>

          <div className="hidden lg:block">
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="[font-family:var(--font-hind-siliguri)] inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-[#C6862B] to-[#A6472B] text-[#FCF6EC] text-sm font-semibold shadow-[0_8px_24px_rgba(166,71,43,0.2)] hover:shadow-[0_10px_30px_rgba(166,71,43,0.3)] transition-shadow"
            >
              অর্ডার করুন
            </a>
          </div>

          <button
            onClick={() => setIsMenuOpen((v) => !v)}
            className="lg:hidden p-2 text-[#2B1D12]"
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </nav>
      </header>

      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] lg:hidden bg-[#FCF6EC]/98 backdrop-blur-xl"
          >
            <div className="flex flex-col h-full px-8 pt-24 pb-10">
              <button
                onClick={() => setIsMenuOpen(false)}
                className="absolute top-6 right-6 p-2 text-[#2B1D12]"
                aria-label="Close menu"
              >
                <X size={26} />
              </button>

              <div className="flex flex-col gap-1 [font-family:var(--font-hind-siliguri)]">
                {navItems.map((item, i) => (
                  <motion.a
                    key={item.label}
                    href={item.href}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06 }}
                    onClick={(e) => {
                      e.preventDefault();
                      handleNavClick(item.href);
                    }}
                    className="text-2xl py-3.5 text-[#2B1D12] border-b border-[#E8D6B8]"
                  >
                    {item.label}
                  </motion.a>
                ))}
              </div>

              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="[font-family:var(--font-hind-siliguri)] mt-auto inline-flex items-center justify-center gap-2 px-6 py-4 rounded-full bg-gradient-to-r from-[#C6862B] to-[#A6472B] text-[#FCF6EC] font-semibold"
              >
                অর্ডার করুন
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
