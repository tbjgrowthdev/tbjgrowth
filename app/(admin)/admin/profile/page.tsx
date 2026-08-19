import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/app/(admin)/actions/profile";
import ProfileForm from "@/components/Admin/ProfileForm";

export default async function ProfilePage() {
  const user = await getCurrentAdmin();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Profile</h1>
        <p className="text-gray-500 dark:text-gray-400">Manage your account details and password.</p>
      </div>
      <ProfileForm user={user} />
    </div>
  );
}
