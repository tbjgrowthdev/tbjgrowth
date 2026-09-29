import Link from "next/link";
import { Phone, Mail, MapPin } from "lucide-react";
import { FaFacebook, FaInstagram, FaWhatsapp } from "react-icons/fa";

const quickLinks = [
  { label: "Home", href: "#top" },
  { label: "Cottages", href: "#cottages" },
  { label: "Availability", href: "#availability" },
  { label: "The Grounds", href: "#grounds" },
  { label: "Amenities", href: "#amenities" },
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
    <footer className="relative bg-[#1B2A1C] text-[#E9E4D8] pt-16 pb-8 [font-family:var(--font-jost)]">
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-14">
          <div className="lg:col-span-2">
            <span className="[font-family:var(--font-cormorant)] text-3xl text-white">Cedar Cove</span>
            <p className="text-sm text-[#B7C2B5] leading-relaxed mt-4 max-w-sm">
              Private cottages tucked between forest and shoreline — a quiet place to slow down,
              built for long weekends and longer conversations.
            </p>
            <div className="flex items-center gap-3 mt-6">
              {[FaWhatsapp, FaFacebook, FaInstagram].map((Icon, i) => (
                <a
                  key={i}
                  href={i === 0 ? whatsappHref : "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full border border-white/15 flex items-center justify-center text-[#B7C2B5] hover:text-white hover:border-white/40 transition-colors"
                >
                  <Icon size={15} />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-xs uppercase tracking-[0.2em] text-[#8FA391] mb-4">Explore</h4>
            <ul className="space-y-2.5">
              {quickLinks.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-sm text-[#B7C2B5] hover:text-white transition-colors">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs uppercase tracking-[0.2em] text-[#8FA391] mb-4">Reach Us</h4>
            <ul className="space-y-3 text-sm text-[#B7C2B5]">
              <li className="flex items-center gap-2.5">
                <Phone size={14} className="text-[#C9A227] flex-shrink-0" />
                <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="hover:text-white transition-colors">
                  {phone}
                </a>
              </li>
              {email && (
                <li className="flex items-center gap-2.5">
                  <Mail size={14} className="text-[#C9A227] flex-shrink-0" />
                  <a href={`mailto:${email}`} className="hover:text-white transition-colors">
                    {email}
                  </a>
                </li>
              )}
              <li className="flex items-center gap-2.5">
                <MapPin size={14} className="text-[#C9A227] flex-shrink-0" />
                <span>Lakeside Road, Sreemangal</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#7C8C7B]">
          <p>&copy; {new Date().getFullYear()} Cedar Cove Resort &amp; Cottages. All rights reserved.</p>
          <p>
            Site by{" "}
            <Link href="/" className="text-[#8FA391] hover:text-white transition-colors">
              TBJ Growth Tech
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
