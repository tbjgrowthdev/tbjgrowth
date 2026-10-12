import { getRedirects, getRedirectDiagnostics } from "@/app/(admin)/actions/redirects";
import RedirectsManager from "@/components/Admin/RedirectsManager";

export default async function RedirectsPage() {
  const [redirects, diagnostics] = await Promise.all([getRedirects(), getRedirectDiagnostics()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Redirects</h1>
        <p className="text-caption">Manage 301/302/307 redirects and 410 Gone responses, individually or via bulk import.</p>
      </div>
      <RedirectsManager redirects={redirects} diagnostics={diagnostics} />
    </div>
  );
}
