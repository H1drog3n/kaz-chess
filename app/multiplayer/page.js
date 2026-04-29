import { Suspense } from "react";
import { MultiplayerGameClient } from "../../components/game/MultiplayerGameClient";

export const metadata = {
  title: "Multiplayer — KAZ CHESS",
};

export default function MultiplayerPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-zinc-500">Loading…</div>}>
      <MultiplayerGameClient />
    </Suspense>
  );
}

