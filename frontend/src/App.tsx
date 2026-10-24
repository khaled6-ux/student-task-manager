import { useI18n } from "./i18n/useI18n";
import { Workspace as DemoWorkspace } from "./app/Workspace";
import { ConnectedWorkspace } from "./app/ConnectedWorkspace";
import { AuthProvider, ProtectedRoute } from "./features/auth/AuthProvider";

export default function App() {
  const { t } = useI18n();
  if (import.meta.env.VITE_DEMO_MODE === "true") {
    if (!import.meta.env.DEV)
      return (
        <main>
          <h1>{t("Configuration error")}</h1>
          <p>{t("Demo mode is only available in development.")}</p>
        </main>
      );
    return (
      <>
        <p className="preview-notice">
          {t("Explicit development demo — no account or saved data.")}
        </p>
        <DemoWorkspace />
      </>
    );
  }
  return (
    <AuthProvider>
      <ProtectedRoute>
        <ConnectedWorkspace />
      </ProtectedRoute>
    </AuthProvider>
  );
}
