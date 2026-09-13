import { useState } from "react";
import type { Policy } from "../lib/types";
import { EMPTY_POLICY } from "./analysis";

export type Rule = { policy: Policy; origin: Policy | null; id: string | null };

export type Slot = "custom" | "picked";

export const NO_RULE: Rule = { policy: EMPTY_POLICY, origin: null, id: null };

// A hand-built rule lives in its own slot so picking a finding or card never overwrites it.
export function useRules(onSwitch: () => void) {
  const [custom, setCustom] = useState<Rule>(NO_RULE);
  const [picked, setPicked] = useState<Rule>(NO_RULE);
  const [showing, setShowing] = useState<Slot>("custom");
  const rule = showing === "custom" ? custom : picked;

  const show = (slot: Slot) => {
    if (slot === showing) return;
    setShowing(slot);
    onSwitch();
  };

  const pick = (next: Rule) => {
    setPicked(next);
    setShowing("picked");
    onSwitch();
  };

  const edit = (policy: Policy) => {
    const update = (current: Rule) => ({ ...current, policy });
    if (showing === "custom") setCustom(update);
    else setPicked(update);
  };

  const clear = () => {
    if (showing === "custom") setCustom(NO_RULE);
    else setPicked(NO_RULE);
    setShowing("custom");
    onSwitch();
  };

  const copyPicked = () => {
    setCustom({ policy: picked.policy, origin: null, id: null });
    setShowing("custom");
    onSwitch();
  };

  const reset = () => {
    setCustom(NO_RULE);
    setPicked(NO_RULE);
    setShowing("custom");
  };

  return { rule, showing, custom, picked, show, pick, edit, clear, copyPicked, reset };
}
