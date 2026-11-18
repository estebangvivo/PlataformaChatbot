export async function readFileAsMedia(file: File) {
  if (file.size > 6 * 1024 * 1024) {
    throw new Error("El archivo supera 6 MB");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return {
    mime: file.type || "application/octet-stream",
    filename: file.name,
    dataBase64: btoa(binary),
  };
}
