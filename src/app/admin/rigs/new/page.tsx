import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/admin/AdminUI";
import RigForm from "../RigForm";

export const dynamic = "force-dynamic";

export default async function AdminRigNewPage() {
  await requireAdmin();
  const species = await prisma.rigGuide.findMany({ select: { species: true }, distinct: ["species"], orderBy: { species: "asc" } }).catch(() => []);
  return (
    <div className="max-w-4xl">
      <PageHeader title="채비도 등록" breadcrumbs={[{ href: "/admin", label: "관리자" }, { href: "/admin/rigs", label: "채비도" }, { label: "등록" }]} />
      <RigForm speciesSuggestions={species.map((s) => s.species)} />
    </div>
  );
}
