import { getPageMetadata } from "@/lib/seo-meta";
import { getSiteSettings } from "@/app/(admin)/actions/settings";
import { resolveRouteLocale } from "@/lib/i18n";

// DRAFT – needs review (owner / legal) before the Google Play submission.
// Written from what the code actually does (forms, newsletter, cookie
// consent, first-party performance metrics, admin push notifications) and the
// processors it calls. Update it whenever a new tracker or processor is
// added. An admin can override title/meta via a Page with slug "privacy-policy".
export const revalidate = 3600;

const EFFECTIVE_DATE = "19 November 2026";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: localeParam } = await params;
  const locale = resolveRouteLocale(localeParam);
  return getPageMetadata(
    "privacy-policy",
    {
      title: "Privacy Policy | TBJ Growth Tech",
      description: "How TBJ Growth Tech collects, uses and protects personal information on our website and mobile apps.",
      path: "/privacy-policy",
    },
    locale?.code
  );
}

export default async function PrivacyPolicyPage() {
  const settings = await getSiteSettings();
  const contactEmail = settings?.email || null;

  return (
    <div className="bg-background">
      <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 lg:pt-40 pb-20 prose prose-neutral dark:prose-invert prose-headings:font-bold prose-a:text-brand-orange-deep">
        <h1>Privacy Policy</h1>
        <p className="text-caption">Effective {EFFECTIVE_DATE}</p>

        <p>
          This policy explains what personal information TBJ Growth Tech (&ldquo;we&rdquo;, &ldquo;us&rdquo;) collects through
          tbjgrowthtech.com and our Android apps (&ldquo;TBJ Growth Tech&rdquo; and the staff-only &ldquo;TBJ Admin&rdquo;), why we
          collect it, and the choices you have.
        </p>

        <h2>What we collect</h2>
        <ul>
          <li>
            <strong>Contact form:</strong> your name, email, and optionally phone, company and message, so we can reply to your enquiry.
          </li>
          <li>
            <strong>Booking a call:</strong> your name, email, the time slot you chose, and optionally phone, company and a message.
          </li>
          <li>
            <strong>Newsletter:</strong> your email address and the page you signed up from. You can unsubscribe from any newsletter email.
          </li>
          <li>
            <strong>Cookie choices:</strong> your cookie preferences are stored in your own browser so we don&apos;t ask again.
          </li>
          <li>
            <strong>Site performance:</strong> anonymous page-speed measurements (which page and how fast it loaded). These are not linked to
            you and are deleted automatically after a short period.
          </li>
          <li>
            <strong>Security logs:</strong> like most websites, our servers record technical data such as IP address and browser type to keep
            the service secure and working.
          </li>
          <li>
            <strong>TBJ Admin app (staff only):</strong> if a staff member allows notifications, we store a device token for that phone so we
            can send work alerts (for example &ldquo;New lead received&rdquo;). Notifications never contain a client&apos;s personal details.
            The token is deleted when they log out.
          </li>
        </ul>

        <h2>How we use it</h2>
        <p>
          To answer enquiries, run the calls you book, send the newsletter you asked for, keep the site and apps secure, and improve
          performance. We do not sell your personal information.
        </p>

        <h2>Who processes it for us</h2>
        <p>We use trusted service providers who process data on our behalf:</p>
        <ul>
          <li>Cloudflare: website hosting and security.</li>
          <li>Neon: our database.</li>
          <li>Resend: sending emails (enquiry notifications, replies, newsletters).</li>
          <li>Cloudinary: storing and serving images.</li>
          <li>Google Firebase Cloud Messaging: delivering notifications to the TBJ Admin app.</li>
        </ul>

        <h2>How long we keep it</h2>
        <p>
          Enquiries and bookings are kept for as long as we need them to work with you and for our business records. Newsletter
          addresses are kept until you unsubscribe. Technical logs and performance data are deleted automatically on a rolling schedule.
        </p>

        <h2>Your choices and rights</h2>
        <p>
          You can ask us to access, correct or delete your personal information, or to stop contacting you.
          {contactEmail ? (
            <>
              {" "}Email us at <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
            </>
          ) : (
            " Contact us through our contact page."
          )}{" "}
          You can change your cookie choices at any time from the &ldquo;Cookie Policy&rdquo; link at the bottom of every page.
        </p>

        <h2>Children</h2>
        <p>Our services are for businesses and are not directed at children.</p>

        <h2>Changes</h2>
        <p>If we change this policy we will update this page and its effective date.</p>
      </article>
    </div>
  );
}
