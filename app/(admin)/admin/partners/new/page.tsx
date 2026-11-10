import PartnerForm from "@/components/Admin/PartnerForm";
import PageTitle from "@/components/Admin/PageTitle";

export default function NewPartner() {
  return (
    <div>
      <PageTitle className="mb-6">Create New Partner</PageTitle>
      <PartnerForm />
    </div>
  );
}
