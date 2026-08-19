import { getRedirects } from "@/app/(admin)/actions/redirects";
import RedirectsManager from "@/components/Admin/RedirectsManager";

export default async function RedirectsPage() {
  const redirects = await getRedirects();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Redirects</h1>
        <p className="text-gray-500 dark:text-gray-400">Manage 301/302 redirects, individually or via bulk import.</p>
      </div>
      <RedirectsManager redirects={redirects} />
    </div>
  );
}
