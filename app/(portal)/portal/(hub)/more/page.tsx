import { MessageCircle, Phone, CalendarClock } from "lucide-react";
import { requireClientPage } from "@/lib/portal/page-guard";
import { fill, formatDate, formatTime, portalStrings } from "@/lib/portal/strings";
import { getProfile, listMeetings, listOpenSlots, listRequests } from "@/lib/portal/data";
import { BookCallForm, DeletionRequest, LanguageSwitch, NotificationSettings, RequestForm, SignOutButton } from "@/components/Portal/MoreForms";
import { clientPushPreferences } from "@/lib/portal/push-devices";

// More: meetings (list + book a call), contact the account manager, send a
// request, notification settings, language, sign out, request account
// deletion.

function digits(phone: string): string {
  return phone.replace(/[^\d+]/g, "");
}

export default async function PortalMorePage() {
  const ctx = await requireClientPage();
  const lang = ctx.language;
  const all = portalStrings(lang);
  const t = all.more;
  const [profile, meetings, slots, requests, prefs] = await Promise.all([getProfile(ctx), listMeetings(ctx), listOpenSlots(ctx), listRequests(ctx), clientPushPreferences(ctx)]);
  const when = (d: Date | string) => fill(all.meetingAt, { date: formatDate(d, lang), time: formatTime(d, lang) });

  return (
    <div className="space-y-6">
      <h1 className="admin-title text-2xl">{t.title}</h1>

      <section className="admin-card space-y-3 p-4" aria-labelledby="meetings">
        <h2 id="meetings" className="text-lg font-bold">{t.meetings}</h2>
        {meetings.length === 0 ? (
          <p className="text-sm text-muted">{t.noMeetings}</p>
        ) : (
          <ul className="space-y-2">
            {meetings.map((m) => (
              <li key={m.id} className="flex items-center gap-3">
                <CalendarClock size={18} className="shrink-0 text-[var(--admin-orange-text)]" aria-hidden="true" />
                <span className="font-semibold">{when(m.startsAt)}</span>
                <span className="text-sm text-muted">{fill(t.minutes, { n: String(m.duration) })}</span>
              </li>
            ))}
          </ul>
        )}
        <h3 className="pt-2 font-bold">{t.bookTitle}</h3>
        <BookCallForm slots={slots.map((s) => ({ id: s.id, label: `${when(s.startsAt)} (${fill(t.minutes, { n: String(s.duration) })})` }))} t={t} />
      </section>

      <section className="admin-card space-y-3 p-4" aria-labelledby="contact">
        <h2 id="contact" className="text-lg font-bold">{t.contactTitle}</h2>
        {profile?.accountManagerName && <p className="text-sm">{fill(t.contactWith, { name: profile.accountManagerName })}</p>}
        {profile?.whatsapp || profile?.phone ? (
          <div className="grid grid-cols-2 gap-2">
            {profile.whatsapp && (
              <a href={`https://wa.me/${digits(profile.whatsapp).replace(/^\+/, "")}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-border px-4 font-semibold">
                <MessageCircle size={18} aria-hidden="true" /> {t.whatsapp}
              </a>
            )}
            {profile.phone && (
              <a href={`tel:${digits(profile.phone)}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-border px-4 font-semibold">
                <Phone size={18} aria-hidden="true" /> {t.call}
              </a>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted">{t.noContact}</p>
        )}
      </section>

      <section className="admin-card space-y-3 p-4" aria-labelledby="request">
        <h2 id="request" className="text-lg font-bold">{t.requestTitle}</h2>
        <RequestForm t={t} />
        {requests.length > 0 && (
          <>
            <h3 className="pt-2 font-bold">{t.myRequests}</h3>
            <ul className="space-y-2">
              {requests.slice(0, 10).map((r) => (
                <li key={r.id} className="text-sm">
                  <span className="font-semibold">{r.status === "DONE" ? t.requestDone : t.requestOpen}</span> · {formatDate(r.createdAt, lang)}
                  <p className="whitespace-pre-wrap break-words text-muted">{r.message}</p>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="admin-card space-y-3 p-4" aria-labelledby="notifications">
        <h2 id="notifications" className="text-lg font-bold">{t.notificationsTitle}</h2>
        <p className="text-sm text-muted">{t.notificationsBody}</p>
        <NotificationSettings preferences={prefs} labels={t.notify} />
      </section>

      <section className="admin-card space-y-3 p-4" aria-labelledby="language">
        <h2 id="language" className="text-lg font-bold">{t.languageTitle}</h2>
        <LanguageSwitch current={lang} />
      </section>

      <section className="admin-card space-y-3 p-4" aria-labelledby="account">
        <h2 id="account" className="text-lg font-bold">{t.accountTitle}</h2>
        {profile && <p className="text-sm text-muted break-all">{fill(t.signedInAs, { email: profile.email })}</p>}
        <SignOutButton label={all.signOut} />
        <h3 className="pt-2 font-bold">{t.deleteTitle}</h3>
        <DeletionRequest t={t} requestedLabel={profile?.deletionRequestedAt ? fill(t.deleteRequested, { date: formatDate(profile.deletionRequestedAt, lang) }) : null} />
      </section>
    </div>
  );
}
