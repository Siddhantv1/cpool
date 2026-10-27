import { Ionicons } from "@expo/vector-icons";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import Button from "../../components/Button";
import PickerField from "../../components/PickerField";
import Screen from "../../components/Screen";
import TextField from "../../components/TextField";
import { useTheme } from "../../constants/theme";
import { addVehicle, setRole } from "../../lib/api";
import { getDraft, resetDraft } from "../../lib/onboarding";
import { getSession, updateSession } from "../../lib/session";
import { MONTHS, isPlate, normalizePlate, plateRegion, suggestModels } from "../../lib/vehicle";

const MONTH_OPTIONS = MONTHS.map((label, i) => ({ label, value: i + 1 }));
const THIS_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 30 }, (_, i) => ({ label: String(THIS_YEAR - i), value: THIS_YEAR - i }));

// Read-only list of details that came from the RC.
function DetailRows({ rows }) {
  const { colors, spacing, fontSize, radius } = useTheme();
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, overflow: "hidden" }}>
      {rows.map(([label, value], i) => (
        <View
          key={label}
          style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing.md, padding: spacing.md, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}
          accessible
          accessibilityLabel={`${label}: ${value}`}
        >
          <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>{label}</Text>
          <Text style={{ color: colors.text, fontSize: fontSize.md, fontWeight: "700", flexShrink: 1, textAlign: "right" }}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

export default function VehicleDetails() {
  const { mode } = useLocalSearchParams();
  const fromRc = mode === "rc";
  const draft = getDraft();
  const { colors, spacing, fontSize, radius } = useTheme();
  const [number, setNumber] = useState("");
  const [model, setModel] = useState("");
  const [mfgMonth, setMfgMonth] = useState(null);
  const [mfgYear, setMfgYear] = useState(null);
  const [colour, setColour] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const region = plateRegion(number);
  const suggestions = suggestModels(draft.type, model);
  const manualOk = isPlate(number) && model.trim().length >= 2 && mfgMonth && mfgYear;

  async function onSave() {
    const details = fromRc
      ? draft.vehicle
      : { number: normalizePlate(number), model: model.trim(), mfgMonth, mfgYear, colour: colour.trim() || null };
    const vehicle = { type: draft.type, seats: draft.seats, helmet: draft.helmet ?? null, ...details };
    setError("");
    setSaving(true);
    try {
      const email = getSession().email;
      await setRole(email, "host");
      await addVehicle(email, vehicle);
      const s = getSession();
      // The first vehicle becomes the default; later ones are added to the list.
      updateSession({ role: "host", vehicle: s.vehicle ?? vehicle, vehicles: [...(s.vehicles ?? []), vehicle] });
      resetDraft();
      if (router.canDismiss()) router.dismissAll();
      router.replace({ pathname: "/home", params: { added: "1" } });
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  // RC details live only in memory; if they're gone (e.g. app reloaded), read the RC again.
  if (fromRc && !draft.vehicle) return <Redirect href="/rc" />;

  if (fromRc) {
    const v = draft.vehicle;
    const rows = [
      ["Registration number", v.number],
      ["Model", v.model],
      ["Manufactured", `${MONTHS[v.mfgMonth - 1]} ${v.mfgYear}`],
      ...(v.colour ? [["Colour", v.colour]] : []),
    ];
    return (
      <Screen
        back
        step={3}
        title="Check your vehicle details"
        footer={
          <>
            <Button title="Save and continue" onPress={onSave} loading={saving} />
            <Button title="Wrong details? Retake photo" variant="link" onPress={() => router.back()} />
          </>
        }
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.successSurface, borderRadius: radius.md + 2, padding: spacing.sm + 4 }}>
          <Ionicons name="checkmark" size={18} color={colors.success} />
          <Text style={{ color: colors.success, fontSize: fontSize.sm, fontWeight: "600" }}>Read from your RC</Text>
        </View>
        {draft.rcPhoto ? (
          <Image source={{ uri: draft.rcPhoto }} style={{ height: 120, borderRadius: radius.lg }} resizeMode="cover" accessibilityLabel="Your RC photo" />
        ) : null}
        <DetailRows rows={rows} />
        <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>These come from your RC and can&apos;t be edited.</Text>
        {error ? <Text style={{ color: colors.error, fontSize: fontSize.sm }}>{error}</Text> : null}
      </Screen>
    );
  }

  return (
    <Screen
      back
      step={3}
      title="Enter your vehicle details"
      subtitle="Type them exactly as they appear on your RC."
      footer={<Button title="Save and continue" onPress={onSave} loading={saving} disabled={!manualOk} />}
    >
      <View style={{ gap: spacing.xs }}>
        <TextField
          label="Registration number (e.g. KL34B3211)"
          value={number}
          onChangeText={(t) => setNumber(t.toUpperCase())}
          autoCapitalize="characters"
          autoCorrect={false}
          autoFocus
          error={number.length >= 8 && !isPlate(number) ? "Check the number. It should look like KL34B3211 or 22BH1234AA." : ""}
        />
        {region ? <Text style={{ color: colors.success, fontSize: fontSize.sm }}>✓ {region}</Text> : null}
      </View>
      <View style={{ gap: spacing.xs }}>
        <TextField label={draft.type === "bike" ? "Model (e.g. Bajaj Pulsar 150)" : "Model (e.g. Maruti Suzuki Swift)"} value={model} onChangeText={setModel} autoCorrect={false} />
        {suggestions.length ? (
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, overflow: "hidden" }}>
            {suggestions.map((s, i) => (
              <Pressable
                key={s}
                onPress={() => setModel(s)}
                accessibilityRole="button"
                accessibilityLabel={`Use ${s}`}
                style={({ pressed }) => ({ padding: spacing.md, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border, backgroundColor: pressed ? colors.secondary : "transparent" })}
              >
                <Text style={{ color: colors.text, fontSize: fontSize.md }}>{s}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <PickerField label="Mfg. month" value={mfgMonth} options={MONTH_OPTIONS} onChange={setMfgMonth} />
        <PickerField label="Mfg. year" value={mfgYear} options={YEAR_OPTIONS} onChange={setMfgYear} />
      </View>
      <TextField label="Colour (optional, e.g. Silver)" value={colour} onChangeText={setColour} />
      {error ? <Text style={{ color: colors.error, fontSize: fontSize.sm }}>{error}</Text> : null}
    </Screen>
  );
}
