// components/alerts/PriceAlertsSheet.js
// Manage price alerts — list, create, edit, toggle, delete.

import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useLazyQuery } from "@apollo/client";
import { COLORS } from "../../theme/colors";
import {
  MyPriceAlertsDocument,
  UpsertPriceAlertDocument,
  DeletePriceAlertDocument,
  TogglePriceAlertDocument,
  SearchCardsDocument,
} from "../../graphql/documents";

const CONDITIONS = [
  "Near Mint",
  "Lightly Played",
  "Moderately Played",
  "Heavily Played",
  "Damaged",
];

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ── Form defaults ─────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  value: "",
  condition: "",
  variation: "",
  windowHours: "24",
  cooldownHours: "12",
  isActive: true,
};

// ── Main sheet ────────────────────────────────────────────────────────────────

export default function PriceAlertsSheet({ visible, onClose }) {
  const insets = useSafeAreaInsets();

  // Navigation: "list" | "create" | "edit"
  const [phase, setPhase] = useState("list");
  const [editingId, setEditingId] = useState(null);

  // Card picker (create phase)
  const [cardSearch, setCardSearch] = useState("");
  const [selectedCard, setSelectedCard] = useState(null); // { id, name }

  // Form values (shared create/edit)
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data, loading, refetch } = useQuery(MyPriceAlertsDocument, {
    fetchPolicy: "cache-and-network",
    skip: !visible,
  });

  const [searchCards, { data: searchData, loading: searchLoading }] =
    useLazyQuery(SearchCardsDocument);

  const [upsertAlert] = useMutation(UpsertPriceAlertDocument);
  const [deleteAlert] = useMutation(DeletePriceAlertDocument);
  const [toggleAlert] = useMutation(TogglePriceAlertDocument);

  const alerts = data?.myPriceAlerts ?? [];
  const searchResults = searchData?.searchCards?.items ?? [];

  // ── Helpers ───────────────────────────────────────────────────────────────

  function resetForm() {
    setCardSearch("");
    setSelectedCard(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setSaveLoading(false);
    setEditingId(null);
  }

  function openCreate() {
    resetForm();
    setPhase("create");
  }

  function openEdit(alert) {
    resetForm();
    setEditingId(alert.id);
    // Show cardId as name placeholder for edit (no card name cached)
    setSelectedCard({ id: alert.cardId, name: alert.cardId });
    setCardSearch(alert.cardId);
    setForm({
      value: String(alert.value ?? ""),
      condition: alert.condition ?? "",
      variation: alert.variation ?? "",
      windowHours: String(alert.windowHours ?? "24"),
      cooldownHours: String(alert.cooldownHours ?? "12"),
      isActive: alert.isActive,
    });
    setPhase("edit");
  }

  function goBack() {
    resetForm();
    setPhase("list");
  }

  function handleClose() {
    resetForm();
    setPhase("list");
    onClose();
  }

  // ── Mutations ─────────────────────────────────────────────────────────────

  async function handleSave() {
    setFormError("");
    const value = parseFloat(form.value);
    if (!selectedCard?.id) {
      setFormError("Select a card first.");
      return;
    }
    if (!form.value || isNaN(value) || value <= 0) {
      setFormError("Enter a valid price threshold (e.g. 2.50).");
      return;
    }

    setSaveLoading(true);
    try {
      await upsertAlert({
        variables: {
          input: {
            ...(editingId ? { id: editingId } : {}),
            cardId: selectedCard.id,
            condition: form.condition || undefined,
            variation: form.variation || undefined,
            currency: "GBP",
            value,
            windowHours: parseInt(form.windowHours, 10) || 24,
            cooldownHours: parseInt(form.cooldownHours, 10) || 12,
            isActive: form.isActive,
          },
        },
      });
      await refetch();
      resetForm();
      setPhase("list");
    } catch (e) {
      setFormError(e.message || "Failed to save alert.");
    } finally {
      setSaveLoading(false);
    }
  }

  async function handleDelete(id) {
    Alert.alert("Delete alert?", "This price alert will be removed permanently.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteAlert({ variables: { id } });
            refetch();
          } catch (e) {
            Alert.alert("Error", e.message || "Failed to delete alert.");
          }
        },
      },
    ]);
  }

  async function handleToggle(id, currentActive) {
    try {
      await toggleAlert({ variables: { id, active: !currentActive } });
      refetch();
    } catch (_) {}
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const isFormPhase = phase === "create" || phase === "edit";

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={[styles.container, { paddingBottom: insets.bottom + 16 }]}>
        {/* Header */}
        <View style={styles.header}>
          {isFormPhase ? (
            <Pressable onPress={goBack} hitSlop={8}>
              <Text style={styles.navText}>← Back</Text>
            </Pressable>
          ) : (
            <View style={{ width: 60 }} />
          )}

          <Text style={styles.headerTitle}>
            {phase === "create"
              ? "New Alert"
              : phase === "edit"
              ? "Edit Alert"
              : "Price Alerts"}
          </Text>

          {isFormPhase ? (
            <View style={{ width: 60 }} />
          ) : (
            <Pressable onPress={handleClose} hitSlop={8}>
              <Text style={[styles.navText, { textAlign: "right" }]}>Done</Text>
            </Pressable>
          )}
        </View>

        {/* ── LIST ──────────────────────────────────────────────────────── */}
        {phase === "list" && (
          <>
            <Pressable onPress={openCreate} style={styles.newBtn}>
              <Text style={styles.newBtnText}>+ New Price Alert</Text>
            </Pressable>

            {loading && alerts.length === 0 ? (
              <View style={styles.center}>
                <ActivityIndicator color={COLORS.accent} />
              </View>
            ) : alerts.length === 0 ? (
              <View style={styles.center}>
                <Text style={styles.emptyIcon}>🔔</Text>
                <Text style={styles.emptyTitle}>No price alerts</Text>
                <Text style={styles.emptyBody}>
                  Get notified when a card drops to your target price.
                </Text>
              </View>
            ) : (
              <FlatList
                data={alerts}
                keyExtractor={(a) => a.id}
                contentContainerStyle={{ padding: 12, gap: 8 }}
                refreshControl={
                  <RefreshControl
                    refreshing={loading}
                    onRefresh={refetch}
                    tintColor={COLORS.accent}
                  />
                }
                renderItem={({ item: a }) => (
                  <View
                    style={[
                      styles.alertCard,
                      !a.isActive && styles.alertCardOff,
                    ]}
                  >
                    {/* Info */}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.alertCardId} numberOfLines={2}>
                        {a.cardId}
                      </Text>
                      <Text style={styles.alertPrice}>
                        Under £{Number(a.value).toFixed(2)}
                      </Text>
                      <Text style={styles.alertMeta}>
                        {[a.condition, a.variation]
                          .filter(Boolean)
                          .join(" · ") || "Any condition"}
                        {" · "}check every {a.windowHours}h
                      </Text>
                      {a.lastFiredAt ? (
                        <Text style={styles.alertFired}>
                          Last fired: {timeAgo(a.lastFiredAt)}
                        </Text>
                      ) : null}
                    </View>

                    {/* Actions */}
                    <View style={styles.alertActions}>
                      <Switch
                        value={a.isActive}
                        onValueChange={() => handleToggle(a.id, a.isActive)}
                        trackColor={{ true: COLORS.accent }}
                        thumbColor="#fff"
                      />
                      <Pressable
                        onPress={() => openEdit(a)}
                        hitSlop={8}
                        style={styles.editBtn}
                      >
                        <Text style={styles.editBtnText}>Edit</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => handleDelete(a.id)}
                        hitSlop={10}
                        style={styles.deleteBtn}
                      >
                        <Text style={styles.deleteBtnText}>✕</Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              />
            )}
          </>
        )}

        {/* ── CREATE / EDIT ─────────────────────────────────────────────── */}
        {isFormPhase && (
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <ScrollView
              contentContainerStyle={styles.formBody}
              keyboardShouldPersistTaps="handled"
            >
              {formError ? (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorText}>{formError}</Text>
                </View>
              ) : null}

              {/* ── Card selection (create only) ──────────────────────── */}
              {phase === "create" && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Card</Text>
                  <TextInput
                    style={styles.input}
                    value={cardSearch}
                    onChangeText={(v) => {
                      setCardSearch(v);
                      setSelectedCard(null);
                      if (v.length >= 2) {
                        searchCards({
                          variables: { input: { query: v, limit: 8 } },
                        });
                      }
                    }}
                    placeholder="Search card name…"
                    placeholderTextColor={COLORS.textMuted}
                    autoCorrect={false}
                  />

                  {searchLoading && (
                    <ActivityIndicator
                      size="small"
                      color={COLORS.accent}
                      style={{ alignSelf: "flex-start" }}
                    />
                  )}

                  {/* Search results */}
                  {!selectedCard && searchResults.length > 0 && (
                    <View style={styles.searchResults}>
                      {searchResults.map((c) => (
                        <Pressable
                          key={c.id}
                          onPress={() => {
                            setSelectedCard({
                              id: c.cardId ?? c.id,
                              name: c.name,
                            });
                            setCardSearch(c.name);
                          }}
                          style={styles.searchRow}
                        >
                          <Text style={styles.searchRowName}>{c.name}</Text>
                          <Text style={styles.searchRowSet}>
                            {c.set?.name ?? c.setCode ?? ""}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  )}

                  {selectedCard && (
                    <View style={styles.selectedCard}>
                      <Text style={styles.selectedCardText}>
                        ✓ {selectedCard.name}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* ── Edit: show locked card ────────────────────────────── */}
              {phase === "edit" && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Card</Text>
                  <View style={styles.lockedRow}>
                    <Text style={styles.lockedText} numberOfLines={2}>
                      {selectedCard?.name ?? editingId}
                    </Text>
                  </View>
                </View>
              )}

              {/* ── Price threshold ───────────────────────────────────── */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Price threshold</Text>
                <Text style={styles.sectionHint}>
                  Alert when any listing drops below this price
                </Text>
                <View style={styles.priceRow}>
                  <Text style={styles.currencySymbol}>£</Text>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={form.value}
                    onChangeText={(v) =>
                      setForm((f) => ({ ...f, value: v }))
                    }
                    placeholder="0.00"
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              {/* ── Condition ─────────────────────────────────────────── */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Condition (optional)</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ flexDirection: "row", gap: 8 }}
                >
                  <Pressable
                    onPress={() => setForm((f) => ({ ...f, condition: "" }))}
                    style={[
                      styles.chip,
                      !form.condition && styles.chipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        !form.condition && styles.chipTextActive,
                      ]}
                    >
                      Any
                    </Text>
                  </Pressable>
                  {CONDITIONS.map((c) => (
                    <Pressable
                      key={c}
                      onPress={() => setForm((f) => ({ ...f, condition: c }))}
                      style={[
                        styles.chip,
                        form.condition === c && styles.chipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          form.condition === c && styles.chipTextActive,
                        ]}
                      >
                        {c}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              {/* ── Settings ──────────────────────────────────────────── */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Settings</Text>

                <View style={{ flexDirection: "row", gap: 12 }}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={styles.fieldLabel}>Check window (hrs)</Text>
                    <TextInput
                      style={styles.input}
                      value={form.windowHours}
                      onChangeText={(v) =>
                        setForm((f) => ({
                          ...f,
                          windowHours: v.replace(/\D/g, ""),
                        }))
                      }
                      placeholder="24"
                      placeholderTextColor={COLORS.textMuted}
                      keyboardType="number-pad"
                    />
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={styles.fieldLabel}>Cooldown (hrs)</Text>
                    <TextInput
                      style={styles.input}
                      value={form.cooldownHours}
                      onChangeText={(v) =>
                        setForm((f) => ({
                          ...f,
                          cooldownHours: v.replace(/\D/g, ""),
                        }))
                      }
                      placeholder="12"
                      placeholderTextColor={COLORS.textMuted}
                      keyboardType="number-pad"
                    />
                  </View>
                </View>

                <View style={styles.toggleRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.toggleLabel}>Active</Text>
                    <Text style={styles.toggleSub}>
                      Receive alerts when this triggers
                    </Text>
                  </View>
                  <Switch
                    value={form.isActive}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, isActive: v }))
                    }
                    trackColor={{ true: COLORS.accent }}
                    thumbColor="#fff"
                  />
                </View>
              </View>

              <Pressable
                onPress={handleSave}
                disabled={saveLoading}
                style={[styles.primaryBtn, saveLoading && { opacity: 0.5 }]}
              >
                {saveLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.primaryBtnText}>
                    {editingId ? "Save Changes" : "Create Alert"}
                  </Text>
                )}
              </Pressable>
            </ScrollView>
          </KeyboardAvoidingView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  headerTitle: { color: COLORS.text, fontWeight: "800", fontSize: 16 },
  navText: {
    color: COLORS.accent,
    fontWeight: "700",
    fontSize: 15,
    minWidth: 60,
  },

  newBtn: {
    marginHorizontal: 14,
    marginTop: 12,
    marginBottom: 4,
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
  },
  newBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 32,
  },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { color: COLORS.text, fontWeight: "800", fontSize: 18 },
  emptyBody: {
    color: COLORS.textMuted,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },

  alertCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    padding: 14,
  },
  alertCardOff: { opacity: 0.55 },
  alertCardId: { color: COLORS.text, fontWeight: "800", fontSize: 14, marginBottom: 2 },
  alertPrice: { color: COLORS.accent, fontWeight: "900", fontSize: 16 },
  alertMeta: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  alertFired: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
  alertActions: { alignItems: "center", gap: 8 },
  editBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.alt,
  },
  editBtnText: { color: COLORS.text, fontWeight: "700", fontSize: 12 },
  deleteBtn: { padding: 4 },
  deleteBtnText: { color: COLORS.textMuted, fontSize: 14 },

  formBody: { padding: 16, gap: 14 },

  errorBanner: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    borderColor: "#ef444455",
    backgroundColor: "#ef444411",
  },
  errorText: { color: "#ef4444", fontWeight: "700", fontSize: 13 },

  section: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    color: COLORS.textMuted,
    fontWeight: "800",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  sectionHint: { color: COLORS.textMuted, fontSize: 12 },

  input: {
    backgroundColor: COLORS.alt,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: COLORS.text,
    fontSize: 15,
  },

  searchResults: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
  },
  searchRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.alt,
  },
  searchRowName: { color: COLORS.text, fontWeight: "700", fontSize: 14 },
  searchRowSet: { color: COLORS.textMuted, fontSize: 12, marginTop: 1 },

  selectedCard: {
    backgroundColor: COLORS.accent + "15",
    borderWidth: 1,
    borderColor: COLORS.accent + "44",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  selectedCardText: { color: COLORS.accent, fontWeight: "700", fontSize: 14 },

  lockedRow: {
    backgroundColor: COLORS.alt,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  lockedText: { color: COLORS.textMuted, fontSize: 14 },

  priceRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  currencySymbol: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "800",
    paddingBottom: 2,
  },

  chip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: COLORS.alt,
  },
  chipActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  chipText: { color: COLORS.textMuted, fontWeight: "600", fontSize: 13 },
  chipTextActive: { color: "#fff" },

  fieldLabel: { color: COLORS.textMuted, fontSize: 11, fontWeight: "600" },

  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  toggleLabel: { color: COLORS.text, fontWeight: "800", fontSize: 14 },
  toggleSub: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },

  primaryBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
});
