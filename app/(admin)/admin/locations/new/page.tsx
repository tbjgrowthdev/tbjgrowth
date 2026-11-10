import LocationForm from "@/components/Admin/LocationForm";
import PageTitle from "@/components/Admin/PageTitle";

export default function NewLocation() {
  return (
    <div>
      <PageTitle className="mb-6">Create New Location</PageTitle>
      <LocationForm />
    </div>
  );
}
