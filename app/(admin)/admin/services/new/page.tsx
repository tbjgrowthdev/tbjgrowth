import ServiceForm from "@/components/Admin/ServiceForm";

export default function NewService() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Create New Service</h1>
      <ServiceForm />
    </div>
  );
}
