"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useTheme } from "next-themes";
import { Moon, Sun, Menu, X } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

export function Navbar() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { name: "Services", href: "/services-clean" },
    { name: "Build", href: "#build" },
    { name: "Attract", href: "#attract" },
    { name: "Convert", href: "#convert" },
    { name: "Automate", href: "#automate" },
    { name: "Scale", href: "#scale" },
  ];

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.8, ease: [0.2, 0.65, 0.3, 0.9] }}
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        isScrolled
          ? "bg-white/80 dark:bg-off-black/80 backdrop-blur-lg border-b border-gray-200 dark:border-white/10 py-4 shadow-sm"
          : "bg-transparent py-6"
      )}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <div className="flex-shrink-0">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-orange-deep to-brand-orange-light flex items-center justify-center text-white font-bold text-xl">
                T
              </div>
              <span className="font-heading font-bold text-xl tracking-tight">TBJ Growth</span>
            </Link>
          </div>
          
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link, i) => (
              <motion.a
                key={link.name}
                href={link.href}
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * i + 0.3 }}
                className="text-sm font-medium text-gray-600 hover:text-brand-orange-deep dark:text-gray-300 dark:hover:text-brand-orange-light transition-colors"
              >
                {link.name}  
              </motion.a>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            {mounted && (
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="p-2 rounded-full bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 transition-colors"
                aria-label="Toggle Theme"
              >
                <motion.div
                  initial={false}
                  animate={{ rotate: theme === "dark" ? 180 : 0 }}
                  transition={{ duration: 0.5, type: "spring" }}
                >
                  {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
                </motion.div>
              </button>
            )}

            <button
              className="md:hidden p-2 text-foreground"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            
            <motion.a
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.8 }}
              href="#contact"
              className="hidden md:inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium text-white bg-foreground dark:bg-white dark:text-black rounded-full bg-brand-orange-deep dark:hover:bg-brand-orange-light transition-colors"
            >
              Start Growing
            </motion.a>
          </div>
        </div>
      </div>
    </motion.header>
  );
}
