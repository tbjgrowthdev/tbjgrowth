import { getLocation } from "@/app/(admin)/actions/locations";
import LocationForm from "@/components/Admin/LocationForm";
import { notFound } from "next/navigation";
import PageTitle from "@/components/Admin/PageTitle";

export default async function EditLocation({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const location = await getLocation(id);

  if (!location) {
    notFound();
  }

  return (
    <div>
      <PageTitle className="mb-6">Edit Location: {location.name}</PageTitle>
      <LocationForm initialData={location} />
    </div>
  );
}
