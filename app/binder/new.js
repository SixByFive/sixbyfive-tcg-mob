// app/binders/new.js
// NEW: 3-step binder creation wizard (Name → Cover → Template).
// UI-only: on "Create binder" it navigates to a mock editor route with a fake ID.

import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import PageHeaderBack from "../../components/common/PageHeaderBack";
import { COLORS } from "../../theme/colors";

import WizardStepCover from "../../components/binders/WizardStepCover";
import WizardStepName from "../../components/binders/WizardStepName";
import WizardStepTemplate from "../../components/binders/WizardStepTemplate";

const STEPS = ["Name", "Cover", "Template"];

export default function BinderNewWizard() {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [coverId, setCoverId] = useState("cover1");
  const [templateId, setTemplateId] = useState("pocket-9"); // default 9-pocket

  const canNext = useMemo(() => {
    if (step === 0) return name.trim().length > 0;
    if (step === 1) return Boolean(coverId);
    if (step === 2) return Boolean(templateId);
    return false;
  }, [step, name, coverId, templateId]);

  const goNext = () => {
    if (!canNext) return;
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      // UI-only create
      // TODO: call createBinder mutation. Example:
      // await createBinder({ variables: { name, coverId, templateId } })
      const fakeId = Math.random().toString(36).slice(2, 8);
      Alert.alert("Binder created", `"${name}" ready to edit.`, [
        { text: "Open binder", onPress: () => router.replace(`/binder/${fakeId}/edit`) },
      ]);
    }
  };

  const goBackStep = () => {
    if (step === 0) return router.back();
    setStep((s) => s - 1);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      <PageHeaderBack title="New binder" subtitle={`Step ${step + 1} of ${STEPS.length}`} onBack={goBackStep} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
        {/* Step indicator */}
        <View style={styles.stepper}>
          {STEPS.map((label, i) => {
            const active = i === step;
            const done = i < step;
            return (
              <View key={label} style={styles.stepItem}>
                <View
                  style={[
                    styles.stepDot,
                    done && { backgroundColor: COLORS.accent, opacity: 0.8 },
                    active && { backgroundColor: COLORS.accent },
                  ]}
                />
                <Text
                  style={[
                    styles.stepLabel,
                    active && { color: COLORS.text },
                    done && { color: COLORS.text },
                  ]}
                >
                  {label}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Step content */}
        {step === 0 && <WizardStepName value={name} onChange={setName} />}
        {step === 1 && <WizardStepCover value={coverId} onChange={setCoverId} />}
        {step === 2 && <WizardStepTemplate value={templateId} onChange={setTemplateId} />}

        {/* Footer actions */}
        <View style={styles.footer}>
          <Pressable onPress={goBackStep} style={[styles.btnGhost, step === 0 && { opacity: 0.65 }]}>
            <Text style={styles.btnGhostText}>{step === 0 ? "Cancel" : "Back"}</Text>
          </Pressable>
          <Pressable
            onPress={goNext}
            disabled={!canNext}
            style={[styles.btnPrimary, !canNext && { opacity: 0.6 }]}
          >
            <Text style={styles.btnPrimaryText}>
              {step < STEPS.length - 1 ? "Next" : "Create binder"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  stepper: { flexDirection: "row", gap: 14, marginBottom: 12, alignItems: "center" },
  stepItem: { flexDirection: "row", gap: 8, alignItems: "center" },
  stepDot: {
    width: 10, height: 10, borderRadius: 999,
    backgroundColor: COLORS.border,
  },
  stepLabel: { color: COLORS.textMuted, fontWeight: "800", fontSize: 12.5 },

  footer: { flexDirection: "row", gap: 10, marginTop: 16 },
  btnPrimary: { flex: 1, backgroundColor: COLORS.accent, borderRadius: 12, alignItems: "center", paddingVertical: 12 },
  btnPrimaryText: { color: "#fff", fontWeight: "900" },
  btnGhost: {
    backgroundColor: COLORS.alt,
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 12, alignItems: "center", paddingVertical: 12, paddingHorizontal: 16,
  },
  btnGhostText: { color: COLORS.text, fontWeight: "800" },
});
