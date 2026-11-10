import SystemForm from "@/components/Admin/SystemForm";
import PageTitle from "@/components/Admin/PageTitle";

export default function NewSystem() {
  return (
    <div>
      <PageTitle className="mb-6">Create New System</PageTitle>
      <SystemForm />
    </div>
  );
}
