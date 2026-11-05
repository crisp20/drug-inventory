import { motion } from "motion/react";
import { Barcode, ClipboardList, Clock, PackageCheck, ShieldCheck } from "lucide-react";
import { SignInButton } from "@/components/ui/signin.tsx";
import { useAuth } from "@/hooks/use-auth.ts";
import BrandLogo, { LOGO_URL } from "./brand-logo.tsx";

const FEATURES = [
  { icon: Barcode, text: "Find any drug by barcode, GS1 code, name or Drug ID" },
  { icon: PackageCheck, text: "Stock tracked per package form" },
  { icon: ClipboardList, text: "Every Stock In and Stock Out logged with who did it" },
];

const ease = [0.22, 1, 0.36, 1] as const;

export function SignedOutScreen() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[oklch(0.3_0.15_302)] text-white">
      {/* Sun-ray glow echoing the logo */}
      <div className="pointer-events-none absolute -right-40 -top-40 size-[640px] rounded-full bg-[radial-gradient(circle,oklch(0.88_0.17_95/0.45),transparent_65%)]" />
      <div className="pointer-events-none absolute -bottom-48 -left-32 size-[520px] rounded-full bg-[radial-gradient(circle,oklch(0.72_0.14_35/0.35),transparent_65%)]" />
      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8">
        <BrandLogo />
        <div className="grid flex-1 items-center gap-12 py-12 md:grid-cols-[1.2fr_1fr]">
          <div className="space-y-8">
            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease }}
              className="text-balance text-4xl font-extrabold leading-[1.05] tracking-tight md:text-6xl"
            >
              Every tablet, strip and box <span className="text-[oklch(0.9_0.17_95)]">accounted for.</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15, ease }}
              className="max-w-lg text-lg text-white/75"
            >
              ACP's drug inventory with Stock In and Stock Out, built for the dispensary floor.
            </motion.p>
            <motion.ul
              initial="hidden"
              animate="show"
              variants={{ show: { transition: { staggerChildren: 0.1, delayChildren: 0.3 } } }}
              className="space-y-3"
            >
              {FEATURES.map((f) => (
                <motion.li
                  key={f.text}
                  variants={{ hidden: { opacity: 0, x: -12 }, show: { opacity: 1, x: 0 } }}
                  className="flex items-center gap-3 text-white/90"
                >
                  <span className="flex size-8 items-center justify-center rounded-lg bg-white/10">
                    <f.icon className="size-4 text-[oklch(0.9_0.17_95)]" />
                  </span>
                  {f.text}
                </motion.li>
              ))}
            </motion.ul>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              <SignInButton
                size="lg"
                className="h-12 bg-[oklch(0.88_0.17_95)] px-8 text-base font-bold text-[oklch(0.25_0.1_300)] hover:bg-[oklch(0.92_0.15_95)]"
              />
            </motion.div>
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.9, rotate: -4 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 0.9, delay: 0.2, ease }}
            className="hidden justify-center md:flex"
          >
            <img
              src={LOGO_URL}
              alt=""
              className="size-80 rounded-[2.5rem] object-cover shadow-[0_40px_80px_-20px_rgba(0,0,0,0.5)] ring-1 ring-white/20"
            />
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export function AwaitingApprovalScreen({ disabled }: { disabled: boolean }) {
  const { user } = useAuth();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-6 rounded-2xl border bg-card p-8 text-center shadow-sm">
        <BrandLogo className="justify-center" />
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-accent text-accent-foreground">
          {disabled ? <ShieldCheck className="size-7" /> : <Clock className="size-7" />}
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">
            {disabled ? "Access removed" : "Waiting for approval"}
          </h1>
          <p className="text-muted-foreground">
            {disabled
              ? "Your account no longer has access. Contact an admin if this is a mistake."
              : `An admin needs to approve ${user?.profile.email ?? "your account"} before you can use the system.`}
          </p>
        </div>
        <SignInButton variant="secondary" className="w-full" />
      </div>
    </div>
  );
}
