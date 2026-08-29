"use client";

import { useTheme } from "next-themes";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Sun, Moon, ArrowRight } from "lucide-react";
import Image from "next/image";


const navItems = [
  {
    label: "Home",
    href: "/",
    type: "route",
  },
  {
    label: "About us",
    href: "/about",
    type: "route",
  },
  {
    label: "Services",
    href: "/services",
    type: "route",
  },
  {
    label: "Our Work",
    href: "#case-studies",
    type: "section",
  },
  {
    label: "TBJ Systems",
    href: "#tbj-systems",
    type: "section",
  },
  {
    label: "Why TBJ",
    href: "#why-tbj",
    type: "section",
  },
  {
    label: "Contact",
    href: "#contact",
    type: "section",
  },
];

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("");
  const [mounted, setMounted] = useState(false);

  const { resolvedTheme, setTheme } = useTheme();

  const darkMode = resolvedTheme === "dark";

  const toggleDarkMode = () => {
    setTheme(darkMode ? "light" : "dark");
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen]);

  const handleNavClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    href: string
  ) => {
    setIsMobileMenuOpen(false);

    if (!href.startsWith("#")) {
      return;
    }

    e.preventDefault();

    const element = document.querySelector(href);

    if (element) {
      element.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  };

  return (
    <>
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${isScrolled
          ? "bg-background/80 backdrop-blur-xl shadow-lg shadow-black/5 dark:shadow-black/30 border-b border-border/70"
          : "bg-transparent"
          }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-20">
            {/* Logo */}
            <motion.a
              href="/"
              className="flex items-center group"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="relative">
                <Image
                  src="/primarylogo.png"
                  alt="TBJ Growth Tech"
                  width={1100}
                  height={300}
                  priority
                  className="h-8 lg:h-9 w-auto dark:hidden"
                />
                <Image
                  src="/primary-logo-dark.png"
                  alt="TBJ Growth Tech"
                  width={1000}
                  height={200}
                  priority
                  className="hidden h-8 lg:h-9 w-auto dark:block"
                />
              </div>
            </motion.a>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-1">
              {navItems.map((item, index) => (
                <motion.a
                  key={item.label}
                  href={item.href}
                  onClick={(e) => handleNavClick(e, item.href)}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * index, duration: 0.3 }}
                  className={`relative px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 group ${activeSection === item.href
                    ? "text-brand-orange-deep dark:text-brand-orange-light"
                    : "text-muted hover:text-foreground"
                    }`}
                >
                  {item.label}
                  <span
                    className={`absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 bg-gradient-to-r from-brand-orange-deep to-brand-orange transition-all duration-300 rounded-full ${activeSection === item.href
                      ? "w-3/4 opacity-100"
                      : "w-0 opacity-0 group-hover:w-1/2 group-hover:opacity-100"
                      }`}
                  />
                </motion.a>
              ))}
            </div>

            {/* Right Side Actions */}
            <div className="hidden lg:flex items-center gap-3">
              {/* Dark Mode Toggle */}
              <motion.button
                onClick={toggleDarkMode}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className={`relative p-2 rounded-xl transition-all duration-300 ${isScrolled
                    ? "bg-card text-muted hover:text-foreground"
                    : "text-muted hover:text-foreground hover:bg-card/60"
                  }`}
                aria-label="Toggle dark mode"
              >
                {mounted && (
                  <AnimatePresence mode="wait">
                    {darkMode ? (
                      <motion.div
                        key="sun"
                        initial={{ rotate: -90, opacity: 0 }}
                        animate={{ rotate: 0, opacity: 1 }}
                        exit={{ rotate: 90, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <Sun size={20} />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="moon"
                        initial={{ rotate: 90, opacity: 0 }}
                        animate={{ rotate: 0, opacity: 1 }}
                        exit={{ rotate: -90, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <Moon size={20} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                )}
              </motion.button>

              {/* CTA Button */}
              <motion.a
                href="#contact"
                onClick={(e) => handleNavClick(e, "#contact")}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5, duration: 0.3 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="relative group flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-brand-orange-deep to-brand-orange text-white text-sm font-semibold rounded-xl overflow-hidden shadow-lg shadow-brand-orange/25 hover:shadow-brand-orange/40 transition-shadow duration-300"
              >
                <span className="relative z-10">Get Started</span>
                <ArrowRight
                  size={16}
                  className="relative z-10 group-hover:translate-x-1 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-brand-orange to-brand-orange-deep opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </motion.a>
            </div>

            {/* Mobile Menu Button */}
            <motion.button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              whileTap={{ scale: 0.9 }}
              className={`lg:hidden relative p-2 rounded-xl transition-all duration-300 ${isScrolled
                ? "bg-card text-muted"
                : "text-muted hover:bg-card/60"
                }`}
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </motion.button>
          </div>
        </div>
      </motion.nav>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-40 lg:hidden"
          >
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            {/* Menu Panel */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="absolute right-0 top-0 bottom-0 w-80 max-w-[85vw] bg-card shadow-2xl border-l border-border"
            >
              <div className="flex flex-col h-full p-6">
                {/* Mobile Menu Header */}
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center">
                    <Image
                      src="/primarylogo.png"
                      alt="TBJ Growth Tech"
                      width={1000}
                      height={200}
                      className="h-7 w-auto dark:hidden"
                    />
                    <Image
                      src="/primary-logo-dark.png"
                      alt="TBJ Growth Tech"
                      width={1000}
                      height={200}
                      className="hidden h-7 w-auto dark:block"
                    />
                  </div>
                  <button
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-2 text-muted hover:text-foreground rounded-lg hover:bg-background transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>

                {/* Mobile Navigation Links */}
                <div className="flex flex-col gap-1">
                  {navItems.map((item, index) => (
                    <motion.a
                      key={item.label}
                      href={item.href}
                      onClick={(e) => handleNavClick(e, item.href)}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 * index }}
                      className="group flex items-center justify-between px-4 py-3 text-foreground/85 hover:text-brand-orange-deep dark:hover:text-brand-orange-light hover:bg-tint rounded-xl transition-all duration-200 font-medium"
                    >
                      <span>{item.label}</span>
                      <ArrowRight
                        size={16}
                        className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 text-brand-orange-deep dark:text-brand-orange-light"
                      />
                    </motion.a>
                  ))}
                </div>

                {/* Mobile CTA & Dark Mode */}
                <div className="mt-auto space-y-4">
                  {/* Dark Mode Toggle */}
                  <button
                    onClick={toggleDarkMode}
                    className="flex items-center gap-3 w-full px-4 py-3 text-foreground/85 hover:bg-background rounded-xl transition-colors font-medium"
                  >
                    {darkMode ? (
                      <>
                        <Sun size={20} />
                        <span>Light Mode</span>
                      </>
                    ) : (
                      <>
                        <Moon size={20} />
                        <span>Dark Mode</span>
                      </>
                    )}
                  </button>

                  {/* CTA */}
                  <motion.a
                    href="#contact"
                    onClick={(e) => handleNavClick(e, "#contact")}
                    whileTap={{ scale: 0.98 }}
                    className="flex items-center justify-center gap-2 w-full px-6 py-3.5 bg-gradient-to-r from-brand-orange-deep to-brand-orange text-white font-semibold rounded-xl shadow-lg shadow-brand-orange/25 active:scale-95 transition-transform"
                  >
                    <span>Get Started</span>
                    <ArrowRight size={18} />
                  </motion.a>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}