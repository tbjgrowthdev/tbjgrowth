import ServiceForm from "@/components/Admin/ServiceForm";
import PageTitle from "@/components/Admin/PageTitle";

export default function NewService() {
  return (
    <div>
      <PageTitle className="mb-6">Create New Service</PageTitle>
      <ServiceForm />
    </div>
  );
}
