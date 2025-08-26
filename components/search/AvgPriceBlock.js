// components/search/AvgPriceBlock.js

import { COLORS } from "../../theme/colors";

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { calcAverage } from "../../utils/cards";

export default function AvgPriceBlock({ tcgp, cmkt }) {
  const avg = calcAverage(tcgp, cmkt);
  return (
    <View style={styles.avgPill}>
      <Text style={styles.avgLabel}>AVG</Text>
      <Text style={styles.avgValue}>
        {avg != null ? `£${avg.toFixed(2)}` : "—"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avgPill: {
    width: "100%",
    height: 38,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: COLORS.alt,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  avgLabel: {
    color: COLORS.accentLight,
    fontSize: 12,
    fontWeight: "800",
  },
  avgValue: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
});
