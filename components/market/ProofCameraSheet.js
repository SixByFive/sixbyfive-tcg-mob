// components/market/ProofCameraSheet.js
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { useMutation } from "@apollo/client";
import { COLORS } from "../../theme/colors";
import { SubmitListingProofDocument, MyMarketListingsDocument } from "../../graphql/documents";

export default function ProofCameraSheet({ visible, listing, onClose, onSubmitted }) {
  const insets = useSafeAreaInsets();
  const [photo, setPhoto] = useState(null); // { uri, base64 }
  const [phase, setPhase] = useState("instructions"); // "instructions" | "preview" | "done"
  const [proofCode, setProofCode] = useState(null); // may update if expired

  const code = proofCode ?? listing?.proofCode;
  const cardName = listing?.cardInfo?.name || listing?.cardId || "Card";

  const [submitProof, { loading: submitting }] = useMutation(SubmitListingProofDocument, {
    refetchQueries: [{ query: MyMarketListingsDocument, variables: { limit: 40 } }],
  });

  async function handleTakePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Camera permission required",
        "Please allow camera access in your device settings to submit a proof photo."
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      base64: true,
      exif: false,
    });

    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      setPhoto({ uri: asset.uri, base64: asset.base64 });
      setPhase("preview");
    }
  }

  async function handleSubmit() {
    if (!photo?.base64 || !listing?.id) return;

    // Prepend data URI header — the server strips it to decode the raw bytes
    const imageDataUrl = `data:image/jpeg;base64,${photo.base64}`;

    try {
      const { data } = await submitProof({
        variables: { id: listing.id, image: imageDataUrl },
      });

      const res = data?.submitListingProof;

      if (res?.result === "expired") {
        // Server regenerated a new code — show it and ask seller to re-photograph
        setProofCode(res.newProofCode);
        setPhoto(null);
        setPhase("instructions");
        Alert.alert(
          "Proof code expired",
          `A new code has been generated: ${res.newProofCode}\n\nPlease write this new code on paper and re-take the photo.`
        );
        return;
      }

      setPhase("done");
      onSubmitted?.();
    } catch (e) {
      Alert.alert("Submission failed", e.message || "Something went wrong. Please try again.");
    }
  }

  function handleClose() {
    setPhoto(null);
    setPhase("instructions");
    setProofCode(null);
    onClose();
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={[styles.container, { paddingBottom: insets.bottom }]}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Submit proof photo</Text>
          <Pressable onPress={handleClose} hitSlop={12}>
            <Text style={styles.closeText}>{phase === "done" ? "Done" : "Cancel"}</Text>
          </Pressable>
        </View>

        {/* ── Done ── */}
        {phase === "done" && (
          <View style={styles.doneBox}>
            <Text style={styles.doneEmoji}>📬</Text>
            <Text style={styles.doneTitle}>Photo submitted!</Text>
            <Text style={styles.doneSub}>
              Your proof is being reviewed. We'll let you know once your listing is verified and goes live.
            </Text>
            <Pressable onPress={handleClose} style={styles.btn}>
              <Text style={styles.btnText}>Done</Text>
            </Pressable>
          </View>
        )}

        {/* ── Instructions ── */}
        {phase === "instructions" && (
          <ScrollView contentContainerStyle={styles.scroll}>

            {/* Code box */}
            <View style={styles.codeCard}>
              <Text style={styles.codeLabel}>Your proof code</Text>
              <Text style={styles.codeValue}>{code || "—"}</Text>
              <Text style={styles.codeHint}>
                Write this code on a piece of paper. It must appear clearly in the photo.
              </Text>
            </View>

            {/* Steps */}
            <View style={styles.stepsCard}>
              <Text style={styles.stepsTitle}>How to take the proof photo</Text>
              {[
                `Write "${code}" on a plain piece of paper.`,
                `Place your copy of ${cardName} next to the paper.`,
                "Take a clear, well-lit photo showing both the card and the code.",
                "The code must be legible — avoid blurry or dark photos.",
              ].map((step, i) => (
                <View key={i} style={styles.stepRow}>
                  <View style={styles.stepNum}>
                    <Text style={styles.stepNumText}>{i + 1}</Text>
                  </View>
                  <Text style={styles.stepText}>{step}</Text>
                </View>
              ))}
            </View>

            <Pressable onPress={handleTakePhoto} style={styles.cameraBtn}>
              <Text style={styles.cameraBtnText}>📷  Open camera</Text>
            </Pressable>

            <Text style={styles.disclaimer}>
              Submitting a fake or manipulated image will result in permanent account suspension.
            </Text>
          </ScrollView>
        )}

        {/* ── Preview ── */}
        {phase === "preview" && photo && (
          <View style={styles.previewWrap}>
            <Image
              source={{ uri: photo.uri }}
              style={styles.previewImage}
              resizeMode="contain"
            />

            {/* Code reminder */}
            <View style={styles.previewCodeRow}>
              <Text style={styles.previewCodeLabel}>Code in photo:</Text>
              <View style={styles.previewCodeChip}>
                <Text style={styles.previewCodeText}>{code}</Text>
              </View>
            </View>

            <Text style={styles.previewHint}>
              Make sure the code is clearly visible and the card is in frame. Retake if anything is unclear.
            </Text>

            <View style={styles.previewActions}>
              <Pressable
                onPress={() => { setPhoto(null); setPhase("instructions"); }}
                style={styles.retakeBtn}
              >
                <Text style={styles.retakeBtnText}>Retake</Text>
              </Pressable>
              <Pressable
                onPress={handleSubmit}
                disabled={submitting}
                style={[styles.btn, styles.submitBtn, submitting && { opacity: 0.5 }]}
              >
                {submitting
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.btnText}>Submit photo</Text>
                }
              </Pressable>
            </View>
          </View>
        )}

      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    paddingTop: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  title: { color: COLORS.text, fontWeight: "700", fontSize: 16 },
  closeText: { color: COLORS.accent, fontWeight: "600", fontSize: 15 },

  scroll: { padding: 16, gap: 16, paddingBottom: 40 },

  // Proof code card
  codeCard: {
    backgroundColor: "rgba(99,102,241,0.12)",
    borderWidth: 1,
    borderColor: "rgba(99,102,241,0.3)",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    gap: 8,
  },
  codeLabel: {
    color: "rgba(165,180,252,0.8)",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  codeValue: {
    color: "#fff",
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: 6,
  },
  codeHint: {
    color: "rgba(165,180,252,0.65)",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 17,
    marginTop: 4,
  },

  // Steps
  stepsCard: {
    backgroundColor: COLORS.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  stepsTitle: {
    color: COLORS.text,
    fontWeight: "700",
    fontSize: 13,
    marginBottom: 4,
  },
  stepRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  stepNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 1,
  },
  stepNumText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  stepText: { flex: 1, color: COLORS.textSecondary, fontSize: 13, lineHeight: 19 },

  cameraBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
  },
  cameraBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },

  disclaimer: {
    color: COLORS.textMuted,
    fontSize: 11,
    textAlign: "center",
    lineHeight: 16,
    marginTop: -4,
  },

  // Preview
  previewWrap: { flex: 1, padding: 16, gap: 14 },
  previewImage: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: "#111218",
    minHeight: 280,
  },
  previewCodeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  previewCodeLabel: { color: COLORS.textMuted, fontSize: 13 },
  previewCodeChip: {
    backgroundColor: "rgba(99,102,241,0.2)",
    borderWidth: 1,
    borderColor: "rgba(99,102,241,0.4)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  previewCodeText: { color: "#a5b4fc", fontWeight: "800", fontSize: 14, letterSpacing: 2 },
  previewHint: { color: COLORS.textMuted, fontSize: 12, lineHeight: 17 },
  previewActions: { flexDirection: "row", gap: 10, paddingBottom: 8 },
  retakeBtn: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 18,
    alignItems: "center",
  },
  retakeBtnText: { color: COLORS.textSecondary, fontWeight: "600" },
  btn: {
    flex: 1,
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
  },
  submitBtn: {},
  btnText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  // Done
  doneBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  doneEmoji: { fontSize: 52 },
  doneTitle: { color: COLORS.text, fontWeight: "800", fontSize: 22 },
  doneSub: { color: COLORS.textMuted, fontSize: 14, textAlign: "center", lineHeight: 20 },
});
