declare module "pdf-parse/lib/pdf-parse.js" {
  function parsePdf(buffer: Buffer): Promise<{ text?: string }>;
  export default parsePdf;
}
