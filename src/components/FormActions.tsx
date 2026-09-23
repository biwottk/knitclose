import React from "react";
import { Keyboard, StyleSheet, View } from "react-native";
import { Button } from "./Button";
import { SaveError } from "./SaveError";
import type { IconName } from "./Icon";
import { spacing } from "../theme";

/**
 * The standard ending for every form.
 *
 * At rest it is the full, explicit footer: error (if any), primary action, then the
 * low-pressure way out. While the keyboard is open it becomes a ONE-ROW accessory:
 * "Hide keyboard" plus a short save/next button. This is the important distinction
 * between reachable and usable -- lifting the full three-row footer kept the button
 * reachable, but covered a third of the form (exactly what the device screenshot showed).
 */
export function FormActions({
  keyboardVisible, error,
  title, compactTitle = title, icon = "check", disabled, onPress,
  secondaryTitle, secondaryIcon, onSecondary,
}: {
  keyboardVisible: boolean;
  error?: unknown;
  title: string;
  compactTitle?: string;
  icon?: IconName;
  disabled?: boolean;
  onPress: () => void;
  secondaryTitle: string;
  secondaryIcon?: IconName;
  onSecondary: () => void;
}) {
  if (keyboardVisible) {
    return (
      <View style={styles.keyboardRow}>
        <Button
          title="Hide keyboard"
          accessibilityLabel="Hide keyboard and see the whole form"
          kind="quiet"
          icon="chevronDown"
          small
          onPress={() => Keyboard.dismiss()}
        />
        <Button
          title={compactTitle}
          icon={icon}
          disabled={disabled}
          small
          fill
          onPress={onPress}
        />
      </View>
    );
  }

  return (
    <>
      <SaveError error={error} />
      <Button title={title} icon={icon} disabled={disabled} onPress={onPress} />
      <Button
        title={secondaryTitle}
        kind="quiet"
        icon={secondaryIcon}
        onPress={onSecondary}
      />
    </>
  );
}

const styles = StyleSheet.create({
  keyboardRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
  },
});
