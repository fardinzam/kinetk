import { SecretForm } from "@/components/secrets/secret-form";
import { SecretList } from "@/components/secrets/secret-list";
import { requireUser } from "@/server/auth/session";
import { listSecretsForWorkspace } from "@/server/secrets/service";
import { bootstrapDefaultWorkspace } from "@/server/workspaces/service";

export default async function SecretsPage() {
  const user = await requireUser();
  const workspace = await bootstrapDefaultWorkspace({
    id: user.id,
    email: user.email,
    name: user.user_metadata.name,
  });
  const secrets = await listSecretsForWorkspace({
    userId: user.id,
    workspaceId: workspace.id,
  });

  return (
    <section>
      <h1>Secrets</h1>
      <SecretForm workspaceId={workspace.id} />
      <SecretList secrets={secrets} />
    </section>
  );
}
