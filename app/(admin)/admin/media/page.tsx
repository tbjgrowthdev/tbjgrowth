import { getMediaAssets, getMediaFolders } from "@/app/(admin)/actions/media";
import MediaLibraryClient from "@/components/Admin/Media/MediaLibraryClient";

export default async function MediaLibraryPage() {
  const [assets, folders] = await Promise.all([getMediaAssets(), getMediaFolders()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Media Library</h1>
        <p className="text-caption">Upload, search, and manage images used across the site.</p>
      </div>

      <MediaLibraryClient initialAssets={assets} initialFolders={folders} />
    </div>
  );
}
