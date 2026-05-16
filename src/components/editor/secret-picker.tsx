"use client";

import { useEffect, useState } from "react";

type SecretOption = { id: string; name: string };

type SecretPickerProps = {
  workspaceId: string;
  value: string;
  onChange(secretId: string): void;
};

export function SecretPicker({ workspaceId, value, onChange }: SecretPickerProps) {
  const [secrets, setSecrets] = useState<SecretOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/secrets?workspaceId=${encodeURIComponent(workspaceId)}`)
      .then((r) => r.json())
      .then((data: { secrets: Array<{ id: string; name: string; status: string }> }) => {
        setSecrets(data.secrets.filter((s) => s.status === "active"));
      })
      .finally(() => setLoading(false));
  }, [workspaceId]);

  if (loading) {
    return <select disabled><option>Loading...</option></select>;
  }

  return (
    <select
      onChange={(e) => onChange(e.target.value)}
      value={value}
    >
      <option value="">— select secret —</option>
      {secrets.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </select>
  );
}
