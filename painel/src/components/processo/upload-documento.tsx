"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload, Loader2 } from "lucide-react";
import { upload } from "@vercel/blob/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  CATEGORIAS,
  MIMES,
  TAMANHO_MAX_PAINEL,
  formatoDeExtensao,
  montarStoragePath,
} from "@/lib/documentos";
import {
  verificarHashAction,
  registrarDocumentoAction,
} from "@/app/(app)/p/[id]/documentos/actions";

/** SHA-256 no browser: identifica o arquivo antes de gastar upload com algo já anexado. */
async function hashArquivo(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Upload de documento. O alvo é o processo (caso em curso) OU a peça (caso novo: a petição
 * inicial ainda não tem número de processo, mas já tem contrato e comprovante para juntar).
 */
export function UploadDocumento({
  processoId,
  numeroCnj,
  pecaId,
}: {
  processoId?: string;
  numeroCnj?: string;
  pecaId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [categoria, setCategoria] = useState<string>("outro");
  const [titulo, setTitulo] = useState("");
  const [dataDocumento, setDataDocumento] = useState("");
  const [descricao, setDescricao] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [, startTransition] = useTransition();

  function escolher(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setArquivo(f);
    if (f && !titulo) setTitulo(f.name.replace(/\.[^.]+$/, ""));
  }

  function limpar() {
    setArquivo(null);
    setTitulo("");
    setDescricao("");
    setDataDocumento("");
    setCategoria("outro");
  }

  async function enviar() {
    if (!arquivo) {
      toast.error("Escolha um arquivo.");
      return;
    }
    const extensao = (arquivo.name.match(/\.[^.]+$/)?.[0] ?? "").toLowerCase();
    const mime = MIMES[extensao];
    if (!mime) {
      toast.error(`Tipo não aceito (${extensao || "sem extensão"}).`);
      return;
    }
    if (arquivo.size > TAMANHO_MAX_PAINEL) {
      toast.error(`Arquivo maior que ${TAMANHO_MAX_PAINEL / 1048576} MB.`);
      return;
    }

    setEnviando(true);
    try {
      const hash = await hashArquivo(arquivo);

      const dup = await verificarHashAction({ processoId, pecaId }, hash);
      if (dup.ok && dup.existente) {
        toast.error(
          `Este arquivo já está anexado aqui: "${dup.existente.titulo}" (${dup.existente.categoria}).`,
        );
        setEnviando(false);
        return;
      }

      const tituloFinal = titulo.trim() || arquivo.name.replace(/\.[^.]+$/, "");
      const storagePath = montarStoragePath({
        numeroCnj,
        pecaId,
        categoria,
        titulo: tituloFinal,
        hashSha256: hash,
        extensao,
        data: dataDocumento || undefined,
      });

      // Os bytes vão direto do browser para o Blob: função serverless tem teto de 4,5 MB.
      // access private: o arquivo pode estar em segredo de justiça, então a leitura só passa
      // pela rota autenticada do painel, nunca por URL solta.
      await upload(storagePath, arquivo, {
        access: "private",
        handleUploadUrl: "/api/documentos/upload",
        contentType: mime,
        // Autos e fotos passam de dezenas de MB: parte em pedaços, sobe em paralelo e refaz
        // só o pedaço que falhar, em vez de perder o upload inteiro numa oscilação de rede.
        multipart: arquivo.size > 10 * 1024 * 1024,
        clientPayload: JSON.stringify({
          processoId,
          pecaId,
          categoria,
          titulo: tituloFinal,
          hash,
        }),
      });

      const reg = await registrarDocumentoAction({
        processoId,
        pecaId,
        titulo: tituloFinal,
        categoria,
        storagePath,
        arquivoNome: arquivo.name,
        mimeType: mime,
        tamanhoBytes: arquivo.size,
        hashSha256: hash,
        tipo: formatoDeExtensao(extensao),
        descricao,
        dataDocumento,
      });
      if (!reg.ok) {
        toast.error(reg.erro ?? "Falha ao registrar o documento.");
        setEnviando(false);
        return;
      }

      toast.success("Documento anexado. Extraindo o texto...");
      setOpen(false);
      limpar();
      router.refresh();

      // Extração em segundo plano: o documento já aparece na lista enquanto isso.
      startTransition(async () => {
        const r = await fetch(`/api/documentos/${reg.id}/extrair`, { method: "POST" });
        const j = await r.json().catch(() => null);
        if (j?.status === "ok") toast.success(`Texto extraído (${j.paginas ?? "?"} página(s)).`);
        else if (j?.status === "sem_texto")
          toast.warning("PDF sem camada de texto (digitalizado). Precisa de OCR para analisar.");
        else if (j?.status === "falhou") toast.error("Não foi possível extrair o texto.");
        router.refresh();
      });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <Upload /> Enviar
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-serif">
            {pecaId && !processoId ? "Anexar documento ao caso" : "Anexar documento ao processo"}
          </DialogTitle>
          <DialogDescription>
            {pecaId && !processoId
              ? "O caso ainda não tem número de processo, então o arquivo fica guardado com a peça. Se for PDF com texto, o squad consegue ler o conteúdo ao montar a inicial."
              : "O arquivo fica guardado com o processo. Se for PDF com texto, o conteúdo passa a ser legível pelo squad na análise."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">Arquivo</label>
            <Input type="file" accept={Object.keys(MIMES).join(",")} onChange={escolher} />
            {arquivo && (
              <p className="text-xs text-muted-foreground">
                {arquivo.name} · {(arquivo.size / 1024).toFixed(0)} KB
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">Tipo de peça</label>
            <Select
              value={categoria}
              onValueChange={(v) => setCategoria(v as string)}
              items={CATEGORIAS.map((c) => ({ value: c.valor, label: c.rotulo }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIAS.map((c) => (
                  <SelectItem key={c.valor} value={c.valor}>
                    {c.rotulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">Título</label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">Data do documento (opcional)</label>
            <Input
              type="date"
              value={dataDocumento}
              onChange={(e) => setDataDocumento(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">Observação (opcional)</label>
            <Textarea
              rows={2}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex.: juntada na audiência do dia 10"
            />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={enviar} disabled={enviando || !arquivo}>
            {enviando ? <Loader2 className="animate-spin" /> : <Upload />}
            {enviando ? "Enviando..." : "Anexar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
