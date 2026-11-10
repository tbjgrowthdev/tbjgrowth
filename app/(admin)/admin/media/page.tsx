import { getMediaAssets, getMediaFolders } from "@/app/(admin)/actions/media";
import MediaLibraryClient from "@/components/Admin/Media/MediaLibraryClient";
import PageTitle from "@/components/Admin/PageTitle";

export default async function MediaLibraryPage() {
  const [assets, folders] = await Promise.all([getMediaAssets(), getMediaFolders()]);

  return (
    <div className="space-y-6">
      <div>
        <PageTitle>Media Library</PageTitle>
        <p className="text-caption">Upload, search, and manage images used across the site.</p>
      </div>

      <MediaLibraryClient initialAssets={assets} initialFolders={folders} />
    </div>
  );
}
