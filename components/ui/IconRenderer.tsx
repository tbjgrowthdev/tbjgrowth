import * as LucideIcons from "lucide-react";

export function getIcon(iconName: string) {
  const Icon = (LucideIcons as any)[iconName] || LucideIcons.Circle;
  return Icon;
}

export function IconRenderer({ iconName, className }: { iconName: string; className?: string }) {
  const Icon = getIcon(iconName);
  return <Icon className={className} />;
}
