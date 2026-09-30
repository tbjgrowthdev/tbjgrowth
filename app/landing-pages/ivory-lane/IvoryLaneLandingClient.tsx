"use client";

import { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  ArrowRight,
  ArrowDown,
  ChevronDown,
  Send,
  CheckCircle2,
  Mail,
  Camera,
  Check,
  Instagram,
} from "lucide-react";
import { submitContactForm } from "@/app/(admin)/actions/forms";
import Navbar from "./Navbar";
import Footer from "./Footer";

const heroImage = "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1920&q=80";
const aboutImage = "https://images.unsplash.com/photo-1522673607200-164d1b6ce486?auto=format&fit=crop&w=900&q=80";

const weddingPhotos = {
  firstKiss: {
    title: "The First Kiss",
    category: "Ceremony",
    thumb: "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=800&q=80",
    large: "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=1600&q=85",
  },
  rings: {
    title: "The Rings",
    category: "Detail",
    thumb: "https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?auto=format&fit=crop&w=800&q=80",
    large: "https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?auto=format&fit=crop&w=1600&q=85",
  },
  aisle: {
    title: "Down the Aisle",
    category: "Ceremony",
    thumb: "https://images.unsplash.com/photo-1519225421980-715cb0215aed?auto=format&fit=crop&w=800&q=80",
    large: "https://images.unsplash.com/photo-1519225421980-715cb0215aed?auto=format&fit=crop&w=1600&q=85",
  },
  goldenHour: {
    title: "Golden Hour",
    category: "Portrait",
    thumb: "https://images.unsplash.com/photo-1583939003579-730e3918a45a?auto=format&fit=crop&w=800&q=80",
    large: "https://images.unsplash.com/photo-1583939003579-730e3918a45a?auto=format&fit=crop&w=1600&q=85",
  },
  twoOfUs: {
    title: "Just the Two of Us",
    category: "Portrait",
    thumb: "https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?auto=format&fit=crop&w=800&q=80",
    large: "https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?auto=format&fit=crop&w=1600&q=85",
  },
  girls: {
    title: "The Girls",
    category: "Ceremony",
    thumb: "https://images.unsplash.com/photo-1537633552985-df8429e8048b?auto=format&fit=crop&w=800&q=80",
    large: "https://images.unsplash.com/photo-1537633552985-df8429e8048b?auto=format&fit=crop&w=1600&q=85",
  },
  bouquet: {
    title: "The Bouquet",
    category: "Detail",
    thumb: "https://images.unsplash.com/photo-1591604466107-ec97de577aff?auto=format&fit=crop&w=800&q=80",
    large: "https://images.unsplash.com/photo-1591604466107-ec97de577aff?auto=format&fit=crop&w=1600&q=85",
  },
  confetti: {
    title: "Confetti & Cheers",
    category: "Reception",
    thumb: "https://images.unsplash.com/photo-1520854221256-17451cc331bf?auto=format&fit=crop&w=800&q=80",
    large: "https://images.unsplash.com/photo-1520854221256-17451cc331bf?auto=format&fit=crop&w=1600&q=85",
  },
  walkWithMe: {
    title: "Walk With Me",
    category: "Portrait",
    thumb: "https://images.unsplash.com/photo-1460978812857-470ed1c77af0?auto=format&fit=crop&w=800&q=80",
    large: "https://images.unsplash.com/photo-1460978812857-470ed1c77af0?auto=format&fit=crop&w=1600&q=85",
  },
  firstDance: {
    title: "The First Dance",
    category: "Reception",
    thumb: "https://images.unsplash.com/photo-1606216794074-735e91aa2c92?auto=format&fit=crop&w=800&q=80",
    large: "https://images.unsplash.com/photo-1606216794074-735e91aa2c92?auto=format&fit=crop&w=1600&q=85",
  },
};

const featuredWeddings = [
  { location: "The Cotswolds, England", title: "A Garden Wedding", photo: weddingPhotos.aisle },
  { location: "Vík, Iceland", title: "An Intimate Elopement", photo: weddingPhotos.goldenHour },
  { location: "Tuscany, Italy", title: "A Vineyard Celebration", photo: weddingPhotos.firstDance },
];

const instagramGrid = [
  weddingPhotos.firstKiss,
  weddingPhotos.rings,
  weddingPhotos.girls,
  weddingPhotos.bouquet,
  weddingPhotos.confetti,
  weddingPhotos.walkWithMe,
];

const aboutStats = [
  { value: "120+", label: "Weddings Photographed" },
  { value: "9", label: "Countries Shot In" },
  { value: "8", label: "Years Behind the Camera" },
];

const packages = [
  {
    name: "The Elopement",
    price: "$1,800",
    description: "For couples keeping it small and honest.",
    features: ["3 hours of coverage", "1 photographer", "Online gallery", "150+ edited images"],
    highlighted: false,
  },
  {
    name: "The Classic Day",
    price: "$3,400",
    description: "Full-day coverage for a traditional celebration.",
    features: [
      "8 hours of coverage",
      "1 photographer + assistant",
      "Engagement session included",
      "500+ edited images",
      "USB keepsake box",
    ],
    highlighted: true,
  },
  {
    name: "The Full Story",
    price: "$5,200",
    description: "Every moment, from rehearsal to last dance.",
    features: [
      "Full weekend coverage",
      "2 photographers",
      "Engagement + rehearsal dinner",
      "Printed heirloom album",
      "800+ edited images",
      "Priority editing",
    ],
    highlighted: false,
  },
];

const processSteps = [
  { step: "01", title: "Inquire", description: "Tell me about your day — I reply within 48 hours." },
  { step: "02", title: "Meet", description: "A call or coffee to talk through your vision and timeline." },
  { step: "03", title: "Your Day", description: "I arrive early, stay late, and stay quietly out of the way." },
  { step: "04", title: "Delivery", description: "A full gallery within six weeks, ready to relive." },
];

const faqs = [
  {
    question: "How far in advance should we book?",
    answer:
      "Most couples book 9–12 months ahead, especially for peak season (May–October). If your date is sooner, reach out anyway — I keep a short waitlist for openings.",
  },
  {
    question: "Do you travel for destination weddings?",
    answer:
      "Yes, worldwide. Travel and accommodation are quoted separately based on location, and I'm always happy to extend a trip for an engagement session.",
  },
  {
    question: "What happens if it rains?",
    answer:
      "We adapt, not panic. Some of the most memorable frames I've taken happened because the weather didn't cooperate. I always have a backup plan for your venue.",
  },
  {
    question: "How many photos will we receive, and when?",
    answer:
      "It depends on your package — see the Investment section for exact counts. Your full gallery is delivered within six weeks, with a sneak peek of 15–20 images within 72 hours.",
  },
];

export default function IvoryLaneLandingClient({
  phone,
  email,
}: {
  phone?: string | null;
  email?: string | null;
}) {
  const contactPhone = phone || "+880 1521-202204";
  const whatsappHref = `https://wa.me/${contactPhone.replace(/[^\d]/g, "")}?text=${encodeURIComponent(
    "Hi! I'd like to ask about wedding photography availability with Ivory Lane."
  )}`;

  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [formState, setFormState] = useState({
    name: "",
    email: "",
    phone: "",
    weddingDate: "",
    venue: "",
    guests: "",
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
      formState.weddingDate ? `Wedding date: ${formState.weddingDate}` : null,
      formState.venue ? `Venue / location: ${formState.venue}` : null,
      formState.guests ? `Estimated guests: ${formState.guests}` : null,
      formState.message || null,
    ]
      .filter(Boolean)
      .join("\n");

    const result = await submitContactForm({
      name: formState.name,
      email: formState.email,
      phone: formState.phone,
      message,
      source: "Ivory Lane Photography Landing Page",
    });

    if (result.success) {
      setIsSubmitted(true);
      setFormState({ name: "", email: "", phone: "", weddingDate: "", venue: "", guests: "", message: "" });
    } else {
      setSubmitError("Something went wrong sending your inquiry. Please try WhatsApp instead, or try again.");
    }
    setIsSubmitting(false);
  };

  const inputClass =
    "w-full px-4 py-3 bg-white border border-[#E4DDD2] text-[#26221F] placeholder-[#A39B8C] focus:outline-none focus:border-[#C1785A] focus:ring-1 focus:ring-[#C1785A]/30 transition-all [font-family:var(--font-work-sans)] text-sm";
  const labelClass = "block text-xs uppercase tracking-wider text-[#8A8272] mb-2 [font-family:var(--font-work-sans)]";

  return (
    <div className="bg-[#FAF6F1] text-[#26221F] [font-family:var(--font-work-sans)] selection:bg-[#C1785A]/25">
      <Navbar />

      {/* Hero — single fixed romantic photo, centered serif headline, one CTA */}
      <section className="relative h-screen min-h-[640px] flex items-center justify-center overflow-hidden">
        <Image
          src={heroImage}
          alt="Ivory Lane Photography — wedding couple at golden hour"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/50" />

        <div className="relative z-10 text-center px-6 max-w-2xl">
          <motion.span
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-block text-xs uppercase tracking-[0.3em] text-white/80 mb-6"
          >
            Wedding &amp; Elopement Photography
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="[font-family:var(--font-playfair)] italic text-white text-4xl sm:text-5xl lg:text-6xl leading-[1.15]"
          >
            Timeless stories, told
            <br />
            through light.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-white/85 text-sm sm:text-base leading-relaxed max-w-md mx-auto mt-6 mb-9"
          >
            Editorial wedding photography for couples who want their day remembered
            as it actually felt — not staged, just real.
          </motion.p>
          <motion.a
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            href="#inquire"
            onClick={(e) => {
              e.preventDefault();
              document.querySelector("#inquire")?.scrollIntoView({ behavior: "smooth" });
            }}
            className="inline-flex items-center gap-2 px-7 py-3.5 bg-white text-[#26221F] text-xs font-medium uppercase tracking-[0.18em] hover:bg-[#C1785A] hover:text-white transition-colors"
          >
            Inquire About Your Date <ArrowRight className="w-4 h-4" />
          </motion.a>
        </div>

        <motion.button
          onClick={() => document.querySelector("#philosophy")?.scrollIntoView({ behavior: "smooth" })}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, y: [0, 8, 0] }}
          transition={{ opacity: { delay: 0.6 }, y: { duration: 1.8, repeat: Infinity, ease: "easeInOut" } }}
          className="absolute bottom-8 z-10 w-10 h-10 rounded-full border border-white/40 flex items-center justify-center text-white"
          aria-label="Scroll to learn more"
        >
          <ArrowDown className="w-4 h-4" />
        </motion.button>
      </section>

      {/* Philosophy — asymmetric portrait + editorial pull-quote */}
      <section id="philosophy" className="relative py-20 lg:py-28 scroll-mt-20">
        <div className="max-w-6xl mx-auto px-6 grid lg:grid-cols-5 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative aspect-[4/5] lg:col-span-2 overflow-hidden"
          >
            <Image
              src={weddingPhotos.twoOfUs.large}
              alt={weddingPhotos.twoOfUs.title}
              fill
              sizes="(min-width: 1024px) 35vw, 90vw"
              className="object-cover"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-3"
          >
            <p className="[font-family:var(--font-playfair)] italic text-2xl sm:text-3xl lg:text-4xl leading-[1.3] text-[#26221F]">
              &quot;I don&apos;t direct your wedding day — I disappear into it, and hand you back
              the moments you were too busy living to notice.&quot;
            </p>
            <p className="text-[#6B6459] leading-relaxed mt-8 max-w-lg">
              No forced poses, no interrupted toasts. Just quiet, attentive documentation —
              the nervous hands before the ceremony, the joke that made your grandmother laugh,
              the look your partner gave you when they thought no one was watching.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Featured Weddings */}
      <section id="portfolio" className="relative py-20 lg:py-28 bg-[#F1E9DD] scroll-mt-20">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <span className="text-xs uppercase tracking-[0.25em] text-[#C1785A] font-medium">Portfolio</span>
            <h2 className="[font-family:var(--font-playfair)] italic text-4xl sm:text-5xl mt-4">
              Featured Weddings
            </h2>
          </motion.div>

          <div className="grid lg:grid-cols-3 gap-6">
            {featuredWeddings.map((wedding, i) => (
              <motion.div
                key={wedding.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="group relative aspect-[3/4] overflow-hidden"
              >
                <Image
                  src={wedding.photo.large}
                  alt={wedding.photo.title}
                  fill
                  sizes="(min-width: 1024px) 33vw, 100vw"
                  className="object-cover group-hover:scale-105 transition-transform duration-700"
                />
                <span className="absolute top-4 left-4 text-[10px] uppercase tracking-[0.15em] text-white bg-black/40 backdrop-blur px-3 py-1.5 rounded-full">
                  {wedding.photo.category}
                </span>
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-6">
                  <span className="text-xs uppercase tracking-[0.18em] text-white/70">{wedding.location}</span>
                  <h3 className="[font-family:var(--font-playfair)] italic text-2xl text-white mt-2 mb-3">
                    {wedding.title}
                  </h3>
                  <a
                    href="#portfolio"
                    onClick={(e) => {
                      e.preventDefault();
                      document.querySelector("#inquire")?.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.15em] text-white border-b border-white/50 pb-1 group-hover:border-white transition-colors"
                  >
                    View the Story <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Investment / Packages */}
      <section id="investment" className="relative py-20 lg:py-28 scroll-mt-20">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <span className="text-xs uppercase tracking-[0.25em] text-[#C1785A] font-medium">Investment</span>
            <h2 className="[font-family:var(--font-playfair)] italic text-4xl sm:text-5xl mt-4">
              Photography Packages
            </h2>
          </motion.div>

          <div className="grid lg:grid-cols-3 gap-6">
            {packages.map((pkg, i) => (
              <motion.div
                key={pkg.name}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className={`relative p-8 flex flex-col ${
                  pkg.highlighted
                    ? "bg-[#26221F] text-white lg:-translate-y-3 shadow-[0_20px_50px_-20px_rgba(38,34,31,0.4)]"
                    : "bg-[#F1E9DD] text-[#26221F]"
                }`}
              >
                {pkg.highlighted && (
                  <span className="absolute top-0 right-8 -translate-y-1/2 px-4 py-1.5 bg-[#C1785A] text-white text-[10px] font-medium uppercase tracking-[0.18em] rounded-full">
                    Most Chosen
                  </span>
                )}
                <h3 className="[font-family:var(--font-playfair)] italic text-3xl mb-2">{pkg.name}</h3>
                <p className={`text-sm mb-6 ${pkg.highlighted ? "text-white/60" : "text-[#8A8272]"}`}>
                  {pkg.description}
                </p>
                <p className="text-3xl font-medium mb-6">
                  {pkg.price} <span className="text-sm font-normal opacity-60">and up</span>
                </p>
                <ul className="space-y-3 mb-8 flex-1">
                  {pkg.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm">
                      <Check className={`w-4 h-4 flex-shrink-0 mt-0.5 ${pkg.highlighted ? "text-[#C1785A]" : "text-[#C1785A]"}`} />
                      <span className={pkg.highlighted ? "text-white/85" : "text-[#4A4438]"}>{feature}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href="#inquire"
                  onClick={(e) => {
                    e.preventDefault();
                    document.querySelector("#inquire")?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className={`inline-flex items-center justify-center gap-2 px-6 py-3 text-xs uppercase tracking-[0.18em] transition-colors ${
                    pkg.highlighted
                      ? "bg-white text-[#26221F] hover:bg-[#C1785A] hover:text-white"
                      : "bg-[#26221F] text-white hover:bg-[#C1785A]"
                  }`}
                >
                  Inquire
                </a>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Process */}
      <section id="process" className="relative py-20 lg:py-28 bg-[#F1E9DD] scroll-mt-20">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="text-xs uppercase tracking-[0.25em] text-[#C1785A] font-medium">How It Works</span>
            <h2 className="[font-family:var(--font-playfair)] italic text-4xl sm:text-5xl mt-4">The Process</h2>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6 relative">
            <div className="hidden lg:block absolute top-6 left-0 right-0 h-px bg-[#DDD2C0]" />
            {processSteps.map((step, i) => (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="relative"
              >
                <div className="w-12 h-12 rounded-full bg-[#26221F] text-white flex items-center justify-center [font-family:var(--font-playfair)] italic text-lg relative z-10 mb-5">
                  {step.step}
                </div>
                <h3 className="[font-family:var(--font-playfair)] text-xl mb-2">{step.title}</h3>
                <p className="text-sm text-[#6B6459] leading-relaxed max-w-xs">{step.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="relative py-20 lg:py-28 scroll-mt-20">
        <div className="max-w-6xl mx-auto px-6 grid lg:grid-cols-2 gap-14 items-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative aspect-[4/5] overflow-hidden order-2 lg:order-1"
          >
            <Image
              src={aboutImage}
              alt="The photographer behind Ivory Lane"
              fill
              sizes="(min-width: 1024px) 45vw, 90vw"
              className="object-cover"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="order-1 lg:order-2"
          >
            <span className="text-xs uppercase tracking-[0.25em] text-[#C1785A] font-medium">About</span>
            <h2 className="[font-family:var(--font-playfair)] italic text-4xl sm:text-5xl mt-4 mb-6">
              Hi, I&apos;m the person behind the camera.
            </h2>
            <p className="text-[#6B6459] leading-relaxed mb-5">
              I started photographing weddings because I loved watching people who love each
              other, and I still do. Every couple gets my full attention, from the first phone
              call to the final delivered image.
            </p>
            <p className="text-[#6B6459] leading-relaxed mb-8">
              I take on a limited number of weddings each year so I can stay present at every
              single one — no double-booked Saturdays, no rushing between venues.
            </p>
            <p className="[font-family:var(--font-playfair)] italic text-2xl text-[#26221F] mb-10">— Amara</p>

            <div className="grid grid-cols-3 gap-6 pt-8 border-t border-[#E4DDD2]">
              {aboutStats.map((stat) => (
                <div key={stat.label}>
                  <p className="[font-family:var(--font-playfair)] italic text-2xl sm:text-3xl text-[#26221F]">
                    {stat.value}
                  </p>
                  <p className="text-[11px] uppercase tracking-wider text-[#8A8272] mt-1 leading-tight">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Instagram grid */}
      <section className="relative py-20 lg:py-28 bg-[#F1E9DD]">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-[#C1785A] font-medium mb-4">
              <Instagram className="w-3.5 h-3.5" /> Follow Along
            </span>
            <h2 className="[font-family:var(--font-playfair)] italic text-4xl sm:text-5xl">
              @ivorylanephoto
            </h2>
          </motion.div>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {instagramGrid.map((item) => (
              <div key={item.title} className="relative aspect-square overflow-hidden group">
                <Image
                  src={item.thumb}
                  alt={item.title}
                  fill
                  sizes="(min-width: 640px) 16vw, 33vw"
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-300 flex items-center justify-center">
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs uppercase tracking-[0.15em] text-center px-2">
                    {item.title}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Honest availability trust block — no fabricated reviews */}
      <section className="relative py-20 lg:py-28">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#F1E9DD] rounded-full mb-6">
            <Camera className="w-4 h-4 text-[#C1785A]" />
            <span className="text-sm font-medium text-[#26221F]">Now Booking 2026–2027</span>
          </div>
          <h2 className="[font-family:var(--font-playfair)] italic text-3xl sm:text-4xl mb-4">
            Only 18 Weddings a Year, By Design
          </h2>
          <p className="text-[#6B6459] leading-relaxed mb-8">
            I keep my calendar deliberately light so I can give every couple the same level of
            care — from the planning calls to the final gallery. If your date is still open,
            let&apos;s talk about it.
          </p>
          <motion.a
            href="#inquire"
            onClick={(e) => {
              e.preventDefault();
              document.querySelector("#inquire")?.scrollIntoView({ behavior: "smooth" });
            }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="inline-flex items-center gap-2 px-6 py-3.5 bg-[#26221F] text-white text-xs font-medium uppercase tracking-[0.18em] hover:bg-[#C1785A] transition-colors group"
          >
            Check My Date
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </motion.a>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="relative py-20 lg:py-28 bg-[#F1E9DD] scroll-mt-20">
        <div className="max-w-3xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <span className="text-xs uppercase tracking-[0.25em] text-[#C1785A] font-medium">Good to Know</span>
            <h2 className="[font-family:var(--font-playfair)] italic text-4xl sm:text-5xl mt-4">
              Frequently Asked Questions
            </h2>
          </motion.div>

          <div className="divide-y divide-[#DDD2C0]">
            {faqs.map((faq, i) => (
              <div key={faq.question}>
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between gap-4 py-6 text-left"
                >
                  <span className="font-medium text-[#26221F]">{faq.question}</span>
                  <ChevronDown
                    className={`w-5 h-5 flex-shrink-0 text-[#C1785A] transition-transform duration-300 ${
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
                  <p className="pb-6 text-sm text-[#6B6459] leading-relaxed max-w-xl">{faq.answer}</p>
                </motion.div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Inquiry form */}
      <section id="inquire" className="relative py-20 lg:py-28 scroll-mt-20">
        <div className="max-w-2xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <span className="text-xs uppercase tracking-[0.25em] text-[#C1785A] font-medium">Let&apos;s Talk</span>
            <h2 className="[font-family:var(--font-playfair)] italic text-4xl sm:text-5xl mt-4">
              Inquire About Your Date
            </h2>
            <p className="text-[#6B6459] mt-4">Tell me a little about your day — I&apos;ll reply within 48 hours.</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-[#F1E9DD] p-8"
          >
            {isSubmitted ? (
              <div className="text-center py-10">
                <div className="w-16 h-16 rounded-full border border-[#26221F]/20 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8 text-[#C1785A]" />
                </div>
                <h3 className="[font-family:var(--font-playfair)] italic text-2xl mb-2">Thank you!</h3>
                <p className="text-[#6B6459]">I&apos;ll be in touch within 48 hours to talk about your day.</p>
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
                    <label htmlFor="weddingDate" className={labelClass}>Wedding Date</label>
                    <input type="date" id="weddingDate" name="weddingDate" value={formState.weddingDate} onChange={handleChange} className={inputClass} />
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label htmlFor="venue" className={labelClass}>Venue / Location</label>
                    <input type="text" id="venue" name="venue" value={formState.venue} onChange={handleChange} placeholder="City, venue, or still deciding" className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor="guests" className={labelClass}>Estimated Guests</label>
                    <input type="text" id="guests" name="guests" value={formState.guests} onChange={handleChange} placeholder="e.g. 80" className={inputClass} />
                  </div>
                </div>
                <div>
                  <label htmlFor="message" className={labelClass}>Tell me about your day</label>
                  <textarea id="message" name="message" rows={4} value={formState.message} onChange={handleChange} placeholder="Vision, vibe, must-have shots..." className={`${inputClass} resize-none`} />
                </div>

                {submitError && <p className="text-sm text-red-700">{submitError}</p>}

                <motion.button
                  type="submit"
                  disabled={isSubmitting}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full flex items-center justify-center gap-3 px-8 py-4 bg-[#26221F] text-white text-xs font-medium uppercase tracking-[0.18em] hover:bg-[#C1785A] transition-colors disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  {isSubmitting ? "Sending..." : "Send Inquiry"}
                </motion.button>

                <div className="flex items-center gap-3 pt-1">
                  <div className="flex-1 h-px bg-[#DDD2C0]" />
                  <span className="text-xs text-[#A39B8C]">or</span>
                  <div className="flex-1 h-px bg-[#DDD2C0]" />
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 px-6 py-3.5 border border-[#DDD2C0] text-xs font-medium uppercase tracking-[0.18em] text-[#26221F] hover:bg-white transition-colors"
                  >
                    WhatsApp
                  </a>
                  {email && (
                    <a
                      href={`mailto:${email}`}
                      className="w-full flex items-center justify-center gap-2 px-6 py-3.5 border border-[#DDD2C0] text-xs font-medium uppercase tracking-[0.18em] text-[#26221F] hover:bg-white transition-colors"
                    >
                      <Mail className="w-3.5 h-3.5" /> Email
                    </a>
                  )}
                </div>
              </form>
            )}
          </motion.div>
        </div>
      </section>

      <Footer phone={contactPhone} email={email} whatsappHref={whatsappHref} />
    </div>
  );
}
