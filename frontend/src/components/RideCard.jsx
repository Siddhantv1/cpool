import { Pressable, Text, View } from "react-native";
import { fonts, useTheme } from "../constants/theme";
import { ampm } from "../lib/requestSeat";
import { ridePrice } from "../lib/trips";
import { Avatar } from "./RideUI";

// A ride as a small card (Home): departure time first, price, host, vehicle, "last seat".
export default function RideCard({ host, onPress }) {
  const { colors, rs, rf } = useTheme();
  const last = host.seatsFree === 1;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${host.name}, ${host.vehicle}, leaves ${host.time} ${ampm(host.time)}, ${ridePrice(host)} rupees${last ? ", last seat" : ""}`}
      style={({ pressed }) => ({ width: rs(200), borderWidth: 1, borderColor: colors.line, borderRadius: rs(18), padding: rs(14), backgroundColor: pressed ? colors.surface : colors.background })}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
        <Text style={{ color: colors.text }}>
          <Text style={{ fontFamily: fonts.extrabold, fontSize: rf(26), letterSpacing: -0.5 }}>{host.time}</Text>
          <Text style={{ fontFamily: fonts.bold, fontSize: rf(12), color: colors.textMuted }}> {ampm(host.time)}</Text>
        </Text>
        <Text style={{ fontFamily: fonts.extrabold, fontSize: rf(16), color: colors.text }}>₹{ridePrice(host)}</Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: rs(8), marginTop: rs(8) }}>
        <Avatar initials={host.initials} gender={host.gender} color={host.color} size={rs(28)} />
        <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: fonts.bold, fontSize: rf(15), color: colors.text }}>
          {host.name}
        </Text>
      </View>
      <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: rf(13), color: colors.textMuted, marginTop: rs(4) }}>
        {host.vehicle}
        {last ? <Text style={{ fontFamily: fonts.bold, color: colors.warning }}> · last seat</Text> : null}
      </Text>
    </Pressable>
  );
}
