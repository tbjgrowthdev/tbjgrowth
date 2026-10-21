import { listAutomationRulesAction, listAutomationRunsAction, listSocialDraftsAction } from "@/app/(admin)/actions/automation";
import AutomationClient from "@/components/Admin/Automation/AutomationClient";

export default async function AutomationPage() {
  const [rules, runs, socialDrafts] = await Promise.all([listAutomationRulesAction(), listAutomationRunsAction(), listSocialDraftsAction()]);
  return <AutomationClient rules={rules} runs={runs} socialDrafts={socialDrafts} />;
}
