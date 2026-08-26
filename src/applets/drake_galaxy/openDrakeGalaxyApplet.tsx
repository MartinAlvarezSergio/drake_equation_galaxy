import { OpenAppletOptions, OpenedApplet } from "../../core/host";
import { DrakeGalaxyCanvas } from "./DrakeGalaxyCanvas";

export function openDrakeGalaxyApplet(options?: OpenAppletOptions): OpenedApplet {
  return {
    id: "drake-galaxy",
    title: "Drake Equation Galaxy",
    description:
      "Explore how Drake-equation factors thin a galaxy of stars from habitable (blue) to inhabited/active (green).",
    close: () => {
      options?.host?.onClose?.();
    },
    render: () => <DrakeGalaxyCanvas host={options?.host} />
  };
}
