import { parseJson } from "@/lib/utils";

type MediaMeta = {
  kind?: string;
  mime?: string;
  url?: string;
  filename?: string;
};

export function MessageMedia({
  content,
  metadata,
}: {
  content: string;
  metadata?: string | null;
}) {
  const meta = parseJson<MediaMeta>(metadata, {});
  if (meta.kind !== "media") {
    return <p className="whitespace-pre-wrap">{content}</p>;
  }

  const label = meta.filename || content || "Archivo";
  return (
    <div className="space-y-2">
      {meta.url && meta.mime?.startsWith("image/") ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={meta.url} alt={label} className="max-h-56 max-w-full rounded-lg object-contain" />
      ) : null}
      {meta.url && meta.mime?.startsWith("audio/") ? (
        <audio controls src={meta.url} className="w-full max-w-[240px]" />
      ) : null}
      {meta.url && !meta.mime?.startsWith("image/") && !meta.mime?.startsWith("audio/") ? (
        <a href={meta.url} target="_blank" rel="noreferrer" className="block text-sm underline">
          {label}
        </a>
      ) : null}
      {content && !content.startsWith("📎") ? <p className="whitespace-pre-wrap">{content}</p> : null}
    </div>
  );
}
