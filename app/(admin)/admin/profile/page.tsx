import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/app/(admin)/actions/profile";
import { getMyTwoFactorStatus, getMySessions, getMyLoginHistory } from "@/app/(admin)/actions/security";
import ProfileForm from "@/components/Admin/ProfileForm";
import SecuritySettings from "@/components/Admin/SecuritySettings";
import PageTitle from "@/components/Admin/PageTitle";

export default async function ProfilePage() {
  const user = await getCurrentAdmin();

  if (!user) {
    redirect("/login");
  }

  const [twoFactor, sessionsResult, historyResult] = await Promise.all([
    getMyTwoFactorStatus(),
    getMySessions(),
    getMyLoginHistory(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <PageTitle>My Profile</PageTitle>
        <p className="text-caption">Manage your account details and password.</p>
      </div>
      <ProfileForm user={user} />
      <SecuritySettings
        initialTwoFactorEnabled={twoFactor.enabled}
        initialSessions={sessionsResult.sessions}
        currentSessionId={sessionsResult.currentSessionId}
        initialLoginHistory={historyResult.attempts}
      />
    </div>
  );
}
