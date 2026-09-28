"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Leaf,
  Heart,
  ShieldCheck,
  Users,
  Award,
  TreePine,
  Droplets,
  Flame,
  Package,
  Sparkles as SparklesIcon,
  Send,
  CheckCircle2,
  ChevronDown,
} from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { submitContactForm } from "@/app/(admin)/actions/forms";
import Navbar from "./Navbar";
import Footer from "./Footer";
import { Sunburst, SparkleDust, DottedPath } from "./Decor";
import Image from "next/image";

const productLegend = [
  { color: "#3B2417", name: "পাটালি গুড়", note: "জমাট, ছাঁচে ঢালা" },
  { color: "#B5651D", name: "ঝোলা গুড়", note: "তরল, মধুর মতো" },
  { color: "#D9BE8E", name: "খেজুর চিনি", note: "দানাদার, রিফাইন্ড নয়" },
];

const products = [
  {
    icon: Package,
    name: "পাটালি গুড়",
    subtitle: "শক্ত খেজুর গুড়ের ব্লক",
    description:
      "তাজা জ্বাল দেওয়া খেজুরের রস থেকে ঐতিহ্যবাহী উপায়ে তৈরি শক্ত ব্লক। পিঠা, পায়েস ও সন্দেশের জন্য সেরা পছন্দ।",
    image: "/patali.jpg",
  },
  {
    icon: Droplets,
    name: "ঝোলা গুড়",
    subtitle: "তরল খেজুর মোলাসেস",
    description:
      "গভীর ক্যারামেল স্বাদের ঘন, ঢালার উপযোগী সিরাপ — পরোটা, দই কিংবা গরম চায়ে মিশিয়ে উপভোগ করুন।",
    image: "/jhola-gur.jpg",
  },
  {
    icon: SparklesIcon,
    name: "খেজুর চিনি",
    subtitle: "দানাদার খেজুর চিনি",
    description:
      "পরিশোধিত সাদা চিনির প্রাকৃতিক বিকল্প — যেকোনো রেসিপিতে সমপরিমাণে ব্যবহার করুন, কোনো প্রক্রিয়াজাতকরণ ছাড়াই।",
    image: "/khejur-chini.jpg",
  },
];

const benefits = [
  { icon: Leaf, title: "১০০% প্রাকৃতিক", description: "কোনো রাসায়নিক, ব্লিচ বা প্রিজারভেটিভ নেই — শুধু ঐতিহ্যবাহী উপায়ে জ্বাল দেওয়া খেজুরের রস।" },
  { icon: Heart, title: "প্রাকৃতিকভাবে পুষ্টিসমৃদ্ধ", description: "পরিশোধিত চিনি যা হারিয়ে ফেলে, তেমন আয়রন, পটাশিয়াম ও অ্যান্টিঅক্সিডেন্ট ধরে রাখে।" },
  { icon: ShieldCheck, title: "স্বাস্থ্যসম্মতভাবে প্যাকেটজাত", description: "স্বাদ অক্ষুণ্ণ রাখতে এবং প্রতিটি ব্যাচ নিরাপদ রাখতে উৎস থেকেই সিল করা হয়।" },
  { icon: Users, title: "কৃষকের হাতে সংগৃহীত", description: "বাংলাদেশের গ্রামীণ, বংশ পরম্পরায় চলে আসা গাছি পরিবারদের কাছ থেকে সরাসরি সংগৃহীত।" },
  { icon: TreePine, title: "একক উৎসের ফসল", description: "একটি সংক্ষিপ্ত শীতকালীন মৌসুমে সংগ্রহ করা হয়, মেশানো বা বড় আকারে উৎপাদিত নয়।" },
  { icon: Award, title: "খাঁটি ঐতিহ্য", description: "একই গুড় যা প্রজন্মের পর প্রজন্ম বাঙালি পরিবার বিশ্বাস করে এসেছে, এখন পৌঁছে যাচ্ছে আপনার দরজায়।" },
];

const process = [
  { step: "০১", icon: TreePine, time: "সন্ধ্যা", title: "গাছ কাটা", description: "দক্ষ গাছিরা প্রতি শীতের সন্ধ্যায় যত্নসহকারে খেজুর গাছের কাণ্ড কেটে রস বের করার পথ তৈরি করেন।" },
  { step: "০২", icon: Droplets, time: "সারারাত", title: "রস সংগ্রহ", description: "সারারাত মাটির হাঁড়িতে রস জমা হয়, ভোরের আগেই সংগ্রহ করা হয় যখন তা সবচেয়ে মিষ্টি থাকে।" },
  { step: "০৩", icon: Flame, time: "ভোর", title: "জ্বাল দেওয়া", description: "খোলা আগুনে ঘণ্টার পর ঘণ্টা জ্বাল দিয়ে ঘন করা হয় — কোনো শর্টকাট নেই, শুধু আগুন আর সময়।" },
  { step: "০৪", icon: Package, time: "সকাল", title: "প্যাকেজিং", description: "ব্লক আকারে ঢালা হয়, বোতলজাত করা হয় মোলাসেস হিসেবে, অথবা দানাদার চিনি তৈরি করে তাজা রাখতে প্যাক করা হয়।" },
];

const faqs = [
  { question: "কতদিন পর্যন্ত এটি তাজা থাকে?", answer: "না খোলা অবস্থায়, পাটালি গুড় ও খেজুর চিনি ঠাণ্ডা ও শুকনো স্থানে এক বছর পর্যন্ত ভালো থাকে। খোলার পর বায়ুরোধী পাত্রে রেখে ২-৩ মাসের মধ্যে ব্যবহার করুন। ঝোলা গুড় (তরল) ফ্রিজে রাখলে সবচেয়ে বেশি দিন ভালো থাকে।" },
  { question: "কীভাবে সংরক্ষণ করব?", answer: "শক্ত গুড় ও খেজুর চিনি সরাসরি সূর্যালোক ও আর্দ্রতা থেকে দূরে বায়ুরোধী পাত্রে রাখুন। তরল মোলাসেস অল্প সময়ের জন্য ঘরের তাপমাত্রায় রাখা যায়, দীর্ঘ সময়ের জন্য ফ্রিজে রাখুন — ঠাণ্ডায় ঘন হয়ে যাওয়া স্বাভাবিক।" },
  { question: "এটি কি ভেগান ও গ্লুটেনমুক্ত?", answer: "হ্যাঁ — খেজুরের গুড় সম্পূর্ণ উদ্ভিদ-ভিত্তিক, সংগ্রহ বা প্রক্রিয়াকরণে কোনো প্রাণীজ উপাদান ব্যবহার করা হয় না, এবং এটি স্বাভাবিকভাবেই গ্লুটেনমুক্ত।" },
  { question: "আপনারা কি পাইকারি অর্ডার নেন?", answer: "হ্যাঁ, আমরা মিষ্টির দোকান, রেস্তোরাঁ ও খুচরা বিক্রেতাদের জন্য বড় পরিমাণে সরবরাহ করি। হোয়াটসঅ্যাপে যোগাযোগ করুন অথবা নিচের ফর্মে আনুমানিক পরিমাণ জানান।" },
];

export default function DateGurLandingClient({
  phone,
  email,
}: {
  phone?: string | null;
  email?: string | null;
}) {
  const contactPhone = phone || "+880 1521-202204";
  const whatsappHref = `https://wa.me/${contactPhone.replace(/[^\d]/g, "")}?text=${encodeURIComponent(
    "Hi! I'd like to order some Date Palm Jaggery (Khejur Gur)."
  )}`;

  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [formState, setFormState] = useState({ name: "", phone: "", email: "", product: "", message: "" });
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

    const message =
      [formState.product ? `আগ্রহী: ${formState.product}` : null, formState.message || null]
        .filter(Boolean)
        .join("\n\n") || "কোনো অতিরিক্ত তথ্য দেওয়া হয়নি।";

    const result = await submitContactForm({
      name: formState.name,
      email: formState.email || `${formState.phone.replace(/[^\d]/g, "") || "unknown"}@no-email-provided.tbjgrowth.co.uk`,
      phone: formState.phone,
      message,
      source: "Date Gur Landing Page",
    });

    if (result.success) {
      setIsSubmitted(true);
      setFormState({ name: "", phone: "", email: "", product: "", message: "" });
    } else {
      setSubmitError("কিছু ভুল হয়েছে। অনুগ্রহ করে হোয়াটসঅ্যাপে চেষ্টা করুন, অথবা আবার চেষ্টা করুন।");
    }
    setIsSubmitting(false);
  };

  const inputClass =
    "w-full px-4 py-3.5 rounded-xl bg-[#FCF6EC] border border-[#E8D6B8] text-[#2B1D12] placeholder-[#B0A28C] focus:outline-none focus:border-[#C6862B] focus:ring-1 focus:ring-[#C6862B]/50 transition-all";
  const labelClass = "block text-sm font-medium text-[#6B5842] mb-2";

  return (
    <div className="bg-[#FCF6EC] text-[#2B1D12] [font-family:var(--font-hind-siliguri)] selection:bg-[#C6862B]/25">
      <Navbar whatsappHref={whatsappHref} />

      {/* Hero — text left, tall arched real photo right */}
      <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-28 overflow-hidden">
        <div className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8">
          <div className="grid lg:grid-cols-2 gap-14 lg:gap-16 items-center">
            {/* Left column */}
            <div className="text-left">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#D9BE8E] bg-white/70 mb-6"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#C6862B]" />
                <span className="text-xs [font-family:var(--font-hind-siliguri)] tracking-wide text-[#B8752A]">
                  ১০০% প্রাকৃতিক ও ভেজালমুক্ত
                </span>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="[font-family:var(--font-tiro-bangla)] text-5xl sm:text-6xl leading-[1.25] mb-6 text-[#2B1D12]"
              >
                প্রকৃতির{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#E3A857] via-[#C6862B] to-[#A6472B]">
                  খাঁটি মিষ্টতা
                </span>
                , আপনার ঘরে
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-lg text-[#6B5842] leading-relaxed mb-8 max-w-xl"
              >
                নলেন গুড়, পাটালি গুড়, ঝোলা গুড় এবং খেজুর চিনি — বাংলাদেশের ঐতিহ্যবাহী গাছি
                পরিবারের হাতে তৈরি, কোনো ভেজাল ছাড়াই আপনার ঘরে পৌঁছে দিচ্ছি।
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="flex flex-col sm:flex-row gap-4 mb-10"
              >
                <motion.a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="inline-flex items-center justify-center gap-3 px-8 py-4 rounded-full bg-gradient-to-r from-[#C6862B] to-[#A6472B] text-[#FCF6EC] font-semibold shadow-[0_10px_36px_rgba(166,71,43,0.28)] hover:shadow-[0_14px_44px_rgba(166,71,43,0.4)] transition-shadow"
                >
                  <FaWhatsapp className="w-5 h-5" />
                  হোয়াটসঅ্যাপে অর্ডার করুন
                </motion.a>
                <motion.a
                  href="#products"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full border border-[#D9BE8E] text-[#2B1D12] font-medium hover:bg-[#F5E6CB] transition-colors"
                >
                  পণ্য দেখুন
                </motion.a>
              </motion.div>

              {/* Product legend row */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="flex flex-wrap gap-x-8 gap-y-4 pt-6 border-t border-[#E8D6B8]"
              >
                {productLegend.map((item) => (
                  <div key={item.name} className="flex items-center gap-2.5">
                    <span
                      className="w-3.5 h-3.5 rounded-full flex-shrink-0 border border-black/10"
                      style={{ backgroundColor: item.color }}
                    />
                    <div>
                      <div className="text-sm font-semibold text-[#2B1D12]">{item.name}</div>
                      <div className="text-xs text-[#9C8A72]">{item.note}</div>
                    </div>
                  </div>
                ))}
              </motion.div>
            </div>

            {/* Right column — tall arched real photo */}
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.25, duration: 0.7 }}
              className="relative"
            >
              <div className="relative w-full h-[420px] sm:h-[520px] lg:h-[620px] rounded-t-[999px] overflow-hidden shadow-[0_30px_80px_rgba(166,71,43,0.22)] border-[6px] border-[#FCF6EC] ring-1 ring-[#E8D6B8]">
                <Image
                  src="/hero.jpg"
                  alt="নলেনের খাঁটি খেজুরের গুড়"
                  fill
                  priority
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#2B1D12]/30 via-transparent to-transparent" />
              </div>

              <motion.div
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 }}
                className="hidden sm:block absolute top-12 -right-2 lg:-right-8 max-w-[230px] bg-[#3B2417] text-[#F3ECDD] rounded-2xl p-5 shadow-xl"
              >
                <p className="font-semibold text-sm leading-snug mb-1.5">ভোরের রস, সেদিনই জ্বাল</p>
                <p className="text-xs text-[#D9BE8E] leading-relaxed">
                  গাছ থেকে নামিয়েই মাটির চুলায় জ্বাল দেওয়া হয়
                </p>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Products */}
      <section id="products" className="relative py-20 lg:py-28 bg-[#F5E6CB] scroll-mt-20">
        <div className="max-w-6xl mx-auto px-5 sm:px-8">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="text-xs uppercase tracking-[0.2em] text-[#B8752A]">আমাদের পণ্য</span>
            <h2 className="[font-family:var(--font-tiro-bangla)] text-4xl sm:text-5xl mt-4">
              আপনার পছন্দের রূপ বেছে নিন
            </h2>
            <p className="text-lg text-[#6B5842] max-w-xl mx-auto mt-4">
              একই বিশ্বস্ত ফসল, উপভোগের তিনটি উপায়।
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-7">
            {products.map((product, i) => {
              const Icon = product.icon;
              return (
                <motion.div
                  key={product.name}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="group bg-white rounded-3xl overflow-hidden border border-[#E8D6B8] hover:border-[#C6862B]/50 hover:shadow-xl transition-all duration-500"
                >
                  <div className="relative aspect-[5/4] overflow-hidden">
                    <Image
                      src={product.image}
                      alt={product.name}
                      fill
                      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                      className="object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                    <div className="absolute top-4 left-4 inline-flex p-2.5 rounded-xl bg-white/85 backdrop-blur-sm border border-[#E8D6B8]">
                      <Icon className="w-4 h-4 text-[#A6472B]" />
                    </div>
                  </div>
                  <div className="p-7">
                    <h3 className="[font-family:var(--font-tiro-bangla)] text-2xl mb-1">{product.name}</h3>
                    <p className="text-xs uppercase tracking-wider text-[#B8752A] mb-3">{product.subtitle}</p>
                    <p className="text-sm text-[#6B5842] leading-relaxed mb-5">{product.description}</p>
                    <a
                      href="#order"
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#2B1D12] hover:text-[#A6472B] transition-colors"
                    >
                      অর্ডার করুন <ChevronDown className="w-4 h-4 -rotate-90" />
                    </a>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Story / Process */}
      <section id="story" className="relative py-20 lg:py-28 scroll-mt-20 overflow-hidden">
        <SparkleDust count={14} className="opacity-50" />
        <div className="relative z-10 max-w-6xl mx-auto px-5 sm:px-8">
          <div className="grid lg:grid-cols-5 gap-14 items-start">
            <div className="lg:col-span-2 lg:sticky lg:top-28">
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
              >
                <span className="text-xs uppercase tracking-[0.2em] text-[#B8752A]">আমাদের গল্প</span>
                <h2 className="[font-family:var(--font-tiro-bangla)] text-4xl sm:text-5xl mt-4 mb-6">
                  গাছ থেকে ঘরে, একরাতেই
                </h2>
                <p className="text-[#6B5842] leading-relaxed mb-8">
                  প্রতিটি ব্যাচ একই চারটি ধাপ অনুসরণ করে — কোনো তাড়াহুড়ো নেই, কোনো যন্ত্র নেই।
                  শুধু কৃষক, আগুন আর ভোরের আগে কয়েক ঘণ্টার শীতের রাত।
                </p>
                <div className="relative aspect-[7/5] rounded-2xl overflow-hidden border border-[#E8D6B8]">
                  <Image
                    src="/collect.jpg"
                    alt="একজন গাছি খেজুর গাছ থেকে রস আহরণ করছেন"
                    fill
                    sizes="(min-width: 1024px) 40vw, 90vw"
                    className="object-cover"
                  />
                </div>
              </motion.div>
            </div>

            <div className="lg:col-span-3 space-y-3">
              {process.map((step, i) => {
                const Icon = step.icon;
                return (
                  <motion.div
                    key={step.step}
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.08 }}
                    className="relative flex gap-6 group"
                  >
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div className="w-14 h-14 rounded-2xl bg-[#F5E6CB] border border-[#E8D6B8] flex items-center justify-center group-hover:border-[#C6862B]/50 transition-colors">
                        <Icon className="w-6 h-6 text-[#A6472B]" />
                      </div>
                      {i < process.length - 1 && <DottedPath className="w-0.5 flex-1 min-h-16" />}
                    </div>
                    <div className="pb-10">
                      <div className="flex items-center gap-3 mb-1.5">
                        <span className="[font-family:var(--font-tiro-bangla)] text-lg text-[#A6472B]">
                          {step.step}
                        </span>
                        <span className="text-xs uppercase tracking-wider text-[#9C8A72]">{step.time}</span>
                      </div>
                      <h3 className="text-xl font-semibold text-[#2B1D12] mb-2">{step.title}</h3>
                      <p className="text-sm text-[#6B5842] leading-relaxed max-w-lg">{step.description}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section id="benefits" className="relative py-20 lg:py-28 bg-[#F5E6CB] scroll-mt-20">
        <div className="max-w-6xl mx-auto px-5 sm:px-8">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="text-xs uppercase tracking-[0.2em] text-[#B8752A]">কেন নলেন</span>
            <h2 className="[font-family:var(--font-tiro-bangla)] text-4xl sm:text-5xl mt-4">
              একটি পরিষ্কার ও{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#C6862B] to-[#A6472B]">
                সৎ মিষ্টতা
              </span>
            </h2>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {benefits.map((benefit, i) => {
              const Icon = benefit.icon;
              return (
                <motion.div
                  key={benefit.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-start gap-4 bg-white rounded-2xl p-6 border border-[#E8D6B8] hover:border-[#C6862B]/40 transition-colors"
                >
                  <div className="flex-shrink-0 w-11 h-11 rounded-full border border-[#D9BE8E] flex items-center justify-center">
                    <Icon className="w-5 h-5 text-[#A6472B]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[#2B1D12] mb-1.5">{benefit.title}</h3>
                    <p className="text-sm text-[#6B5842] leading-relaxed">{benefit.description}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Gallery */}
      <section className="relative py-20 lg:py-28">
        <div className="max-w-6xl mx-auto px-5 sm:px-8">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <span className="text-xs uppercase tracking-[0.2em] text-[#B8752A]">গ্যালারি</span>
            <h2 className="[font-family:var(--font-tiro-bangla)] text-4xl sm:text-5xl mt-4">
              ফসল কাটার মুহূর্তগুলো
            </h2>
          </motion.div>

          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { label: "সবুজ খেজুর বাগানে গাছি", image: "/collect2.jpg", h: "h-80 lg:h-[26rem]" },
              { label: "রস সংগ্রহের মাটির হাঁড়ি", image: "/collect1.jpg", h: "h-80 lg:h-[26rem] sm:mt-10" },
              { label: "খেজুর গাছ কাটার দৃশ্য", image: "/collect3.jpg", h: "h-80 lg:h-[26rem]" },
            ].map((item, i) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className={`relative rounded-2xl overflow-hidden border border-[#E8D6B8] ${item.h}`}
              >
                <Image
                  src={item.image}
                  alt={item.label}
                  fill
                  sizes="(min-width: 640px) 33vw, 100vw"
                  className="object-cover"
                />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Order + FAQ */}
      <section id="order" className="relative py-20 lg:py-28 bg-[#F5E6CB] scroll-mt-20">
        <div className="max-w-6xl mx-auto px-5 sm:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-white rounded-3xl border border-[#E8D6B8] p-8"
            >
              <h2 className="[font-family:var(--font-tiro-bangla)] text-3xl mb-2">অর্ডার করুন</h2>
              <p className="text-[#6B5842] mb-7">
                আপনার প্রয়োজন জানান, আমরা প্রাপ্যতা, মূল্য ও ডেলিভারি নিশ্চিত করব।
              </p>

              {isSubmitted ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-full border border-[#C6862B]/40 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-8 h-8 text-[#A6472B]" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">অনুরোধ পাঠানো হয়েছে!</h3>
                  <p className="text-[#6B5842]">
                    যোগাযোগ করার জন্য ধন্যবাদ — আপনার অর্ডার নিশ্চিত করতে আমরা শীঘ্রই যোগাযোগ করব।
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label htmlFor="name" className={labelClass}>পুরো নাম *</label>
                    <input type="text" id="name" name="name" required value={formState.name} onChange={handleChange} placeholder="আপনার নাম" className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor="phone" className={labelClass}>ফোন নম্বর *</label>
                    <input type="tel" id="phone" name="phone" required value={formState.phone} onChange={handleChange} placeholder="+৮৮০ ১XXX-XXXXXX" className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor="email" className={labelClass}>ইমেইল <span className="text-[#9C8A72] font-normal">(ঐচ্ছিক)</span></label>
                    <input type="email" id="email" name="email" value={formState.email} onChange={handleChange} placeholder="you@example.com" className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor="product" className={labelClass}>কোন পণ্য?</label>
                    <select id="product" name="product" value={formState.product} onChange={handleChange} className={inputClass}>
                      <option value="">একটি পণ্য বাছাই করুন</option>
                      <option value="পাটালি গুড় (শক্ত গুড়)">পাটালি গুড় (শক্ত গুড়)</option>
                      <option value="ঝোলা গুড় (তরল মোলাসেস)">ঝোলা গুড় (তরল মোলাসেস)</option>
                      <option value="খেজুর চিনি (দানাদার)">খেজুর চিনি (দানাদার)</option>
                      <option value="এখনো নিশ্চিত নই">এখনো নিশ্চিত নই</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="message" className={labelClass}>পরিমাণ / মন্তব্য</label>
                    <textarea id="message" name="message" rows={3} value={formState.message} onChange={handleChange} placeholder="যেমন: ২ কেজি পাটালি গুড়, ঢাকায় ডেলিভারি" className={`${inputClass} resize-none`} />
                  </div>

                  {submitError && <p className="text-sm text-[#A6472B]">{submitError}</p>}

                  <motion.button
                    type="submit"
                    disabled={isSubmitting}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full flex items-center justify-center gap-3 px-8 py-4 rounded-full bg-gradient-to-r from-[#C6862B] to-[#A6472B] text-[#FCF6EC] font-semibold shadow-[0_10px_36px_rgba(166,71,43,0.25)] disabled:opacity-50"
                  >
                    <Send className="w-5 h-5" />
                    {isSubmitting ? "পাঠানো হচ্ছে..." : "অর্ডার অনুরোধ পাঠান"}
                  </motion.button>

                  <div className="flex items-center gap-3 pt-1">
                    <div className="flex-1 h-px bg-[#E8D6B8]" />
                    <span className="text-xs text-[#9C8A72]">অথবা</span>
                    <div className="flex-1 h-px bg-[#E8D6B8]" />
                  </div>

                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-3 px-8 py-3.5 rounded-full border border-[#D9BE8E] font-semibold text-[#2B1D12] hover:bg-[#F5E6CB] transition-colors"
                  >
                    <FaWhatsapp className="w-5 h-5 text-[#25A85A]" />
                    হোয়াটসঅ্যাপে অর্ডার করুন
                  </a>
                </form>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              id="faq"
              className="scroll-mt-20"
            >
              <h2 className="[font-family:var(--font-tiro-bangla)] text-3xl mb-2">সচরাচর জিজ্ঞাসা</h2>
              <p className="text-[#6B5842] mb-7">অর্ডার করার আগে যা জানা দরকার।</p>

              <div className="space-y-3">
                {faqs.map((faq, i) => (
                  <div key={faq.question} className="bg-white rounded-2xl border border-[#E8D6B8] overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setOpenFaq(openFaq === i ? null : i)}
                      className="w-full flex items-center justify-between gap-4 p-5 text-left"
                    >
                      <span className="font-medium text-[#2B1D12]">{faq.question}</span>
                      <ChevronDown
                        className={`w-5 h-5 flex-shrink-0 text-[#A6472B] transition-transform duration-300 ${openFaq === i ? "rotate-180" : ""}`}
                      />
                    </button>
                    <motion.div
                      initial={false}
                      animate={{ height: openFaq === i ? "auto" : 0, opacity: openFaq === i ? 1 : 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <p className="px-5 pb-5 text-sm text-[#6B5842] leading-relaxed">{faq.answer}</p>
                    </motion.div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative py-24 lg:py-32 overflow-hidden">
        <SparkleDust count={20} />
        <Sunburst className="absolute -top-16 left-1/2 -translate-x-1/2 w-[26rem] h-[26rem] opacity-50" />
        <div className="relative z-10 max-w-3xl mx-auto px-5 sm:px-8 text-center">
          <Leaf className="w-9 h-9 text-[#A6472B] mx-auto mb-6" />
          <h2 className="[font-family:var(--font-tiro-bangla)] text-4xl sm:text-5xl mb-5">
            এই শীতে স্বাদের পার্থক্য অনুভব করুন
          </h2>
          <p className="text-[#6B5842] mb-9 max-w-md mx-auto">
            আজই খাঁটি খেজুরের গুড় অর্ডার করুন — কোনো রাসায়নিক নেই, কোনো শর্টকাট নেই, শুধু ঐতিহ্য।
          </p>
          <motion.a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="inline-flex items-center gap-3 px-9 py-5 rounded-full bg-gradient-to-r from-[#C6862B] to-[#A6472B] text-[#FCF6EC] font-semibold shadow-[0_10px_36px_rgba(166,71,43,0.3)]"
          >
            <FaWhatsapp className="w-5 h-5" />
            হোয়াটসঅ্যাপে অর্ডার করুন
          </motion.a>
        </div>
      </section>

      <Footer phone={contactPhone} email={email} whatsappHref={whatsappHref} />
    </div>
  );
}
