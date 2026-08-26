import { useMemo } from "react";
import { AppletHostAdapter } from "../core/host";
import { DrakeGalaxyCanvas } from "../applets/drake_galaxy/DrakeGalaxyCanvas";

export function App(): JSX.Element {
  const host: AppletHostAdapter = useMemo(
    () => ({
      onClose: () => {},
      readReducedMotion: () => window.matchMedia("(prefers-reduced-motion: reduce)").matches
    }),
    []
  );

  return (
    <div className="app-shell">
      <main>
        <section className="modal card">
          <DrakeGalaxyCanvas host={host} />
        </section>
      </main>
    </div>
  );
}
