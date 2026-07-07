import { HowItWorks } from "@/components/how-it-works";
import { CtaBanner } from "@/components/landing/cta-banner";
import { HeroSection } from "@/components/landing/hero-section";
import { PageFooter } from "@/components/landing/page-footer";
import { PageShell } from "@/components/landing/page-shell";
import { SiteHeader } from "@/components/landing/site-header";
import { REPOSITORY_URL } from "@/lib/constants";

export default function Home() {
  return (
    <>
      <SiteHeader repositoryUrl={REPOSITORY_URL} />
      <PageShell>
        <HeroSection />
        <HowItWorks />
        <CtaBanner repositoryUrl={REPOSITORY_URL} />
      </PageShell>
      <PageFooter>Em construção. Feito com 💙 por quem usa o SUS.</PageFooter>
    </>
  );
}
