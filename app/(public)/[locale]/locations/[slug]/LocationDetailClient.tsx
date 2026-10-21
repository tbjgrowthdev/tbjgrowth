"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { MapPin, Phone, Mail, ChevronDown } from "lucide-react";

type Faq = { id: string; question: string; answer: string };

type Location = {
  name: string;
  intro?: string | null;
  streetAddress: string;
  addressLocality: string;
  addressRegion?: string | null;
  postalCode?: string | null;
  addressCountry: string;
  phone: string;
  email?: string | null;
};

export default function LocationDetailClient({
  location,
  serviceAreas,
  faqs,
}: {
  location: Location;
  serviceAreas: string[];
  faqs: Faq[];
}) {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const addressLines = [
    location.streetAddress,
    [location.addressLocality, location.addressRegion].filter(Boolean).join(", "),
    [location.postalCode, location.addressCountry].filter(Boolean).join(" "),
  ].filter(Boolean);
  const mapQuery = encodeURIComponent(addressLines.join(", "));

  return (
    <main className="relative bg-background transition-colors duration-500">
      <section className="relative pt-32 pb-16 lg:pt-40 lg:pb-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">{location.name}</h1>
          {location.intro && <p className="text-lg text-muted leading-relaxed">{location.intro}</p>}
        </div>
      </section>

      <section className="relative pb-16 lg:pb-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-card p-6 rounded-xl border border-border space-y-4">
            <h2 className="text-xl font-bold text-foreground">Contact</h2>
            <div className="flex items-start gap-3">
              <MapPin size={20} className="text-brand-orange-deep dark:text-brand-orange-light flex-shrink-0 mt-0.5" />
              <address className="text-muted not-italic">
                {addressLines.map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
              </address>
            </div>
            <div className="flex items-center gap-3">
              <Phone size={20} className="text-brand-orange-deep dark:text-brand-orange-light flex-shrink-0" />
              <a href={`tel:${location.phone}`} className="text-muted hover:text-foreground">
                {location.phone}
              </a>
            </div>
            {location.email && (
              <div className="flex items-center gap-3">
                <Mail size={20} className="text-brand-orange-deep dark:text-brand-orange-light flex-shrink-0" />
                <a href={`mailto:${location.email}`} className="text-muted hover:text-foreground">
                  {location.email}
                </a>
              </div>
            )}
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-sm font-medium text-brand-orange-deep dark:text-brand-orange-light hover:text-brand-orange"
            >
              Get directions →
            </a>
          </div>

          {serviceAreas.length > 0 && (
            <div className="bg-card p-6 rounded-xl border border-border">
              <h2 className="text-xl font-bold text-foreground mb-4">Areas We Serve</h2>
              <div className="flex flex-wrap gap-2">
                {serviceAreas.map((area) => (
                  <span key={area} className="px-3 py-1.5 text-sm rounded-full bg-background border border-border text-muted">
                    {area}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {faqs.length > 0 && (
        <section className="relative pb-16 lg:pb-20">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-8">Frequently Asked Questions</h2>
            <div className="divide-y divide-border">
              {faqs.map((faq, i) => (
                <div key={faq.id}>
                  <button type="button" onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between gap-4 py-5 text-left">
                    <span className="font-medium text-foreground">{faq.question}</span>
                    <ChevronDown
                      className={`w-5 h-5 flex-shrink-0 text-brand-orange-deep dark:text-brand-orange-light transition-transform duration-300 ${
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
                    <p className="pb-5 text-muted leading-relaxed whitespace-pre-line">{faq.answer}</p>
                  </motion.div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
