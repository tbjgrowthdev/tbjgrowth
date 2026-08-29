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
        <h1 className="text-2xl font-bold text-foreground">My Profile</h1>
        <p className="text-caption">Manage your account details and password.</p>
      </div>
      <ProfileForm user={user} />
    </div>
  );
}
