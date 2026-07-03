import { CtaBanner } from "@/components/landing/cta-banner";
import { HeroSection } from "@/components/landing/hero-section";
import { PageFooter } from "@/components/landing/page-footer";
import { PageShell } from "@/components/landing/page-shell";
import { SiteHeader } from "@/components/landing/site-header";
import { HowItWorks } from "@/components/how-it-works";
import { REPOSITORY_URL } from "@/lib/constants";

export default function Home() {
  return (
    <PageShell>
      <SiteHeader repositoryUrl={REPOSITORY_URL} />
      <HeroSection />
      <HowItWorks />
      <CtaBanner repositoryUrl={REPOSITORY_URL} />
      <PageFooter>
        Em construção. Feito com 💙 por quem usa o SUS.
      </PageFooter>
    </PageShell>
  );
}
