// components/profile/tabs/WishlistTab.js
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../../theme/colors";
import WishlistGrid from "../WishlistGrid";

export default function WishlistTab({ items = [], onOpenCard }) {
  return items.length ? (
    <WishlistGrid items={items} onOpenCard={onOpenCard} />
  ) : (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Wishlist</Text>
      <Text style={styles.bodyText}>No wishlist items yet.</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  card:{backgroundColor:COLORS.surface,borderColor:COLORS.border,borderWidth:1,borderRadius:12,padding:12,marginTop:12},
  cardTitle:{color:COLORS.text,fontWeight:"900",marginBottom:8},
  bodyText:{color:COLORS.text},
});
