import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fonts, useTheme } from "../constants/theme";
import { useConfirmSheet } from "../lib/confirm";

// The approved "Are you sure?" bottom sheet: red icon, the question, what happens, optional reasons, Keep / red button.
export default function ConfirmSheet() {
  const [opts, close] = useConfirmSheet();
  if (!opts) return null;
  // Keyed by title so a new question starts with nothing picked.
  return <Sheet key={opts.title} opts={opts} close={close} />;
}

function Sheet({ opts, close }) {
  const { colors, rs, rf } = useTheme();
  const insets = useSafeAreaInsets();
  const [reason, setReason] = useState(null);
  const [note, setNote] = useState("");
  const other = !!opts.other && reason === opts.other;
  const ready = !opts.reasons || (reason && (!other || note.trim().length >= 3));
  const txt = (style) => [{ color: colors.text, fontFamily: fonts.regular }, style];

  function confirm() {
    if (!ready) return;
    close();
    opts.onConfirm?.(other ? note.trim() : reason);
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={{ flex: 1, backgroundColor: colors.scrim }} onPress={close} accessibilityLabel="Close" />
        <View style={{ maxHeight: "88%", backgroundColor: colors.background, borderTopLeftRadius: rs(26), borderTopRightRadius: rs(26), paddingTop: rs(10), paddingHorizontal: rs(18), paddingBottom: insets.bottom + rs(16) }}>
          <View style={{ alignSelf: "center", width: rs(38), height: rs(4), borderRadius: rs(2), backgroundColor: colors.line, marginBottom: rs(14) }} />
          <ScrollView bounces={false} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: rs(12) }}>
            <View style={{ flexDirection: opts.reasons ? "row" : "column", alignItems: opts.reasons ? "center" : "flex-start", gap: rs(12) }}>
              <View style={{ width: rs(48), height: rs(48), borderRadius: rs(24), backgroundColor: colors.dangerSurface, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name={opts.icon ?? "close"} size={rs(24)} color={colors.danger} />
              </View>
              <View style={{ flex: opts.reasons ? 1 : undefined, gap: rs(4) }}>
                <Text accessibilityRole="header" style={txt({ fontFamily: fonts.extrabold, fontSize: rf(19) })}>{opts.title}</Text>
                {opts.text ? <Text style={txt({ color: colors.textMuted, fontSize: rf(14), lineHeight: rf(20) })}>{opts.text}</Text> : null}
              </View>
            </View>

            {opts.note ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: rs(10), backgroundColor: colors.surface, borderRadius: rs(14), padding: rs(12) }}>
                <Ionicons name={opts.note.icon ?? "people-outline"} size={rs(17)} color={colors.text} />
                <Text style={txt({ flex: 1, fontSize: rf(13), lineHeight: rf(18) })}>{opts.note.text}</Text>
              </View>
            ) : null}

            {opts.reasons ? (
              <View style={{ gap: rs(8) }} accessibilityRole="radiogroup">
                {opts.reasonLabel ? <Text style={txt({ fontFamily: fonts.bold, fontSize: rf(13.5) })}>{opts.reasonLabel}</Text> : null}
                {opts.reasons.map((r) => {
                  const on = reason === r;
                  return (
                    <Pressable
                      key={r}
                      onPress={() => setReason(r)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: on }}
                      style={{ flexDirection: "row", alignItems: "center", height: rs(48), paddingHorizontal: rs(14), borderRadius: rs(14), borderWidth: 1.5, borderColor: on ? colors.ink : colors.line, backgroundColor: on ? colors.surface : colors.background }}
                    >
                      <Text style={txt({ flex: 1, fontFamily: on ? fonts.bold : fonts.medium, fontSize: rf(14.5) })}>{r}</Text>
                      <Ionicons name={on ? "radio-button-on" : "radio-button-off"} size={rs(22)} color={on ? colors.ink : colors.border} />
                    </Pressable>
                  );
                })}
                {other ? (
                  <TextInput
                    value={note}
                    onChangeText={setNote}
                    placeholder="Add a few words"
                    placeholderTextColor={colors.textMuted}
                    accessibilityLabel="Reason"
                    autoFocus
                    multiline
                    maxLength={140}
                    style={{ minHeight: rs(76), textAlignVertical: "top", backgroundColor: colors.surface, borderRadius: rs(14), padding: rs(12), color: colors.text, fontFamily: fonts.regular, fontSize: rf(14) }}
                  />
                ) : null}
              </View>
            ) : null}

            {opts.tip ? (
              <View style={{ flexDirection: "row", gap: rs(8), backgroundColor: colors.warningSurface, borderRadius: rs(14), padding: rs(12) }}>
                <Ionicons name="information-circle-outline" size={rs(17)} color={colors.warning} />
                <Text style={txt({ flex: 1, color: colors.warning, fontSize: rf(12.5), lineHeight: rf(18) })}>{opts.tip}</Text>
              </View>
            ) : null}

            <View style={{ flexDirection: "row", gap: rs(10), marginTop: rs(4) }}>
              <Pressable onPress={close} accessibilityRole="button" style={({ pressed }) => ({ flex: 1, height: rs(52), borderRadius: rs(26), backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.8 : 1 })}>
                <Text style={txt({ fontFamily: fonts.bold, fontSize: rf(15) })}>{opts.keep}</Text>
              </Pressable>
              <Pressable
                onPress={confirm}
                disabled={!ready}
                accessibilityRole="button"
                accessibilityState={{ disabled: !ready }}
                style={({ pressed }) => ({ flex: 1, height: rs(52), borderRadius: rs(26), backgroundColor: colors.danger, alignItems: "center", justifyContent: "center", opacity: !ready ? 0.4 : pressed ? 0.85 : 1 })}
              >
                <Text style={txt({ color: colors.onImage, fontFamily: fonts.bold, fontSize: rf(15) })}>{opts.confirm}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
