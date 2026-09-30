"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import {
  Wind,
  Thermometer,
  Droplets,
  Recycle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Send,
  CheckCircle2,
  ArrowRight,
  Star,
  Heart,
  ShoppingBag,
  Quote,
} from "lucide-react";
import { submitContactForm } from "@/app/(admin)/actions/forms";
import Navbar from "./Navbar";
import Footer from "./Footer";
import CartDrawer, { type CartItem, type FavoriteItem } from "./CartDrawer";
import fashionHero from "../../../public/fashionhero.jpg";
import fashionHero1 from "../../../public/fashionhero1.jpg";
import product3 from "../../../public/3.png";
import product5 from "../../../public/5.png";
import product7 from "../../../public/7.png";

const photo = (seed: string, w: number, h: number) => `https://picsum.photos/seed/${seed}/${w}/${h}`;

const marqueeText = [
  "FREE WORLDWIDE SHIPPING",
  "WINTER 2026 COLLECTION",
  "LIMITED FIRST DROP",
  "ENGINEERED FOR −20°C",
];

const heroSlides = [
  {
    heading: "Engineered For The Cold",
    copy: "Windproof shells and honest thermal layers, tested in real sub-zero conditions — not just a wind tunnel.",
    ctaLabel: "Shop the Collection",
    ctaHref: "#collection",
    image: fashionHero,
  },
  {
    heading: "Built To Layer Up",
    copy: "Base layers, midlayers, and shells designed to work together — add or strip back as the temperature moves.",
    ctaLabel: "Shop the Collection",
    ctaHref: "#collection",
    image: fashionHero1,
  },
  {
    heading: "Tested In The Field",
    copy: "Every piece is worn and photographed in real winter conditions before it ever reaches the collection page.",
    ctaLabel: "See the Lookbook",
    ctaHref: "#lookbook",
    image: fashionHero,
  },
];

const categories = ["All", "Jackets", "Hoodies", "Base Layers", "Accessories"];

const products = [
  {
    id: "frostshell-parka",
    name: "The Frostshell Parka",
    category: "Jackets",
    price: 289,
    image: product3,
  },
  {
    id: "summit-thermal-jacket",
    name: "Summit Thermal Jacket",
    category: "Jackets",
    price: 215,
    image: product5,
  },
  {
    id: "glacier-half-zip-hoodie",
    name: "Glacier Half-Zip Hoodie",
    category: "Hoodies",
    price: 95,
    image: product7,
  },
  {
    id: "boreal-fleece-hoodie",
    name: "Boreal Fleece Hoodie",
    category: "Hoodies",
    price: 89,
    image: product3,
  },
  {
    id: "tundra-base-layer-set",
    name: "Tundra Base Layer Set",
    category: "Base Layers",
    price: 68,
    image: product5,
  },
  {
    id: "storm-beanie",
    name: "Storm Beanie",
    category: "Accessories",
    price: 28,
    image: product7,
  },
  {
    id: "alpine-gloves",
    name: "Alpine Gloves",
    category: "Accessories",
    price: 42,
    image: product3,
  },
];

const techFeatures = [
  {
    icon: Wind,
    title: "Windproof Shell",
    description: "Blocks wind up to 60mph without trapping moisture against your skin.",
  },
  {
    icon: Thermometer,
    title: "Rated to −20°C",
    description: "Insulation engineered and tested for genuine sub-zero conditions.",
  },
  {
    icon: Droplets,
    title: "Sealed Zippers",
    description: "Water-resistant zips keep out sleet, snowmelt, and driving rain.",
  },
  {
    icon: Recycle,
    title: "Recycled Shell Fabric",
    description: "70% recycled polyester outer, without cutting corners on durability.",
  },
];

const testimonials = [
  {
    name: "Marcus T.",
    location: "Calgary, Canada",
    rating: 5,
    quote:
      "Wore the Frostshell Parka through a week of −15°C mornings and never once felt the wind cut through. This is the real deal, not just a marketing number.",
  },
  {
    name: "Priya N.",
    location: "Toronto, Canada",
    rating: 5,
    quote:
      "Finally a hoodie that doesn't pill after a couple of washes. The Glacier Half-Zip is my go-to for the school run now.",
  },
  {
    name: "Jonas B.",
    location: "Oslo, Norway",
    rating: 4,
    quote:
      "Sizing ran true for me — ordered a Medium and it layers perfectly over a base layer without feeling bulky.",
  },
  {
    name: "Elin S.",
    location: "Reykjavik, Iceland",
    rating: 5,
    quote:
      "The base layer set kept me warm on a six-hour hike through fresh snow. Genuinely impressed with the fabric quality.",
  },
];

const lookbookPhotos = [
  { seed: "boreal-look-1", h: "h-64 lg:h-80" },
  { seed: "boreal-look-2", h: "h-80 lg:h-[26rem] sm:mt-10" },
  { seed: "boreal-look-3", h: "h-72 lg:h-96" },
  { seed: "boreal-look-4", h: "h-64 lg:h-80 sm:mt-10" },
  { seed: "boreal-look-5", h: "h-80 lg:h-[26rem]" },
];

const sizeChart = [
  { size: "XS", chest: "34–36", waist: "28–30", length: "26" },
  { size: "S", chest: "36–38", waist: "30–32", length: "27" },
  { size: "M", chest: "39–41", waist: "33–35", length: "28" },
  { size: "L", chest: "42–44", waist: "36–38", length: "29" },
  { size: "XL", chest: "45–47", waist: "39–41", length: "30" },
  { size: "XXL", chest: "48–50", waist: "42–44", length: "31" },
];

const faqs = [
  {
    question: "When does the Winter 2026 collection ship?",
    answer:
      "We're taking pre-orders now, with the first units shipping in late autumn — in time for the season. Everyone on the list gets a shipping date before checkout opens publicly.",
  },
  {
    question: "What's your return policy?",
    answer:
      "30-day returns on unworn items with tags attached. If sizing is off, we'll cover the exchange shipping on your first order.",
  },
  {
    question: "Is the shell fabric actually waterproof?",
    answer:
      "It's water-resistant with sealed, taped seams — built for snow, sleet, and heavy rain. Full submersion or prolonged standing water isn't what it's rated for.",
  },
  {
    question: "Do you ship internationally?",
    answer:
      "Yes, worldwide. Shipping cost and delivery time are calculated at checkout based on your country.",
  },
];

export default function BorealLandingClient({
  phone,
  email,
}: {
  phone?: string | null;
  email?: string | null;
}) {
  const contactPhone = phone || "+880 1521-202204";
  const whatsappHref = `https://wa.me/${contactPhone.replace(/[^\d]/g, "")}?text=${encodeURIComponent(
    "Hi! I'd like to know more about the Boreal Winter 2026 collection."
  )}`;

  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % heroSlides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  const goToSlide = (index: number) => {
    setActiveSlide(((index % heroSlides.length) + heroSlides.length) % heroSlides.length);
  };

  const [activeCategory, setActiveCategory] = useState("All");
  const filteredProducts =
    activeCategory === "All" ? products : products.filter((p) => p.category === activeCategory);

  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<"cart" | "favorites">("cart");

  const addToCart = (product: (typeof products)[number]) => {
    setCartItems((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) => (item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
      }
      return [...prev, { id: product.id, name: product.name, price: product.price, image: product.image, quantity: 1 }];
    });
    setDrawerTab("cart");
    setIsDrawerOpen(true);
  };

  const updateCartQuantity = (id: string, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((item) => (item.id === id ? { ...item, quantity: item.quantity + delta } : item))
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (id: string) => {
    setCartItems((prev) => prev.filter((item) => item.id !== id));
  };

  const toggleFavorite = (product: (typeof products)[number]) => {
    setFavorites((prev) => {
      const exists = prev.some((item) => item.id === product.id);
      if (exists) return prev.filter((item) => item.id !== product.id);
      return [...prev, { id: product.id, name: product.name, price: product.price, image: product.image }];
    });
  };

  const removeFavorite = (id: string) => {
    setFavorites((prev) => prev.filter((item) => item.id !== id));
  };

  const moveFavoriteToCart = (item: FavoriteItem) => {
    setCartItems((prev) => {
      const existing = prev.find((c) => c.id === item.id);
      if (existing) {
        return prev.map((c) => (c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c));
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [formState, setFormState] = useState({
    name: "",
    email: "",
    phone: "",
    interest: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormState({ ...formState, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

    const message = [
      formState.interest ? `Interested in: ${formState.interest}` : null,
      formState.message || null,
    ]
      .filter(Boolean)
      .join("\n");

    const result = await submitContactForm({
      name: formState.name,
      email: formState.email,
      phone: formState.phone,
      message,
      source: "Boreal Landing Page",
    });

    if (result.success) {
      setIsSubmitted(true);
      setFormState({ name: "", email: "", phone: "", interest: "", message: "" });
    } else {
      setSubmitError("Something went wrong sending your request. Please try WhatsApp instead, or try again.");
    }
    setIsSubmitting(false);
  };

  const inputClass =
    "w-full px-4 py-3 rounded-lg bg-white border border-[#D8D9DC] text-[#14161A] placeholder-[#9A9DA5] focus:outline-none focus:border-[#E14A2E] focus:ring-1 focus:ring-[#E14A2E]/40 transition-all [font-family:var(--font-manrope)] text-sm";
  const labelClass = "block text-xs uppercase tracking-wider text-[#6B6E75] mb-2 [font-family:var(--font-manrope)]";

  return (
    <div className="bg-[#F5F5F3] text-[#14161A] [font-family:var(--font-manrope)] selection:bg-[#E14A2E]/30">
      <Navbar
        cartCount={cartItems.reduce((sum, item) => sum + item.quantity, 0)}
        favoritesCount={favorites.length}
        onCartClick={() => {
          setDrawerTab("cart");
          setIsDrawerOpen(true);
        }}
        onFavoritesClick={() => {
          setDrawerTab("favorites");
          setIsDrawerOpen(true);
        }}
      />

      {/* Hero — single centered column over the slider, bottom-anchored so the gradient (not the layout) does the work */}
      <section className="relative h-screen min-h-[640px] overflow-hidden flex items-end justify-center">
        <AnimatePresence mode="sync">
          <motion.div
            key={activeSlide}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
            className="absolute inset-0"
          >
            <Image
              src={heroSlides[activeSlide].image}
              alt="Boreal Winter 2026 collection — placeholder photo, replace with real product photography"
              fill
              priority
              sizes="100vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
          </motion.div>
        </AnimatePresence>

        <button
          type="button"
          onClick={() => goToSlide(activeSlide - 1)}
          className="hidden lg:flex absolute left-5 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full border border-white/30 items-center justify-center text-white hover:bg-white/10 transition-colors"
          aria-label="Previous slide"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={() => goToSlide(activeSlide + 1)}
          className="hidden lg:flex absolute right-5 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full border border-white/30 items-center justify-center text-white hover:bg-white/10 transition-colors"
          aria-label="Next slide"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        <div className="relative z-10 w-full max-w-2xl mx-auto px-6 pb-20 sm:pb-24 text-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSlide}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.4 }}
            >
              <h1 className="[font-family:var(--font-anton)] text-white uppercase leading-[0.95] text-3xl sm:text-4xl lg:text-5xl">
                {heroSlides[activeSlide].heading}
              </h1>
              <p className="text-white/75 text-sm sm:text-base leading-relaxed max-w-md mx-auto mt-5 mb-8">
                {heroSlides[activeSlide].copy}
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
                <a
                  href={heroSlides[activeSlide].ctaHref}
                  onClick={(e) => {
                    e.preventDefault();
                    document.querySelector(heroSlides[activeSlide].ctaHref)?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-[#E14A2E] text-white text-sm font-bold uppercase tracking-[0.1em] hover:bg-[#C93D24] transition-colors"
                >
                  {heroSlides[activeSlide].ctaLabel} <ArrowRight className="w-4 h-4" />
                </a>
                <a
                  href="#join"
                  onClick={(e) => {
                    e.preventDefault();
                    document.querySelector("#join")?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 border border-white/40 text-white text-sm font-bold uppercase tracking-[0.1em] hover:border-white hover:bg-white/10 transition-colors"
                >
                  Join the Waitlist
                </a>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="absolute bottom-6 left-0 right-0 z-10 flex items-center justify-center gap-2.5">
          {heroSlides.map((slide, i) => (
            <button
              key={slide.heading}
              type="button"
              onClick={() => goToSlide(i)}
              aria-label={`Go to slide ${i + 1}`}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === activeSlide ? "w-8 bg-[#E14A2E]" : "w-1.5 bg-white/30 hover:bg-white/50"
              }`}
            />
          ))}
        </div>
      </section>

      {/* Marquee ticker */}
      <section className="relative bg-[#E14A2E] py-3 overflow-hidden">
        <div className="flex w-max animate-boreal-marquee">
          {[0, 1].map((group) => (
            <div key={group} className="flex items-center flex-shrink-0">
              {marqueeText.map((text) => (
                <span
                  key={text}
                  className="flex items-center gap-3 px-5 text-white text-xs sm:text-sm font-bold uppercase tracking-[0.15em] whitespace-nowrap"
                >
                  {text}
                  <span className="text-white/50">✦</span>
                </span>
              ))}
            </div>
          ))}
        </div>
        <style jsx>{`
          @keyframes boreal-marquee-scroll {
            from {
              transform: translateX(0);
            }
            to {
              transform: translateX(-50%);
            }
          }
          .animate-boreal-marquee {
            animation: boreal-marquee-scroll 20s linear infinite;
          }
        `}</style>
      </section>

      {/* Collection — filterable product grid with cart + favorite actions */}
      <section id="collection" className="relative py-20 lg:py-28 scroll-mt-20">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-10"
          >
            <div>
              <span className="text-xs uppercase tracking-[0.25em] text-[#E14A2E] font-bold">Shop</span>
              <h2 className="[font-family:var(--font-anton)] uppercase text-4xl sm:text-5xl mt-3">
                The Collection
              </h2>
            </div>
          </motion.div>

          <div className="flex flex-wrap gap-2 mb-10">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${
                  activeCategory === cat
                    ? "bg-[#14161A] text-white"
                    : "bg-[#EAEAE7] text-[#5A5D64] hover:bg-[#DEDEDA]"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map((product, i) => {
              const isFavorited = favorites.some((f) => f.id === product.id);
              return (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: (i % 3) * 0.08 }}
                  className="group"
                >
                  <div className="relative aspect-[3/4] overflow-hidden bg-[#EAEAE7] mb-4">
                    <Image
                      src={product.image}
                      alt={product.name}
                      fill
                      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <button
                      type="button"
                      onClick={() => toggleFavorite(product)}
                      aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
                      className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/90 flex items-center justify-center hover:bg-white transition-colors"
                    >
                      <Heart
                        className={`w-4 h-4 ${isFavorited ? "fill-[#E14A2E] text-[#E14A2E]" : "text-[#14161A]"}`}
                      />
                    </button>
                    <div className="absolute inset-x-0 bottom-0 p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                      <button
                        type="button"
                        onClick={() => addToCart(product)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-[#14161A] text-xs font-bold uppercase tracking-[0.1em] hover:bg-[#F5F5F3] transition-colors"
                      >
                        <ShoppingBag className="w-3.5 h-3.5" /> Add to Cart
                      </button>
                    </div>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-[#8B8E96] mb-1">{product.category}</p>
                      <h3 className="font-semibold text-[#14161A]">{product.name}</h3>
                    </div>
                    <span className="font-bold text-[#14161A] flex-shrink-0">${product.price}</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Technology — dark full-bleed feature band */}
      <section id="technology" className="relative py-20 lg:py-28 bg-[#0F1115] scroll-mt-20">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="text-xs uppercase tracking-[0.25em] text-[#E14A2E] font-bold">Technology</span>
            <h2 className="[font-family:var(--font-anton)] uppercase text-white text-4xl sm:text-5xl mt-3">
              Built for the Cold
            </h2>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {techFeatures.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  className="border border-white/10 p-6"
                >
                  <Icon className="w-6 h-6 text-[#E14A2E] mb-5" />
                  <h3 className="text-white font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-white/60 leading-relaxed">{feature.description}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Lookbook — offset masonry gallery */}
      <section id="lookbook" className="relative py-20 lg:py-28 scroll-mt-20">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <span className="text-xs uppercase tracking-[0.25em] text-[#E14A2E] font-bold">Lookbook</span>
            <h2 className="[font-family:var(--font-anton)] uppercase text-4xl sm:text-5xl mt-3">Worn in the Wild</h2>
          </motion.div>

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {lookbookPhotos.map((item, i) => (
              <motion.div
                key={item.seed}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className={`relative overflow-hidden ${item.h} ${i === 0 ? "col-span-2 lg:col-span-1" : ""}`}
              >
                <Image
                  src={photo(item.seed, 500, 700)}
                  alt="Boreal lookbook photo — placeholder, replace with real lifestyle photography"
                  fill
                  sizes="(min-width: 1024px) 20vw, 50vw"
                  className="object-cover"
                />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Sizing */}
      <section id="sizing" className="relative py-20 lg:py-28 bg-[#EAEAE7] scroll-mt-20">
        <div className="max-w-3xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <span className="text-xs uppercase tracking-[0.25em] text-[#E14A2E] font-bold">Size Guide</span>
            <h2 className="[font-family:var(--font-anton)] uppercase text-4xl sm:text-5xl mt-3">Find Your Fit</h2>
            <p className="text-[#5A5D64] mt-4">All measurements in inches. Between sizes? Size up for layering.</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="overflow-x-auto bg-white"
          >
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="bg-[#14161A] text-white uppercase text-xs tracking-wider">
                  <th className="px-5 py-4 font-semibold">Size</th>
                  <th className="px-5 py-4 font-semibold">Chest</th>
                  <th className="px-5 py-4 font-semibold">Waist</th>
                  <th className="px-5 py-4 font-semibold">Length</th>
                </tr>
              </thead>
              <tbody>
                {sizeChart.map((row, i) => (
                  <tr key={row.size} className={i % 2 === 0 ? "bg-white" : "bg-[#F5F5F3]"}>
                    <td className="px-5 py-3.5 font-bold">{row.size}</td>
                    <td className="px-5 py-3.5 text-[#5A5D64]">{row.chest}&quot;</td>
                    <td className="px-5 py-3.5 text-[#5A5D64]">{row.waist}&quot;</td>
                    <td className="px-5 py-3.5 text-[#5A5D64]">{row.length}&quot;</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>

          <p className="text-center text-sm text-[#5A5D64] mt-6">
            Still unsure?{" "}
            <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="font-bold text-[#E14A2E]">
              Message us on WhatsApp
            </a>{" "}
            and we&apos;ll help you pick a size.
          </p>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="relative py-20 lg:py-28 scroll-mt-20">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <span className="text-xs uppercase tracking-[0.25em] text-[#E14A2E] font-bold">Reviews</span>
            <h2 className="[font-family:var(--font-anton)] uppercase text-4xl sm:text-5xl mt-3">
              What Our Customers Say
            </h2>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {testimonials.map((t, i) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="bg-[#EAEAE7] p-6 flex flex-col"
              >
                <Quote className="w-5 h-5 text-[#E14A2E] mb-4" />
                <div className="flex items-center gap-0.5 mb-3">
                  {Array.from({ length: 5 }).map((_, starIndex) => (
                    <Star
                      key={starIndex}
                      className={`w-3.5 h-3.5 ${
                        starIndex < t.rating ? "fill-[#E14A2E] text-[#E14A2E]" : "text-[#D8D9DC]"
                      }`}
                    />
                  ))}
                </div>
                <p className="text-sm text-[#3A3D44] leading-relaxed flex-1 mb-5">&quot;{t.quote}&quot;</p>
                <div>
                  <p className="text-sm font-bold text-[#14161A]">{t.name}</p>
                  <p className="text-xs text-[#8B8E96]">{t.location}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="relative py-20 lg:py-28 bg-[#EAEAE7] scroll-mt-20">
        <div className="max-w-3xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <span className="text-xs uppercase tracking-[0.25em] text-[#E14A2E] font-bold">FAQ</span>
            <h2 className="[font-family:var(--font-anton)] uppercase text-4xl sm:text-5xl mt-3">Good to Know</h2>
          </motion.div>

          <div className="divide-y divide-[#D8D9DC]">
            {faqs.map((faq, i) => (
              <div key={faq.question}>
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between gap-4 py-6 text-left"
                >
                  <span className="font-semibold text-[#14161A]">{faq.question}</span>
                  <ChevronDown
                    className={`w-5 h-5 flex-shrink-0 text-[#E14A2E] transition-transform duration-300 ${
                      openFaq === i ? "rotate-180" : ""
                    }`}
                  />
                </button>
                <motion.div
                  initial={false}
                  animate={{ height: openFaq === i ? "auto" : 0, opacity: openFaq === i ? 1 : 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <p className="pb-6 text-sm text-[#5A5D64] leading-relaxed max-w-xl">{faq.answer}</p>
                </motion.div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Join the waitlist */}
      <section id="join" className="relative py-20 lg:py-28 bg-[#0F1115] scroll-mt-20">
        <div className="max-w-2xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <span className="text-xs uppercase tracking-[0.25em] text-[#E14A2E] font-bold">Winter 2026</span>
            <h2 className="[font-family:var(--font-anton)] uppercase text-white text-4xl sm:text-5xl mt-3">
              Join the Drop
            </h2>
            <p className="text-white/60 mt-4">
              Get early access before public checkout opens, plus your shipping date.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-white p-8"
          >
            {isSubmitted ? (
              <div className="text-center py-10">
                <div className="w-16 h-16 rounded-full border border-[#14161A]/20 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8 text-[#E14A2E]" />
                </div>
                <h3 className="[font-family:var(--font-anton)] uppercase text-2xl mb-2">You&apos;re on the list!</h3>
                <p className="text-[#5A5D64]">We&apos;ll be in touch with your early access details.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label htmlFor="name" className={labelClass}>Full Name *</label>
                    <input type="text" id="name" name="name" required value={formState.name} onChange={handleChange} placeholder="Your name" className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor="email" className={labelClass}>Email *</label>
                    <input type="email" id="email" name="email" required value={formState.email} onChange={handleChange} placeholder="you@example.com" className={inputClass} />
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label htmlFor="phone" className={labelClass}>Phone</label>
                    <input type="tel" id="phone" name="phone" value={formState.phone} onChange={handleChange} placeholder="+880 1XXX-XXXXXX" className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor="interest" className={labelClass}>Interested In</label>
                    <select id="interest" name="interest" value={formState.interest} onChange={handleChange} className={inputClass}>
                      <option value="">No preference</option>
                      {products.map((p) => (
                        <option key={p.name} value={p.name}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label htmlFor="message" className={labelClass}>Anything else?</label>
                  <textarea id="message" name="message" rows={3} value={formState.message} onChange={handleChange} placeholder="Questions about sizing, shipping, materials..." className={`${inputClass} resize-none`} />
                </div>

                {submitError && <p className="text-sm text-red-700">{submitError}</p>}

                <motion.button
                  type="submit"
                  disabled={isSubmitting}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full flex items-center justify-center gap-3 px-8 py-4 bg-[#E14A2E] text-white font-bold uppercase tracking-[0.1em] text-sm hover:bg-[#C93D24] transition-colors disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  {isSubmitting ? "Sending..." : "Join the Waitlist"}
                </motion.button>

                <div className="flex items-center gap-3 pt-1">
                  <div className="flex-1 h-px bg-[#D8D9DC]" />
                  <span className="text-xs text-[#9A9DA5]">or</span>
                  <div className="flex-1 h-px bg-[#D8D9DC]" />
                </div>

                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-3 px-8 py-3.5 border border-[#D8D9DC] font-bold uppercase tracking-[0.1em] text-xs text-[#14161A] hover:bg-[#F5F5F3] transition-colors"
                >
                  Message Us on WhatsApp
                </a>
              </form>
            )}
          </motion.div>
        </div>
      </section>

      <Footer phone={contactPhone} email={email} whatsappHref={whatsappHref} />

      <CartDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        activeTab={drawerTab}
        onTabChange={setDrawerTab}
        cartItems={cartItems}
        favorites={favorites}
        onUpdateQuantity={updateCartQuantity}
        onRemoveFromCart={removeFromCart}
        onRemoveFavorite={removeFavorite}
        onMoveFavoriteToCart={moveFavoriteToCart}
        onOrderComplete={() => setCartItems([])}
      />
    </div>
  );
}
