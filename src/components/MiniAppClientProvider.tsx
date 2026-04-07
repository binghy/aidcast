"use client";

import { useEffect } from "react";
import { MiniAppProvider, useMiniApp } from "@neynar/react";

function ReadyHandler({ children }: { children: React.ReactNode }) {
  const { actions } = useMiniApp();

  useEffect(() => {
    actions?.ready?.().catch((err: unknown) => {
      console.error("Mini app ready failed:", err);
    });
  }, [actions]);

  return <>{children}</>;
}

export default function MiniAppClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MiniAppProvider>
      <ReadyHandler>{children}</ReadyHandler>
    </MiniAppProvider>
  );
}