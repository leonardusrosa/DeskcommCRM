import { requireAuth } from "@/lib/auth/server";
import { normalizarIdioma } from "@/lib/i18n/idiomas";
import { ProfileForm } from "./_form";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requireAuth();
  const meta = user as unknown as { full_name: string | null; avatar_url: string | null };
  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Perfil</h1>
        <p className="text-sm text-muted-foreground">
          Informações pessoais. Email só pode ser trocado em breve.
        </p>
      </header>
      <ProfileForm
        email={user.email}
        initialFullName={meta.full_name}
        initialAvatarUrl={meta.avatar_url}
        initialLocale={normalizarIdioma(user.locale)}
        initialTimezone={user.timezone || "America/Sao_Paulo"}
      />
    </div>
  );
}
