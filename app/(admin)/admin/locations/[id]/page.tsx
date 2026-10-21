import { getLocation } from "@/app/(admin)/actions/locations";
import LocationForm from "@/components/Admin/LocationForm";
import { notFound } from "next/navigation";

export default async function EditLocation({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const location = await getLocation(id);

  if (!location) {
    notFound();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Edit Location: {location.name}</h1>
      <LocationForm initialData={location} />
    </div>
  );
}
