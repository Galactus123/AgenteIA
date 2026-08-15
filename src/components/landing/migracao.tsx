import Link from "next/link";
import { ctaUrl } from "@/lib/landing-data";

export default function Migracao() {
  return (
    <section id="migracao" className="bg-sidebar py-16 text-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold sm:text-4xl">Migração fácil</h2>
          <p className="mt-4 text-lg text-slate-300">
            Já usa outro sistema de agenda? Migramos seus dados sem custo adicional.
          </p>
          <div className="mt-8 flex flex-col items-center gap-4">
            <Link
              href={ctaUrl("migracao")}
              className="inline-flex items-center justify-center rounded-full bg-primary px-8 py-3 font-semibold text-white transition-colors hover:bg-primary-dark"
            >
              Começar agora
            </Link>
            <p className="text-sm text-slate-400">Nossa equipe acompanha a transição.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
