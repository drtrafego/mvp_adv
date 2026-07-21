import { Scale, Mail, IdCard, ShieldCheck, LogOut, Users, FileStack } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ImportarClientes } from "@/components/importar-clientes";
import { ImportarModelos } from "@/components/importar-modelos";
import { getUsuarioAtual } from "@/lib/auth";
import { listarModelos } from "@/db/queries";
import { fazerLogout } from "@/app/login/actions";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage() {
  const [usuario, modelos] = await Promise.all([getUsuarioAtual(), listarModelos()]);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-8">
      <PageHeader
        rotulo="preferências e acesso"
        titulo="Configurações"
        descricao="Este sistema é de um único advogado. Aqui ficam seus dados de acesso e a fronteira do sistema."
      />

      <section className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="font-serif text-lg font-semibold">Titular do gabinete</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <Campo icone={<Scale className="h-4 w-4" />} rotulo="Nome" valor={usuario?.nome ?? "-"} />
          <Campo icone={<Mail className="h-4 w-4" />} rotulo="Email de acesso" valor={usuario?.email ?? "-"} />
          <Campo icone={<IdCard className="h-4 w-4" />} rotulo="OAB" valor={usuario?.oab ?? "-"} />
          <Campo
            icone={<ShieldCheck className="h-4 w-4" />}
            rotulo="Senha"
            valor="alterar pelo terminal: pnpm criar-advogado"
          />
        </dl>

        <form action={fazerLogout} className="mt-6 border-t border-border pt-5">
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-lg border bg-background px-4 py-2 text-sm font-medium transition-colors hover:border-destructive/40 hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
            Sair da conta
          </button>
        </form>
      </section>

      <section className="mt-6 rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="flex items-center gap-2 font-serif text-lg font-semibold">
          <Users className="h-5 w-5 text-indigo-brand" /> Importar clientes
        </h2>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">
          Suba uma planilha e traga sua carteira de clientes de uma vez. Quem já existe não é duplicado.
        </p>
        <ImportarClientes />
      </section>

      <section className="mt-6 rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="flex items-center gap-2 font-serif text-lg font-semibold">
          <FileStack className="h-5 w-5 text-indigo-brand" /> Banco de peças
        </h2>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">
          Suba as peças do seu escritório (inicial, contestação, recurso). O redator usa como base
          de estrutura e estilo ao montar um rascunho. As citações nunca são copiadas do modelo:
          vêm sempre verificadas em fonte oficial.
        </p>
        <ImportarModelos modelos={modelos} />
      </section>

      <section className="mt-6 rounded-xl border border-amber-brand/30 bg-amber-tint/40 p-6">
        <h2 className="font-serif text-lg font-semibold text-amber-brand">A fronteira do sistema</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          O Gabinete coleta, organiza, analisa e sugere prazos. Ele{" "}
          <strong className="text-foreground">não peticiona, não decide, não é consultoria</strong>. Leva você
          até a beira da decisão e para. Peticionar, traçar estratégia e assinar a peça é seu. A máquina
          propõe, o profissional dispõe.
        </p>
      </section>
    </div>
  );
}

function Campo({
  icone,
  rotulo,
  valor,
}: {
  icone: React.ReactNode;
  rotulo: string;
  valor: string;
}) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 font-mono text-[0.65rem] uppercase tracking-[0.15em] text-muted-foreground">
        {icone}
        {rotulo}
      </dt>
      <dd className="mt-1 font-serif text-sm">{valor}</dd>
    </div>
  );
}
