// components/profile/tabs/BindersTab.js
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../../theme/colors";
import RecentBinders from "../ProfileRecentBinders";

export default function BindersTab({ binders = [], onOpenBinder }) {
  return binders.length ? (
    <RecentBinders binders={binders} onOpenBinder={onOpenBinder} />
  ) : (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Binders</Text>
      <Text style={styles.bodyText}>No public binders yet.</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  card:{backgroundColor:COLORS.surface,borderColor:COLORS.border,borderWidth:1,borderRadius:12,padding:12,marginTop:12},
  cardTitle:{color:COLORS.text,fontWeight:"900",marginBottom:8},
  bodyText:{color:COLORS.text},
});
