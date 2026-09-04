import Link from "next/link";
import { ArrowLeft, FileQuestion, Landmark } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/35 p-6">
      <div className="w-full max-w-lg text-center">
        <div className="mx-auto mb-8 flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <Landmark className="size-6" aria-hidden="true" />
        </div>
        <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <FileQuestion className="size-7" aria-hidden="true" />
        </div>
        <p className="font-mono text-sm font-semibold text-primary">404</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Хуудас олдсонгүй
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
          Таны нээхийг хүссэн хуудас байхгүй эсвэл өөр хаяг руу шилжсэн байна.
        </p>
        <Button asChild size="lg" className="mt-7">
          <Link href="/">
            <ArrowLeft data-icon="inline-start" aria-hidden="true" />
            Нүүр хуудас руу буцах
          </Link>
        </Button>
      </div>
    </main>
  );
}
