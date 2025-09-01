// components/profile/tabs/AchievementsTab.js
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../../theme/colors";

export default function AchievementsTab({ items = [] }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Achievements</Text>
      {items.length ? (
        <View style={{ gap: 8 }}>
          {items.map((a, i) => (
            <View key={`${a.id || i}`} style={styles.achRow}>
              <View style={styles.badge} />
              <View style={{ flex: 1 }}>
                <Text style={styles.achTitle}>{a.title || "Badge"}</Text>
                {!!a.description && <Text style={styles.achDesc} numberOfLines={2}>{a.description}</Text>}
              </View>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.bodyText}>No achievements yet.</Text>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  card:{backgroundColor:COLORS.surface,borderColor:COLORS.border,borderWidth:1,borderRadius:12,padding:12,marginTop:12},
  cardTitle:{color:COLORS.text,fontWeight:"900",marginBottom:8},
  bodyText:{color:COLORS.text},
  achRow:{flexDirection:"row",alignItems:"center",gap:10,backgroundColor:COLORS.background,borderColor:COLORS.border,borderWidth:1,borderRadius:10,padding:10},
  badge:{width:36,height:36,borderRadius:18,backgroundColor:COLORS.alt,borderWidth:1,borderColor:COLORS.border},
  achTitle:{color:COLORS.text,fontWeight:"800"},
  achDesc:{color:COLORS.textMuted,fontSize:12},
});
