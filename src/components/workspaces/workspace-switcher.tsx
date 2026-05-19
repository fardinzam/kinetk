"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { setActiveWorkspace } from "@/app/(app)/actions";
import type { WorkspaceSummary } from "@/server/workspaces/queries";

type Props = {
  currentWorkspace: WorkspaceSummary;
  workspaces: WorkspaceSummary[];
};

export function WorkspaceSwitcher({ currentWorkspace, workspaces }: Props) {
  const router = useRouter();

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    await setActiveWorkspace(e.target.value);
    router.refresh();
  }

  return (
    <span>
      {workspaces.length > 1 ? (
        <select value={currentWorkspace.id} onChange={handleChange}>
          {workspaces.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      ) : (
        currentWorkspace.name
      )}
      {" · "}
      <Link href="/settings/members">Members</Link>
    </span>
  );
}
