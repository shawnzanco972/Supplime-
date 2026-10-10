import { Screen } from "@/components/ui/screen";
import { useNav } from "@/lib/nav";

/** The privacy policy, bundled with the app so it works offline. */
export function PrivacyScreen({ onClose }: { onClose?: () => void }) {
  const close = useNav((s) => s.close);
  return (
    <Screen onClose={onClose ?? close} title="Privacy policy">
      <iframe
        title="Supplime privacy policy"
        src={`${import.meta.env.BASE_URL}privacypolicy.html`}
        className="h-[calc(100dvh-9rem)] w-full rounded-2xl border-0 bg-card"
      />
    </Screen>
  );
}
