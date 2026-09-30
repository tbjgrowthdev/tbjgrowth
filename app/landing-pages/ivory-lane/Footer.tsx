import Link from "next/link";
import { Phone, Mail, MapPin } from "lucide-react";
import { FaInstagram, FaPinterest, FaFacebook } from "react-icons/fa";

const quickLinks = [
  { label: "Portfolio", href: "#portfolio" },
  { label: "Investment", href: "#investment" },
  { label: "Process", href: "#process" },
  { label: "About", href: "#about" },
  { label: "FAQ", href: "#faq" },
];

export default function Footer({
  phone,
  email,
  whatsappHref,
}: {
  phone: string;
  email?: string | null;
  whatsappHref: string;
}) {
  return (
    <footer className="relative bg-[#26221F] text-[#C9C2B8] pt-16 pb-8 [font-family:var(--font-work-sans)]">
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-14">
          <div className="lg:col-span-2">
            <span className="[font-family:var(--font-playfair)] italic text-3xl text-white">Ivory Lane</span>
            <p className="text-sm leading-relaxed mt-4 max-w-sm">
              Editorial, light-filled wedding photography that tells the real story of your day —
              a small number of weddings each year, given full attention.
            </p>
            <div className="flex items-center gap-3 mt-6">
              {[FaInstagram, FaPinterest, FaFacebook].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full border border-white/15 flex items-center justify-center hover:text-white hover:border-white/40 transition-colors"
                >
                  <Icon size={15} />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-xs uppercase tracking-[0.2em] text-white/50 mb-4">Explore</h4>
            <ul className="space-y-2.5">
              {quickLinks.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-sm hover:text-white transition-colors">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs uppercase tracking-[0.2em] text-white/50 mb-4">Get in Touch</h4>
            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-2.5">
                <Phone size={14} className="text-[#C1785A] flex-shrink-0" />
                <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="hover:text-white transition-colors">
                  {phone}
                </a>
              </li>
              {email && (
                <li className="flex items-center gap-2.5">
                  <Mail size={14} className="text-[#C1785A] flex-shrink-0" />
                  <a href={`mailto:${email}`} className="hover:text-white transition-colors">
                    {email}
                  </a>
                </li>
              )}
              <li className="flex items-center gap-2.5">
                <MapPin size={14} className="text-[#C1785A] flex-shrink-0" />
                <span>Available worldwide</span>
              </li>
            </ul>
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-5 text-xs uppercase tracking-[0.18em] text-white border-b border-[#C1785A] pb-1"
            >
              Message on WhatsApp
            </a>
          </div>
        </div>

        <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/40">
          <p>&copy; {new Date().getFullYear()} Ivory Lane Photography. All rights reserved.</p>
          <p>
            Site by{" "}
            <Link href="/" className="text-white/60 hover:text-white transition-colors">
              TBJ Growth Tech
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
