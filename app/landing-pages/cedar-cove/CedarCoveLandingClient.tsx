"use client";

import { useMemo, useRef, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  Wifi,
  Waves,
  Flame,
  UtensilsCrossed,
  TreePine,
  ParkingCircle,
  PawPrint,
  Sparkles,
  Users,
  BedDouble,
  Ruler,
  ChevronDown,
  Send,
  CheckCircle2,
  ArrowRight,
  ArrowDown,
  ArrowLeft,
  Leaf,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { submitContactForm } from "@/app/(admin)/actions/forms";
import Navbar from "./Navbar";
import Footer from "./Footer";
import resorthero from "../../../public/resort-hero.jpg";
import cottageImg from "../../../public/cottage.png";
import cottage1Img from "../../../public/cottage1.png";
import cottage2Img from "../../../public/cottage2.png";
import cottage3Img from "../../../public/cottage3.jpg";

const pad2 = (n: number) => String(n).padStart(2, "0");
const toDateStr = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const addDays = (base: Date, days: number) => {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
};
const addDaysToDateStr = (dateStr: string, days: number) => toDateStr(addDays(new Date(`${dateStr}T00:00:00`), days));
const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const cottages = [
  {
    name: "The Birchwood",
    tagline: "Cozy one-bedroom cabin",
    description:
      "A snug retreat for two, with a private deck facing the water and a wood-burning stove that's already lit when you walk in.",
    guests: 2,
    beds: 1,
    size: "420 sq ft",
    price: "£145",
    image: cottageImg,
  },
  {
    name: "The Hollow Pine",
    tagline: "Two-bedroom family cottage",
    description:
      "Room to spread out — a full kitchen, a living-room fireplace, and a short walk to the trailhead for early risers.",
    guests: 5,
    beds: 2,
    size: "680 sq ft",
    price: "£210",
    image: cottage3Img,
  },
  {
    name: "The Lakehouse Suite",
    tagline: "Waterfront three-bedroom",
    description:
      "Our largest cottage, right on the shoreline, with a wraparound porch and a private dock for slow mornings.",
    guests: 7,
    beds: 3,
    size: "1,050 sq ft",
    price: "£310",
    image: cottage2Img,
  },
];

const reasons = [
  {
    index: "01",
    title: "Total Privacy",
    description: "Every cottage sits apart from the next, wrapped in forest, so nothing carries but birdsong.",
  },
  {
    index: "02",
    title: "Nothing to Plan",
    description: "Stocked kitchens, split firewood, and a fire already lit before you arrive.",
  },
  {
    index: "03",
    title: "Slow Mornings",
    description: "Coffee on the dock, kayaks by the shed, and no schedule but your own.",
  },
];

const amenityList = [
  { icon: Wifi, label: "Free WiFi throughout the property" },
  { icon: Waves, label: "Private dock, open from sunrise" },
  { icon: Flame, label: "Fire pits at every cottage" },
  { icon: UtensilsCrossed, label: "On-site dining, stocked kitchens" },
  { icon: TreePine, label: "Eleven acres of forest trails" },
  { icon: ParkingCircle, label: "Free parking at your door" },
  { icon: PawPrint, label: "Pet friendly, most cottages" },
  { icon: Sparkles, label: "Spa & sauna, seasonal hours" },
];

const groundsPhotos = [
  { label: "Lakeside deck at dawn", image: cottage1Img },
  { label: "Inside the Hollow Pine", image: cottage3Img },
  { label: "Evening fire pit", image: cottageImg },
  { label: "Forest trailhead", image: cottage2Img },
  { label: "The private dock", image: cottage1Img },
  { label: "Breakfast on the porch", image: cottage3Img },
];

const faqs = [
  {
    question: "What time is check-in and check-out?",
    answer:
      "Check-in is from 3:00 PM and check-out is by 11:00 AM. Early check-in or late check-out can sometimes be arranged — just ask when you book.",
  },
  {
    question: "Are pets allowed?",
    answer:
      "Yes, most of our cottages are pet-friendly for a small additional cleaning fee. Let us know when booking so we can assign the right cottage.",
  },
  {
    question: "What's your cancellation policy?",
    answer:
      "Free cancellation up to 7 days before check-in. Cancellations within 7 days are subject to a one-night charge.",
  },
  {
    question: "How far is Cedar Cove from the nearest town?",
    answer:
      "We're about a 20-minute drive from the town center — far enough to feel remote, close enough for a supply run if you need one.",
  },
];

export default function CedarCoveLandingClient({
  phone,
  email,
}: {
  phone?: string | null;
  email?: string | null;
}) {
  const contactPhone = phone || "+880 1521-202204";
  const whatsappHref = `https://wa.me/${contactPhone.replace(/[^\d]/g, "")}?text=${encodeURIComponent(
    "Hi! I'd like to check availability at Cedar Cove Resort & Cottages."
  )}`;

  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [quickSearch, setQuickSearch] = useState({ checkIn: "", checkOut: "", guests: "2" });
  const [formState, setFormState] = useState({
    name: "",
    email: "",
    phone: "",
    checkIn: "",
    checkOut: "",
    guests: "2",
    cottage: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const groundsScrollRef = useRef<HTMLDivElement>(null);
  const scrollGrounds = (dir: 1 | -1) => {
    groundsScrollRef.current?.scrollBy({ left: dir * 360, behavior: "smooth" });
  };

  const handleQuickSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setFormState((prev) => ({ ...prev, ...quickSearch }));
    document.querySelector("#book")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Demo availability calendar — sample booked ranges per cottage, not live reservation data.
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const todayStr = toDateStr(today);

  const bookedRanges = useMemo<Record<string, { start: string; end: string }[]>>(
    () => ({
      "The Birchwood": [
        { start: toDateStr(addDays(today, 3)), end: toDateStr(addDays(today, 5)) },
        { start: toDateStr(addDays(today, 19)), end: toDateStr(addDays(today, 21)) },
      ],
      "The Hollow Pine": [{ start: toDateStr(addDays(today, 9)), end: toDateStr(addDays(today, 12)) }],
      "The Lakehouse Suite": [
        { start: toDateStr(addDays(today, 1)), end: toDateStr(addDays(today, 2)) },
        { start: toDateStr(addDays(today, 23)), end: toDateStr(addDays(today, 28)) },
      ],
    }),
    [today]
  );

  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const getBookedCottages = (dateStr: string) =>
    cottages.filter((c) => (bookedRanges[c.name] || []).some((r) => dateStr >= r.start && dateStr <= r.end));

  const getDayStatus = (dateStr: string) => {
    if (dateStr < todayStr) return "past";
    const bookedCount = getBookedCottages(dateStr).length;
    if (bookedCount === 0) return "open";
    if (bookedCount === cottages.length) return "full";
    return "limited";
  };

  const isPrevMonthDisabled = viewMonth.getFullYear() === today.getFullYear() && viewMonth.getMonth() === today.getMonth();

  const goToPrevMonth = () => {
    setViewMonth((prev) => {
      const next = new Date(prev.getFullYear(), prev.getMonth() - 1, 1);
      const minMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      return next < minMonth ? prev : next;
    });
  };
  const goToNextMonth = () => {
    setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleSelectDay = (day: number) => {
    const dateStr = toDateStr(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day));
    if (dateStr < todayStr) return;
    setSelectedDate(dateStr);
  };

  const handleBookFromCalendar = (cottageName: string) => {
    if (!selectedDate) return;
    setFormState((prev) => ({
      ...prev,
      cottage: cottageName,
      checkIn: selectedDate,
      checkOut: addDaysToDateStr(selectedDate, 1),
    }));
    document.querySelector("#book")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const daysInViewMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
  const firstWeekdayOfMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1).getDay();
  const monthLabel = viewMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });

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
      formState.checkIn && formState.checkOut ? `Dates: ${formState.checkIn} to ${formState.checkOut}` : null,
      `Guests: ${formState.guests}`,
      formState.cottage ? `Preferred cottage: ${formState.cottage}` : null,
      formState.message || null,
    ]
      .filter(Boolean)
      .join("\n");

    const result = await submitContactForm({
      name: formState.name,
      email: formState.email,
      phone: formState.phone,
      message,
      source: "Cedar Cove Landing Page",
    });

    if (result.success) {
      setIsSubmitted(true);
      setFormState({ name: "", email: "", phone: "", checkIn: "", checkOut: "", guests: "2", cottage: "", message: "" });
    } else {
      setSubmitError("Something went wrong sending your request. Please try WhatsApp instead, or try again.");
    }
    setIsSubmitting(false);
  };

  const inputClass =
    "w-full px-4 py-3 rounded-lg bg-white border border-[#DDD3BE] text-[#233324] placeholder-[#9CA89B] focus:outline-none focus:border-[#2F4030] focus:ring-1 focus:ring-[#2F4030]/40 transition-all [font-family:var(--font-jost)] text-sm";
  const labelClass = "block text-xs uppercase tracking-wider text-[#5C6B5E] mb-2 [font-family:var(--font-jost)]";

  return (
    <div className="bg-[#FBF8F2] text-[#233324] [font-family:var(--font-jost)] selection:bg-[#C9A227]/30">
      <Navbar />

      {/* Hero — cinematic, minimal chrome, single CTA, scroll cue instead of an overlapping form */}
      <section className="relative h-screen min-h-[640px] flex flex-col items-center justify-center overflow-hidden">
        <Image
          src={resorthero}
          alt="Cedar Cove Resort & Cottages — placeholder photo, replace with real property photography"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/20 to-black/60" />

        <div className="relative z-10 text-center px-6 max-w-4xl">
          <motion.span
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-block text-xs uppercase tracking-[0.35em] text-[#F0D999] mb-6"
          >
            Sreemangal, Bangladesh
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="[font-family:var(--font-cormorant)] text-6xl sm:text-7xl lg:text-8xl text-white leading-[1.02]"
          >
            Cedar Cove
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="italic [font-family:var(--font-cormorant)] text-2xl sm:text-3xl text-[#F0D999] mt-3 mb-8"
          >
            A quiet escape, by the water
          </motion.p>
          <motion.form
            onSubmit={handleQuickSearch}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="w-full max-w-2xl mx-auto bg-white/10 backdrop-blur-md border border-white/25 rounded-2xl sm:rounded-full p-2.5 sm:p-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
          >
            <div className="flex-1 flex items-center gap-2 px-3 py-2 sm:py-1.5">
              <CalendarDays className="w-4 h-4 text-white/70 flex-shrink-0" />
              <input
                type="date"
                value={quickSearch.checkIn}
                onChange={(e) => setQuickSearch({ ...quickSearch, checkIn: e.target.value })}
                className="w-full bg-transparent text-sm text-white focus:outline-none [color-scheme:dark]"
                aria-label="Check in"
              />
            </div>
            <div className="hidden sm:block w-px h-6 bg-white/20" />
            <div className="flex-1 flex items-center gap-2 px-3 py-2 sm:py-1.5">
              <CalendarDays className="w-4 h-4 text-white/70 flex-shrink-0" />
              <input
                type="date"
                value={quickSearch.checkOut}
                onChange={(e) => setQuickSearch({ ...quickSearch, checkOut: e.target.value })}
                className="w-full bg-transparent text-sm text-white focus:outline-none [color-scheme:dark]"
                aria-label="Check out"
              />
            </div>
            <div className="hidden sm:block w-px h-6 bg-white/20" />
            <select
              value={quickSearch.guests}
              onChange={(e) => setQuickSearch({ ...quickSearch, guests: e.target.value })}
              className="bg-transparent text-sm text-white px-3 py-2 sm:py-1.5 focus:outline-none [&>option]:text-[#233324]"
              aria-label="Guests"
            >
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <option key={n} value={n}>{n} guest{n > 1 ? "s" : ""}</option>
              ))}
            </select>
            <button
              type="submit"
              className="flex items-center justify-center gap-2 px-6 py-3 sm:py-2.5 bg-[#F0D999] text-[#233324] text-sm font-semibold rounded-full hover:bg-white transition-colors"
            >
              Check Availability
            </button>
          </motion.form>
        </div>

        <motion.button
          onClick={() => document.querySelector("#reasons")?.scrollIntoView({ behavior: "smooth" })}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, y: [0, 8, 0] }}
          transition={{ opacity: { delay: 0.6 }, y: { duration: 1.8, repeat: Infinity, ease: "easeInOut" } }}
          className="absolute bottom-8 z-10 w-10 h-10 rounded-full border border-white/40 flex items-center justify-center text-white"
          aria-label="Scroll to learn more"
        >
          <ArrowDown className="w-4 h-4" />
        </motion.button>
      </section>

      {/* Reasons — numbered feature strip, replaces the old text+photo "welcome" section */}
      <section id="reasons" className="relative py-20 lg:py-28 bg-[#F1EADA] scroll-mt-20">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="text-xs uppercase tracking-[0.25em] text-[#8B5E3C]">Why Cedar Cove</span>
            <h2 className="[font-family:var(--font-cormorant)] text-4xl sm:text-5xl mt-4">
              Reasons to Slow Down Here
            </h2>
          </motion.div>

          <div className="grid sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#DDD3BE]">
            {reasons.map((reason, i) => (
              <motion.div
                key={reason.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="py-10 sm:py-0 sm:px-10 first:pt-0 first:sm:pl-0 last:pb-0 last:sm:pr-0"
              >
                <span className="[font-family:var(--font-cormorant)] italic text-5xl text-[#C9A227]">
                  {reason.index}
                </span>
                <h3 className="[font-family:var(--font-cormorant)] text-2xl mt-4 mb-3">{reason.title}</h3>
                <p className="text-sm text-[#5C6B5E] leading-relaxed">{reason.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Cottages — full-width alternating editorial features, not a card grid */}
      <section id="cottages" className="relative scroll-mt-20">
        <div className="text-center pt-20 lg:pt-28 pb-4 px-6">
          <span className="text-xs uppercase tracking-[0.25em] text-[#8B5E3C]">Stay With Us</span>
          <h2 className="[font-family:var(--font-cormorant)] text-4xl sm:text-5xl mt-4">Our Cottages</h2>
        </div>

        {cottages.map((cottage, i) => {
          const reversed = i % 2 === 1;
          return (
            <div
              key={cottage.name}
              className={`grid lg:grid-cols-2 ${i > 0 ? "border-t border-[#EDE6D6]" : ""}`}
            >
              <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                className={`relative h-[380px] lg:h-[560px] ${reversed ? "lg:order-2" : ""}`}
              >
                <Image
                  src={cottage.image}
                  alt={cottage.name}
                  fill
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="object-cover"
                />
                <div className="absolute top-6 left-6 bg-white/95 rounded-full px-4 py-1.5 text-sm font-semibold text-[#233324]">
                  {cottage.price}
                  <span className="text-xs text-[#8B9A89] font-normal"> /night</span>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: reversed ? -24 : 24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className={`flex flex-col justify-center px-8 py-16 lg:px-16 ${
                  i % 2 === 0 ? "bg-[#FBF8F2]" : "bg-[#F1EADA]"
                }`}
              >
                <span className="text-xs uppercase tracking-[0.25em] text-[#8B5E3C] mb-4">{cottage.tagline}</span>
                <h3 className="[font-family:var(--font-cormorant)] text-4xl sm:text-5xl mb-5">{cottage.name}</h3>
                <p className="text-[#5C6B5E] leading-relaxed mb-6 max-w-md">{cottage.description}</p>
                <div className="flex items-center gap-5 text-xs text-[#7C8C7B] mb-8">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" /> {cottage.guests} guests
                  </span>
                  <span className="flex items-center gap-1.5">
                    <BedDouble className="w-3.5 h-3.5" /> {cottage.beds} bed{cottage.beds > 1 ? "s" : ""}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Ruler className="w-3.5 h-3.5" /> {cottage.size}
                  </span>
                </div>
                <a
                  href="#book"
                  onClick={() => setFormState((prev) => ({ ...prev, cottage: cottage.name }))}
                  className="inline-flex items-center gap-2 w-fit text-sm font-semibold text-[#233324] border-b-2 border-[#C9A227] pb-1 hover:gap-3 transition-all"
                >
                  Book This Cottage <ArrowRight className="w-4 h-4" />
                </a>
              </motion.div>
            </div>
          );
        })}
      </section>

      {/* Availability — demo calendar with sample booked/open dates, not live reservation data */}
      <section id="availability" className="relative py-20 lg:py-28 scroll-mt-20">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <span className="text-xs uppercase tracking-[0.25em] text-[#8B5E3C]">Check Availability</span>
            <h2 className="[font-family:var(--font-cormorant)] text-4xl sm:text-5xl mt-4">See What&apos;s Open</h2>
            <p className="text-[#5C6B5E] mt-4 max-w-lg mx-auto">
              Pick a date on the calendar to see which cottages are free, then book straight from here.
            </p>
          </motion.div>

          <div className="grid lg:grid-cols-5 gap-8 items-start">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="lg:col-span-3 bg-white rounded-2xl border border-[#EDE6D6] p-6 lg:p-8"
            >
              <div className="flex items-center justify-between mb-6">
                <button
                  type="button"
                  onClick={goToPrevMonth}
                  disabled={isPrevMonthDisabled}
                  className="w-9 h-9 rounded-full border border-[#DDD3BE] flex items-center justify-center hover:bg-[#F1EADA] transition-colors disabled:opacity-30 disabled:pointer-events-none"
                  aria-label="Previous month"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="[font-family:var(--font-cormorant)] text-2xl">{monthLabel}</span>
                <button
                  type="button"
                  onClick={goToNextMonth}
                  className="w-9 h-9 rounded-full border border-[#DDD3BE] flex items-center justify-center hover:bg-[#F1EADA] transition-colors"
                  aria-label="Next month"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center text-xs text-[#8B9A89] mb-2">
                {weekdayLabels.map((w) => (
                  <div key={w}>{w}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: firstWeekdayOfMonth }).map((_, i) => (
                  <div key={`blank-${i}`} />
                ))}
                {Array.from({ length: daysInViewMonth }, (_, i) => i + 1).map((day) => {
                  const dateStr = toDateStr(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day));
                  const status = getDayStatus(dateStr);
                  const isSelected = selectedDate === dateStr;
                  return (
                    <button
                      key={dateStr}
                      type="button"
                      disabled={status === "past"}
                      onClick={() => handleSelectDay(day)}
                      className={`relative aspect-square rounded-lg flex items-center justify-center text-sm transition-colors ${
                        status === "past"
                          ? "text-[#C9C2AE] cursor-not-allowed"
                          : isSelected
                          ? "bg-[#233324] text-white"
                          : "text-[#233324] hover:bg-[#F1EADA]"
                      }`}
                    >
                      {day}
                      {status !== "past" && (
                        <span
                          className={`absolute bottom-1.5 w-1.5 h-1.5 rounded-full ${
                            status === "open" ? "bg-[#4C7A50]" : status === "limited" ? "bg-[#C9A227]" : "bg-[#B5453A]"
                          } ${isSelected ? "opacity-80" : ""}`}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-5 mt-6 pt-6 border-t border-[#EDE6D6] text-xs text-[#5C6B5E]">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#4C7A50]" /> Open
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#C9A227]" /> Limited
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#B5453A]" /> Fully booked
                </span>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="lg:col-span-2 bg-[#F1EADA] rounded-2xl p-6 lg:p-8 lg:sticky lg:top-32"
            >
              {selectedDate ? (
                <>
                  <span className="text-xs uppercase tracking-[0.2em] text-[#8B5E3C]">
                    {new Date(`${selectedDate}T00:00:00`).toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                  <div className="mt-5 space-y-3">
                    {cottages.map((cottage) => {
                      const isBooked = getBookedCottages(selectedDate).some((c) => c.name === cottage.name);
                      return (
                        <div
                          key={cottage.name}
                          className="flex items-center justify-between gap-4 p-4 rounded-xl bg-white border border-[#EDE6D6]"
                        >
                          <div>
                            <p className="font-medium text-[#233324] text-sm">{cottage.name}</p>
                            <p className="text-xs text-[#8B9A89]">{cottage.price} /night</p>
                          </div>
                          {isBooked ? (
                            <span className="text-xs px-3 py-1.5 rounded-full bg-[#EDE6D6] text-[#8B9A89] flex-shrink-0">
                              Booked
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleBookFromCalendar(cottage.name)}
                              className="text-xs px-4 py-2 rounded-full bg-[#233324] text-white hover:bg-[#2F4030] transition-colors flex-shrink-0"
                            >
                              Book This
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="h-full min-h-[260px] flex flex-col items-center justify-center text-center py-6">
                  <CalendarDays className="w-8 h-8 text-[#C9A227] mb-4" />
                  <p className="text-sm text-[#5C6B5E] max-w-[220px]">
                    Pick a date on the calendar to see which cottages are free.
                  </p>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </section>

      {/* The Grounds — horizontal drag/scroll gallery, not a CSS grid */}
      <section id="grounds" className="relative py-20 lg:py-28 scroll-mt-20 overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 flex items-end justify-between mb-10">
          <div>
            <span className="text-xs uppercase tracking-[0.25em] text-[#8B5E3C]">The Grounds</span>
            <h2 className="[font-family:var(--font-cormorant)] text-4xl sm:text-5xl mt-4">Explore Cedar Cove</h2>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <button
              onClick={() => scrollGrounds(-1)}
              className="w-11 h-11 rounded-full border border-[#DDD3BE] flex items-center justify-center hover:bg-[#F1EADA] transition-colors"
              aria-label="Scroll left"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => scrollGrounds(1)}
              className="w-11 h-11 rounded-full border border-[#DDD3BE] flex items-center justify-center hover:bg-[#F1EADA] transition-colors"
              aria-label="Scroll right"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div
          ref={groundsScrollRef}
          className="flex gap-5 overflow-x-auto snap-x snap-mandatory px-6 max-w-6xl mx-auto pb-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {groundsPhotos.map((item, i) => (
            <div
              key={`${item.label}-${i}`}
              className="relative flex-shrink-0 w-[78vw] sm:w-[340px] h-[440px] rounded-2xl overflow-hidden snap-start"
            >
              <Image
                src={item.image}
                alt={item.label}
                fill
                sizes="(min-width: 640px) 340px, 78vw"
                className="object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                <span className="text-white text-sm">{item.label}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Amenities — photo + clean checklist, not an icon-card grid */}
      <section id="amenities" className="relative py-20 lg:py-28 bg-[#F1EADA] scroll-mt-20">
        <div className="max-w-6xl mx-auto px-6 grid lg:grid-cols-2 gap-14 items-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative aspect-[4/5] rounded-2xl overflow-hidden order-2 lg:order-1"
          >
            <Image
              src={cottage2Img}
              alt="Cedar Cove amenities"
              fill
              sizes="(min-width: 1024px) 45vw, 90vw"
              className="object-cover"
            />
          </motion.div>

          <div className="order-1 lg:order-2">
            <span className="text-xs uppercase tracking-[0.25em] text-[#8B5E3C]">On the Property</span>
            <h2 className="[font-family:var(--font-cormorant)] text-4xl sm:text-5xl mt-4 mb-8 leading-tight">
              Everything You Need, <span className="italic text-[#8B5E3C]">Nothing You Don&apos;t</span>
            </h2>
            <ul className="space-y-4">
              {amenityList.map((item, i) => {
                const Icon = item.icon;
                return (
                  <motion.li
                    key={item.label}
                    initial={{ opacity: 0, x: 16 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.04 }}
                    className="flex items-center gap-4 pb-4 border-b border-[#DDD3BE]/70 last:border-0"
                  >
                    <Icon className="w-4 h-4 text-[#2F4030] flex-shrink-0" />
                    <span className="text-sm text-[#233324]">{item.label}</span>
                  </motion.li>
                );
              })}
            </ul>
          </div>
        </div>
      </section>

      {/* FAQ — borderless divided list, not a stack of individual cards */}
      <section id="faq" className="relative py-20 lg:py-28 scroll-mt-20">
        <div className="max-w-3xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <span className="text-xs uppercase tracking-[0.25em] text-[#8B5E3C]">Good to Know</span>
            <h2 className="[font-family:var(--font-cormorant)] text-4xl sm:text-5xl mt-4">
              Frequently Asked Questions
            </h2>
          </motion.div>

          <div className="divide-y divide-[#EDE6D6]">
            {faqs.map((faq, i) => (
              <div key={faq.question}>
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between gap-4 py-6 text-left"
                >
                  <span className="[font-family:var(--font-cormorant)] text-xl sm:text-2xl text-[#233324]">
                    {faq.question}
                  </span>
                  <ChevronDown
                    className={`w-5 h-5 flex-shrink-0 text-[#8B5E3C] transition-transform duration-300 ${
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
                  <p className="pb-6 text-sm text-[#5C6B5E] leading-relaxed max-w-xl">{faq.answer}</p>
                </motion.div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Booking — dark, high-contrast closing moment, with the honest "newly opened" note folded in */}
      <section id="book" className="relative scroll-mt-20 py-24 lg:py-32 bg-[#1B2A1C] overflow-hidden">
        <div className="absolute inset-0 opacity-25">
          <Image
            src={cottageImg}
            alt=""
            fill
            sizes="100vw"
            className="object-cover"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-[#1B2A1C] via-[#1B2A1C]/85 to-[#1B2A1C]" />

        <div className="relative max-w-5xl mx-auto px-6 grid lg:grid-cols-5 gap-12 items-start">
          <div className="lg:col-span-2 lg:sticky lg:top-32">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 border border-[#F0D999]/30 rounded-full mb-6">
              <Leaf className="w-3.5 h-3.5 text-[#F0D999]" />
              <span className="text-xs font-medium text-[#F0D999]">Newly Opened</span>
            </div>
            <h2 className="[font-family:var(--font-cormorant)] text-4xl sm:text-5xl text-white mb-5 leading-tight">
              Reserve Your Stay
            </h2>
            <p className="text-[#B7C2B5] leading-relaxed mb-4">
              Cedar Cove has just opened its gates — we don&apos;t have guest reviews to show you
              yet, and we&apos;d rather leave this space empty than fill it with anything that
              isn&apos;t real.
            </p>
            <p className="text-[#B7C2B5] leading-relaxed">
              Tell us your dates below and we&apos;ll confirm within a day, or message us
              directly on WhatsApp.
            </p>
          </div>

          <div className="lg:col-span-3 bg-white rounded-3xl p-8">
            {isSubmitted ? (
              <div className="text-center py-10">
                <div className="w-16 h-16 rounded-full border border-[#2F4030]/30 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8 text-[#2F4030]" />
                </div>
                <h3 className="[font-family:var(--font-cormorant)] text-2xl mb-2">Request Sent!</h3>
                <p className="text-[#5C6B5E]">
                  Thank you — we&apos;ll confirm availability and get back to you shortly.
                </p>
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
                    <label htmlFor="phone" className={labelClass}>Phone *</label>
                    <input type="tel" id="phone" name="phone" required value={formState.phone} onChange={handleChange} placeholder="+880 1XXX-XXXXXX" className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor="guests" className={labelClass}>Guests</label>
                    <select id="guests" name="guests" value={formState.guests} onChange={handleChange} className={inputClass}>
                      {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                        <option key={n} value={n}>{n} guest{n > 1 ? "s" : ""}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label htmlFor="checkIn" className={labelClass}>Check In</label>
                    <input type="date" id="checkIn" name="checkIn" value={formState.checkIn} onChange={handleChange} className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor="checkOut" className={labelClass}>Check Out</label>
                    <input type="date" id="checkOut" name="checkOut" value={formState.checkOut} onChange={handleChange} className={inputClass} />
                  </div>
                </div>
                <div>
                  <label htmlFor="cottage" className={labelClass}>Preferred Cottage</label>
                  <select id="cottage" name="cottage" value={formState.cottage} onChange={handleChange} className={inputClass}>
                    <option value="">No preference</option>
                    {cottages.map((c) => (
                      <option key={c.name} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="message" className={labelClass}>Anything else?</label>
                  <textarea id="message" name="message" rows={3} value={formState.message} onChange={handleChange} placeholder="Special requests, occasion, questions..." className={`${inputClass} resize-none`} />
                </div>

                {submitError && <p className="text-sm text-red-700">{submitError}</p>}

                <motion.button
                  type="submit"
                  disabled={isSubmitting}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full flex items-center justify-center gap-3 px-8 py-4 bg-[#233324] text-white font-medium rounded-full hover:bg-[#2F4030] transition-colors disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  {isSubmitting ? "Sending..." : "Request to Book"}
                </motion.button>

                <div className="flex items-center gap-3 pt-1">
                  <div className="flex-1 h-px bg-[#EDE6D6]" />
                  <span className="text-xs text-[#8B9A89]">or</span>
                  <div className="flex-1 h-px bg-[#EDE6D6]" />
                </div>

                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-3 px-8 py-3.5 border border-[#DDD3BE] rounded-full font-medium text-[#233324] hover:bg-[#F1EADA] transition-colors"
                >
                  Message Us on WhatsApp
                </a>
              </form>
            )}
          </div>
        </div>
      </section>

      <Footer phone={contactPhone} email={email} whatsappHref={whatsappHref} />
    </div>
  );
}
