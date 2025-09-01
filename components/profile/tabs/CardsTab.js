// components/profile/tabs/CardsTab.js
import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../../theme/colors";

const GRID = 3;

export default function CardsTab({ cards = [], onOpenCard }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Cards</Text>
      {cards.length ? (
        <View style={styles.gridWrap}>
          {cards.slice(0, 24).map((c) => (
            <Pressable
              key={String(c.id)}
              onPress={() => onOpenCard?.(c)}
              style={styles.gridItem}
            >
              {c.image ? <Image source={{ uri: c.image }} style={styles.gridThumb} /> : <View style={styles.gridThumb} />}
              <Text style={styles.gridCaption} numberOfLines={1}>{c.name || "Card"}</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <Text style={styles.bodyText}>No cards to show.</Text>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  card:{backgroundColor:COLORS.surface,borderColor:COLORS.border,borderWidth:1,borderRadius:12,padding:12,marginTop:12},
  cardTitle:{color:COLORS.text,fontWeight:"900",marginBottom:8},
  bodyText:{color:COLORS.text},
  gridWrap:{flexDirection:"row",flexWrap:"wrap",gap:10},
  gridItem:{width:`${100/GRID-2}%`},
  gridThumb:{width:"100%",aspectRatio:63/88,backgroundColor:COLORS.alt,borderRadius:8,borderWidth:1,borderColor:COLORS.border},
  gridCaption:{color:COLORS.text,fontSize:12,marginTop:6},
});
