import { type PropsWithChildren, useState } from "react";
import { I18nManager, StyleSheet, TouchableOpacity } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useBrand } from "@/hooks/use-brand";

export function Collapsible({
  children,
  title,
}: PropsWithChildren & { title: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const chevronName = I18nManager.isRTL ? "chevron.left" : "chevron.right";
  const palette = useBrand();

  return (
    <ThemedView>
      <TouchableOpacity
        style={styles.heading}
        onPress={() => setIsOpen((value) => !value)}
        activeOpacity={0.8}
      >
        <IconSymbol
          name={chevronName}
          size={18}
          weight="medium"
          color={palette.textMuted}
          style={{ transform: [{ rotate: isOpen ? "90deg" : "0deg" }] }}
        />

        <ThemedText type="defaultSemiBold">{title}</ThemedText>
      </TouchableOpacity>
      {isOpen && <ThemedView style={styles.content}>{children}</ThemedView>}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  heading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  content: {
    marginTop: 6,
    marginHorizontal: 24,
  },
});
