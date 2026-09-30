import Link from "next/link";
import { Phone, Mail, MapPin } from "lucide-react";
import { FaInstagram, FaTiktok, FaFacebook } from "react-icons/fa";

const quickLinks = [
  { label: "Collection", href: "#collection" },
  { label: "Technology", href: "#technology" },
  { label: "Lookbook", href: "#lookbook" },
  { label: "Reviews", href: "#testimonials" },
  { label: "Sizing", href: "#sizing" },
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
    <footer className="relative bg-[#0F1115] text-[#B7BCC4] pt-16 pb-8 [font-family:var(--font-manrope)]">
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-14">
          <div className="lg:col-span-2">
            <span className="[font-family:var(--font-anton)] text-3xl text-white tracking-wide">BOREAL</span>
            <p className="text-sm leading-relaxed mt-4 max-w-sm">
              Technical outerwear built for real cold. No filler, no fluff —
              just windproof shells and honest thermal layers, made to be worn hard.
            </p>
            <div className="flex items-center gap-3 mt-6">
              {[
                { Icon: FaInstagram, href: "#" },
                { Icon: FaTiktok, href: "#" },
                { Icon: FaFacebook, href: "#" },
              ].map(({ Icon, href }, i) => (
                <a
                  key={i}
                  href={href}
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
            <h4 className="text-xs uppercase tracking-[0.2em] text-white/50 mb-4">Contact</h4>
            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-2.5">
                <Phone size={14} className="text-[#E14A2E] flex-shrink-0" />
                <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="hover:text-white transition-colors">
                  {phone}
                </a>
              </li>
              {email && (
                <li className="flex items-center gap-2.5">
                  <Mail size={14} className="text-[#E14A2E] flex-shrink-0" />
                  <a href={`mailto:${email}`} className="hover:text-white transition-colors">
                    {email}
                  </a>
                </li>
              )}
              <li className="flex items-center gap-2.5">
                <MapPin size={14} className="text-[#E14A2E] flex-shrink-0" />
                <span>Shipping worldwide</span>
              </li>
            </ul>
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-5 text-xs font-bold uppercase tracking-[0.1em] text-white border-b border-[#E14A2E] pb-1"
            >
              Message on WhatsApp
            </a>
          </div>
        </div>

        <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/40">
          <p>&copy; {new Date().getFullYear()} Boreal Outerwear. All rights reserved.</p>
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
