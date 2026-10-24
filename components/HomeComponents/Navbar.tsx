"use client";

import { useTheme } from "next-themes";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Sun, Moon, ArrowRight, ArrowUpRight, Globe, ChevronDown } from "lucide-react";
import Image from "next/image";
import { LOCALES, withLocalePrefix, type LocaleConfig } from "@/lib/i18n";

/** Strips the current locale's prefix off a pathname, e.g. "/bn-bd/about" -> "/about". */
function pathWithoutLocale(pathname: string, prefix: string | null): string {
  if (!prefix) return pathname;
  const withSlash = `/${prefix}`;
  if (pathname === withSlash) return "/";
  if (pathname.startsWith(`${withSlash}/`)) return pathname.slice(withSlash.length);
  return pathname;
}

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
    href: "/case-studies",
    type: "section",
  },
  {
    label: "Pricing",
    href: "/pricing",
    type: "route",
  },
  {
    label: "Why TBJ",
    href: "#why-tbj",
    type: "section",
  },
  {
    label: "Contact",
    href: "/contact",
    type: "section",
  },
];

export default function Navbar({ locale }: { locale: LocaleConfig }) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("");
  const [mounted, setMounted] = useState(false);

  const pathname = usePathname();
  const barePath = pathWithoutLocale(pathname || "/", locale.prefix);
  const localizedHref = (href: string) => (href.startsWith("#") ? href : withLocalePrefix(locale.prefix, href));

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

  const linkCls = (href: string) =>
    `px-3.5 py-2 text-[14px] font-medium transition-colors ${
      activeSection === href ? "text-foreground" : "text-muted hover:text-foreground"
    }`;
  const iconBtn =
    "flex h-10 w-10 items-center justify-center rounded-full text-muted transition-colors hover:bg-card hover:text-foreground";

  return (
    <>
      <nav
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
          isScrolled ? "border-b border-border bg-background/85 backdrop-blur-lg" : "border-b border-transparent bg-transparent"
        }`}
      >
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="flex h-[68px] items-center justify-between lg:h-20">
            <a href={withLocalePrefix(locale.prefix, "/")} className="flex items-center">
              <Image
                src="/primarylogo.png"
                alt="TBJ Growth Tech"
                width={1100}
                height={300}
                priority
                className="h-8 w-auto dark:hidden lg:h-9"
              />
              <Image
                src="/primary-logo-dark.png"
                alt="TBJ Growth Tech"
                width={1000}
                height={200}
                priority
                className="hidden h-8 w-auto dark:block lg:h-9"
              />
            </a>

            <div className="hidden items-center lg:flex">
              {navItems.map((item) => (
                <a
                  key={item.label}
                  href={localizedHref(item.href)}
                  onClick={(e) => handleNavClick(e, item.href)}
                  className={linkCls(item.href)}
                >
                  {item.label}
                </a>
              ))}
            </div>

            <div className="hidden items-center gap-1 lg:flex">
              <div className="relative">
                <button
                  onClick={() => setIsLangMenuOpen((v) => !v)}
                  className={`${iconBtn} w-auto gap-1 px-3`}
                  aria-label="Change language or region"
                  aria-expanded={isLangMenuOpen}
                >
                  <Globe size={18} />
                  <ChevronDown size={13} className={`transition-transform duration-200 ${isLangMenuOpen ? "rotate-180" : ""}`} />
                </button>
                <AnimatePresence>
                  {isLangMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full mt-2 w-56 overflow-hidden rounded-xl border border-border bg-background p-1 shadow-xl shadow-black/10"
                    >
                      {LOCALES.map((l) => (
                        <a
                          key={l.code}
                          href={withLocalePrefix(l.prefix, barePath)}
                          onClick={() => setIsLangMenuOpen(false)}
                          className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                            l.code === locale.code
                              ? "bg-card font-semibold text-foreground"
                              : "text-muted hover:bg-card hover:text-foreground"
                          }`}
                        >
                          {l.label}
                        </a>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <button onClick={toggleDarkMode} className={iconBtn} aria-label="Toggle dark mode">
                {mounted && (darkMode ? <Sun size={18} /> : <Moon size={18} />)}
              </button>

              <a
                href={localizedHref("/book-a-call")}
                className="group ml-2 inline-flex items-center gap-1.5 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-colors hover:bg-brand-500"
              >
                Get started
                <ArrowUpRight size={15} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </a>
            </div>

            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className={`${iconBtn} lg:hidden`}
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </nav>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[60] flex flex-col bg-background lg:hidden"
          >
            <div className="flex h-[68px] items-center justify-between px-5">
              <Image src="/primarylogo.png" alt="TBJ Growth Tech" width={1000} height={200} className="h-7 w-auto dark:hidden" />
              <Image src="/primary-logo-dark.png" alt="TBJ Growth Tech" width={1000} height={200} className="hidden h-7 w-auto dark:block" />
              <button onClick={() => setIsMobileMenuOpen(false)} className={iconBtn} aria-label="Close menu">
                <X size={22} />
              </button>
            </div>

            <div className="flex flex-1 flex-col overflow-y-auto px-5 pb-8 pt-4">
              <div className="flex flex-col">
                {navItems.map((item, index) => (
                  <motion.a
                    key={item.label}
                    href={localizedHref(item.href)}
                    onClick={(e) => handleNavClick(e, item.href)}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.04 * index }}
                    className="flex items-center justify-between border-b border-border py-4 font-heading text-2xl font-medium tracking-tight text-foreground"
                  >
                    {item.label}
                    <ArrowRight size={18} className="text-caption" />
                  </motion.a>
                ))}
              </div>

              <div className="mt-8">
                <p className="eyebrow mb-3">Language / Region</p>
                <div className="flex flex-wrap gap-2">
                  {LOCALES.map((l) => (
                    <a
                      key={l.code}
                      href={withLocalePrefix(l.prefix, barePath)}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                        l.code === locale.code
                          ? "border-foreground bg-foreground text-background"
                          : "border-border text-muted hover:text-foreground"
                      }`}
                    >
                      {l.label}
                    </a>
                  ))}
                </div>
              </div>

              <div className="mt-auto space-y-3 pt-10">
                <button
                  onClick={toggleDarkMode}
                  className="flex w-full items-center gap-3 rounded-xl px-1 py-2 font-medium text-muted"
                >
                  {darkMode ? <Sun size={18} /> : <Moon size={18} />}
                  <span>{darkMode ? "Light mode" : "Dark mode"}</span>
                </button>
                <a
                  href={localizedHref("/book-a-call")}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-foreground px-6 py-4 font-semibold text-background"
                >
                  Get started
                  <ArrowRight size={18} />
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
