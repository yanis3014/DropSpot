import BottomNav from "@/components/layout/BottomNav";
import SplashScreen from "@/components/SplashScreen";
import IosInstallPrompt from "@/components/pwa/IosInstallPrompt";
import AndroidInstallPrompt from "@/components/pwa/AndroidInstallPrompt";

/** B2C shell: max-w-md, BottomNav, splash & PWA prompts. `(client)` is omitted from URLs. */
export default function ClientLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <div className="max-w-md mx-auto w-full min-h-full flex flex-col bg-ds-bg">
        {children}
        <BottomNav />
      </div>
      <IosInstallPrompt />
      <AndroidInstallPrompt />
      <SplashScreen />
    </>
  );
}
