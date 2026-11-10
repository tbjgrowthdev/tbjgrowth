import { getRedirects, getRedirectDiagnostics } from "@/app/(admin)/actions/redirects";
import RedirectsManager from "@/components/Admin/RedirectsManager";
import PageTitle from "@/components/Admin/PageTitle";

export default async function RedirectsPage() {
  const [redirects, diagnostics] = await Promise.all([getRedirects(), getRedirectDiagnostics()]);

  return (
    <div className="space-y-6">
      <div>
        <PageTitle>Redirects</PageTitle>
        <p className="text-caption">Manage 301/302/307 redirects and 410 Gone responses, individually or via bulk import.</p>
      </div>
      <RedirectsManager redirects={redirects} diagnostics={diagnostics} />
    </div>
  );
}
