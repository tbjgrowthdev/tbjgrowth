import { getRedirects } from "@/app/(admin)/actions/redirects";
import RedirectsManager from "@/components/Admin/RedirectsManager";

export default async function RedirectsPage() {
  const redirects = await getRedirects();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Redirects</h1>
        <p className="text-caption">Manage 301/302 redirects, individually or via bulk import.</p>
      </div>
      <RedirectsManager redirects={redirects} />
    </div>
  );
}
