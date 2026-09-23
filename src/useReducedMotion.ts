import * as React from "react";
import { AccessibilityInfo } from "react-native";

/** Live iOS Reduce Motion / Android Remove animations preference. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduced(value);
    }).catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => { mounted = false; sub.remove(); };
  }, []);
  return reduced;
}
