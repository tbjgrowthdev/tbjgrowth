"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Calendar,
  Clock,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { getAvailableSlots, createBooking } from "@/app/(admin)/actions/booking";

type Slot = {
  id: string;
  startsAt: Date;
  duration: number;
};

function groupByDate(slots: Slot[]) {
  const groups = new Map<string, Slot[]>();
  for (const slot of slots) {
    const key = new Date(slot.startsAt).toDateString();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(slot);
  }
  return Array.from(groups.entries()).map(([key, items]) => ({
    dateKey: key,
    date: new Date(items[0].startsAt),
    slots: items,
  }));
}

export default function BookACallClient() {
  const [loading, setLoading] = useState(true);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  const [formState, setFormState] = useState({ name: "", email: "", phone: "", company: "", message: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isBooked, setIsBooked] = useState(false);

  useEffect(() => {
    getAvailableSlots()
      .then((data) => {
        setSlots(data as unknown as Slot[]);
        const groups = groupByDate(data as unknown as Slot[]);
        if (groups.length > 0) setSelectedDateKey(groups[0].dateKey);
      })
      .finally(() => setLoading(false));
  }, []);

  const dateGroups = groupByDate(slots);
  const activeGroup = dateGroups.find((g) => g.dateKey === selectedDateKey);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormState({ ...formState, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) return;
    setIsSubmitting(true);
    setSubmitError(null);

    const result = await createBooking({
      slotId: selectedSlot.id,
      name: formState.name,
      email: formState.email,
      phone: formState.phone || undefined,
      company: formState.company || undefined,
      message: formState.message || undefined,
    });

    if (result.success) {
      setIsBooked(true);
    } else {
      setSubmitError(result.error || "Something went wrong. Please try again.");
      // The slot may have been taken by someone else — refresh the list.
      if (result.error?.includes("no longer") || result.error?.includes("just booked")) {
        setSelectedSlot(null);
        getAvailableSlots().then((data) => setSlots(data as unknown as Slot[]));
      }
    }
    setIsSubmitting(false);
  };

  return (
    <main className="relative bg-background transition-colors duration-500 min-h-screen">
      {/* Hero */}
      <section className="relative pt-32 lg:pt-40 pb-12 lg:pb-16 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)]" />
          <motion.div
            animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 8, repeat: Infinity }}
            className="absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl bg-brand-orange/10"
          />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-tint border border-brand-orange/20 rounded-full mb-6"
          >
            <Sparkles className="w-4 h-4 text-brand-orange-deep dark:text-brand-orange-light" />
            <span className="text-sm font-medium text-brand-orange-deep dark:text-brand-orange-light">Book a Conversation</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground mb-4 tracking-tight"
          >
            Let&apos;s Find a{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-orange-deep to-brand-orange">
              Time
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-muted max-w-xl mx-auto"
          >
            Pick a slot below for a free, no-obligation growth strategy call.
          </motion.p>
        </div>
      </section>

      {/* Booking Panel */}
      <section className="relative pb-24 lg:pb-32">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="bg-card rounded-3xl border border-border shadow-xl p-6 sm:p-10"
          >
            {isBooked && selectedSlot ? (
              <div className="text-center py-10">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-2">You&apos;re Booked!</h3>
                <p className="text-muted mb-1">
                  {new Date(selectedSlot.startsAt).toLocaleDateString("en-GB", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
                <p className="text-muted mb-6">
                  {new Date(selectedSlot.startsAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                  {" · "}
                  {selectedSlot.duration} min
                </p>
                <p className="text-sm text-caption max-w-sm mx-auto">
                  We&apos;ve sent a confirmation to {formState.email}. We&apos;ll be in touch shortly before the call.
                </p>
              </div>
            ) : loading ? (
              <div className="flex items-center justify-center gap-3 py-16 text-muted">
                <Loader2 className="w-5 h-5 animate-spin" />
                Loading available times...
              </div>
            ) : dateGroups.length === 0 ? (
              <div className="text-center py-16">
                <Calendar className="w-10 h-10 text-muted mx-auto mb-4" />
                <h3 className="text-xl font-bold text-foreground mb-2">No Slots Available Right Now</h3>
                <p className="text-muted mb-6 max-w-sm mx-auto">
                  We don&apos;t have any open times at the moment. Reach out directly and we&apos;ll find a time that works.
                </p>
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-brand-orange-deep to-brand-orange text-white font-semibold rounded-xl shadow-lg shadow-brand-orange/25"
                >
                  Contact Us <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ) : !selectedSlot ? (
              <div>
                {/* Date tabs */}
                <div className="flex gap-2 overflow-x-auto pb-3 mb-6 border-b border-border">
                  {dateGroups.map((group) => (
                    <button
                      key={group.dateKey}
                      onClick={() => setSelectedDateKey(group.dateKey)}
                      className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                        selectedDateKey === group.dateKey
                          ? "bg-gradient-to-r from-brand-orange-deep to-brand-orange text-white"
                          : "bg-background text-muted hover:text-foreground"
                      }`}
                    >
                      {group.date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                    </button>
                  ))}
                </div>

                {/* Time slots */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {activeGroup?.slots.map((slot) => (
                    <button
                      key={slot.id}
                      onClick={() => setSelectedSlot(slot)}
                      className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-border bg-background text-foreground font-medium hover:border-accent-border hover:bg-tint hover:text-brand-orange-deep dark:hover:text-brand-orange-light transition-all"
                    >
                      <Clock className="w-4 h-4" />
                      {new Date(slot.startsAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <button
                  onClick={() => setSelectedSlot(null)}
                  className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground mb-6 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" /> Choose a different time
                </button>

                <div className="flex items-center gap-3 p-4 rounded-xl bg-tint border border-brand-orange/20 mb-8">
                  <Calendar className="w-5 h-5 text-brand-orange-deep dark:text-brand-orange-light flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-semibold text-foreground">
                      {new Date(selectedSlot.startsAt).toLocaleDateString("en-GB", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      })}
                    </p>
                    <p className="text-muted">
                      {new Date(selectedSlot.startsAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                      {" · "}
                      {selectedSlot.duration} min
                    </p>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid sm:grid-cols-2 gap-5">
                    <div>
                      <label htmlFor="name" className="block text-sm font-semibold text-foreground mb-2">Full Name *</label>
                      <input
                        type="text" id="name" name="name" required
                        value={formState.name} onChange={handleChange}
                        placeholder="John Smith"
                        className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-transparent transition-all"
                      />
                    </div>
                    <div>
                      <label htmlFor="email" className="block text-sm font-semibold text-foreground mb-2">Email Address *</label>
                      <input
                        type="email" id="email" name="email" required
                        value={formState.email} onChange={handleChange}
                        placeholder="john@company.com"
                        className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-transparent transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-5">
                    <div>
                      <label htmlFor="phone" className="block text-sm font-semibold text-foreground mb-2">Phone</label>
                      <input
                        type="tel" id="phone" name="phone"
                        value={formState.phone} onChange={handleChange}
                        placeholder="+44 7000 000000"
                        className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-transparent transition-all"
                      />
                    </div>
                    <div>
                      <label htmlFor="company" className="block text-sm font-semibold text-foreground mb-2">Company</label>
                      <input
                        type="text" id="company" name="company"
                        value={formState.company} onChange={handleChange}
                        placeholder="Your Company Ltd"
                        className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-transparent transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="message" className="block text-sm font-semibold text-foreground mb-2">Anything you&apos;d like us to know?</label>
                    <textarea
                      id="message" name="message" rows={4}
                      value={formState.message} onChange={handleChange}
                      placeholder="Tell us a bit about your goals..."
                      className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-transparent transition-all resize-none"
                    />
                  </div>

                  {submitError && <p className="text-sm text-red-600 dark:text-red-400">{submitError}</p>}

                  <motion.button
                    type="submit"
                    disabled={isSubmitting}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-r from-brand-orange-deep to-brand-orange text-white font-bold rounded-2xl shadow-xl shadow-brand-orange/25 hover:shadow-2xl hover:shadow-brand-orange/40 transition-shadow disabled:opacity-50"
                  >
                    <Calendar className="w-5 h-5" />
                    {isSubmitting ? "Booking..." : "Confirm Booking"}
                  </motion.button>
                </form>
              </div>
            )}
          </motion.div>
        </div>
      </section>
    </main>
  );
}
