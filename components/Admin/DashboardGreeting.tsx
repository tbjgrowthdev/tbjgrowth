"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/** Time-of-day greeting in the viewer's own timezone. Server render uses a neutral "Welcome back". */
export default function DashboardGreeting({ name }: { name: string }) {
  const hour = useSyncExternalStore(
    noopSubscribe,
    () => new Date().getHours(),
    () => -1,
  );
  const hello = hour < 0 ? "Welcome back" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return (
    <h2 className="font-heading text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl">
      {hello}, {name}!
    </h2>
  );
}
