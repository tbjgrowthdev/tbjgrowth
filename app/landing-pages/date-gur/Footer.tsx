import Link from "next/link";
import { Phone, Mail, MapPin } from "lucide-react";
import { FaWhatsapp, FaFacebook, FaInstagram } from "react-icons/fa";

const quickLinks = [
  { label: "হোম", href: "#top" },
  { label: "পণ্যসমূহ", href: "#products" },
  { label: "আমাদের গল্প", href: "#story" },
  { label: "কেন নলেন", href: "#benefits" },
  { label: "সচরাচর জিজ্ঞাসা", href: "#faq" },
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
    <footer className="relative bg-[#F5E6CB] border-t border-[#E8D6B8] pt-16 pb-8 [font-family:var(--font-hind-siliguri)]">
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-14">
          <div className="lg:col-span-2">
            <span className="[font-family:var(--font-tiro-bangla)] text-3xl text-[#2B1D12]">নলেন</span>
            <p className="text-sm text-[#6B5842] leading-relaxed mt-4 max-w-sm">
              খাঁটি খেজুরের গুড়, মোলাসেস ও খেজুর চিনি — বাংলাদেশের গ্রামীণ, ঐতিহ্যবাহী গাছি
              পরিবারের হাতে সংগ্রহ করা, কোনো সংযোজন বা বিয়োজন ছাড়াই।
            </p>
            <div className="flex items-center gap-3 mt-6">
              {[FaWhatsapp, FaFacebook, FaInstagram].map((Icon, i) => (
                <a
                  key={i}
                  href={i === 0 ? whatsappHref : "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full border border-[#D9BE8E] flex items-center justify-center text-[#8A7452] hover:text-[#A6472B] hover:border-[#C6862B] transition-colors"
                >
                  <Icon size={15} />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-xs uppercase tracking-[0.15em] text-[#B8752A] mb-4">ঘুরে দেখুন</h4>
            <ul className="space-y-2.5">
              {quickLinks.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-sm text-[#6B5842] hover:text-[#2B1D12] transition-colors">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs uppercase tracking-[0.15em] text-[#B8752A] mb-4">যোগাযোগ করুন</h4>
            <ul className="space-y-3 text-sm text-[#6B5842]">
              <li className="flex items-center gap-2.5">
                <Phone size={14} className="text-[#C6862B] flex-shrink-0" />
                <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="hover:text-[#2B1D12] transition-colors">
                  {phone}
                </a>
              </li>
              {email && (
                <li className="flex items-center gap-2.5">
                  <Mail size={14} className="text-[#C6862B] flex-shrink-0" />
                  <a href={`mailto:${email}`} className="hover:text-[#2B1D12] transition-colors">
                    {email}
                  </a>
                </li>
              )}
              <li className="flex items-center gap-2.5">
                <MapPin size={14} className="text-[#C6862B] flex-shrink-0" />
                <span>বাংলাদেশ</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-[#E8D6B8] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#9C8A72]">
          <p>&copy; {new Date().getFullYear()} নলেন। সর্বস্বত্ব সংরক্ষিত।</p>
          <p>
            নির্মাণে{" "}
            <Link href="/" className="text-[#8A7452] hover:text-[#A6472B] transition-colors">
              TBJ Growth Tech
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
