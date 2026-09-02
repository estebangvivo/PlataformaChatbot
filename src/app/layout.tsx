import type { Metadata } from "next";
import { Figtree, Source_Serif_4 } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-source-serif",
});

export const metadata: Metadata = {
  title: "CAPC Regional 5 | Mesa de atención",
  description: "Chatbot WhatsApp, RAG y panel de derivación del Colegio de Arquitectos Regional 5.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${figtree.variable} ${sourceSerif.variable} font-sans`}>
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
