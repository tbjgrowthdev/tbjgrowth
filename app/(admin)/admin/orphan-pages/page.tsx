import { listOrphanPagesAction } from "@/app/(admin)/actions/orphan-pages";
import OrphanPagesListClient from "@/components/Admin/OrphanPagesListClient";

export default async function OrphanPagesPage() {
  const pages = await listOrphanPagesAction();
  return <OrphanPagesListClient pages={pages} />;
}
