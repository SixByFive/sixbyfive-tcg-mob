// components/market/SellerSetupSheet.js
//
// Shop Settings — redesigned as a single scrollable page with collapsible
// sections. Each section shows a summary row when collapsed and expands
// inline on tap, giving a native iOS-Settings feel.
//
// Sections:
//   Payouts         — wallet balance + top up
//   Return Address  — sender address for Parcel2Go labels
//   Shipping        — shipping profiles (local)
//   Vacation        — vacation mode (local)
//   Trades          — trade preferences (local)
//   Blocked         — blocked users (local)

import { useMutation, useQuery } from "@apollo/client";
import * as FileSystem from "expo-file-system";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  UIManager,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  MyWalletDocument,
  RequestWithdrawalDocument,
  SellerAddressDocument,
  UpdateSellerAddressDocument,
} from "../../graphql/documents";
import { COLORS } from "../../theme/colors";
import WalletTopupSheet from "../wallet/WalletTopupSheet";

// Enable LayoutAnimation on Android
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ── File-based storage ────────────────────────────────────────────────────────

const KEYS = {
  shippingProfiles: "seller_shipping_profiles",
  vacation: "seller_vacation_mode",
  tradeSettings: "seller_trade_settings",
  blockedUsers: "seller_blocked_users",
};

function filePath(key) {
  return `${FileSystem.documentDirectory}${key}.json`;
}

async function readJson(key) {
  try {
    const path = filePath(key);
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) return null;
    return JSON.parse(await FileSystem.readAsStringAsync(path));
  } catch {
    return null;
  }
}

async function writeJson(key, value) {
  await FileSystem.writeAsStringAsync(filePath(key), JSON.stringify(value));
}

const DEFAULT_PROFILES = [
  { id: "1", name: "UK Standard", price: "1.99", days: "2-3" },
  { id: "2", name: "UK Tracked 24/48", price: "3.99", days: "1-2" },
  { id: "3", name: "International Tracked", price: "9.99", days: "5-9" },
];

const DEFAULT_VACATION = {
  enabled: false,
  endDate: "",
  autoResume: false,
  message: "",
};
const DEFAULT_TRADE = {
  allowOffers: true,
  minTradeValue: "",
  pweSupport: false,
  tradeRegion: "UK",
};

// ── Shared primitives ─────────────────────────────────────────────────────────

function Input({
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize,
  style,
  multiline,
}) {
  return (
    <TextInput
      style={[styles.input, style]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={COLORS.textMuted}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize ?? "words"}
      autoCorrect={false}
      multiline={multiline}
    />
  );
}

function FieldRow({ label, children }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function ToggleRow({ label, hint, value, onValueChange }) {
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {hint ? <Text style={styles.toggleHint}>{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: COLORS.border, true: COLORS.accent }}
        thumbColor="#fff"
      />
    </View>
  );
}

function SaveButton({ onPress, loading, disabled, label = "Save changes" }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={[styles.saveBtn, (disabled || loading) && { opacity: 0.5 }]}
    >
      {loading ? (
        <ActivityIndicator color="#fff" size="small" />
      ) : (
        <Text style={styles.saveBtnText}>{label}</Text>
      )}
    </Pressable>
  );
}

function StatusMsg({ msg, type, onClear }) {
  if (!msg) return null;
  const ok = type !== "error";
  return (
    <View
      style={[
        styles.statusMsg,
        {
          borderColor: ok ? "#10b98140" : "#ef444440",
          backgroundColor: ok ? "#10b98110" : "#ef444410",
        },
      ]}
    >
      <Text
        style={{
          color: ok ? "#10b981" : "#ef4444",
          fontWeight: "700",
          fontSize: 12,
          flex: 1,
        }}
      >
        {msg}
      </Text>
      {onClear && (
        <Pressable onPress={onClear} hitSlop={8}>
          <Text style={{ color: COLORS.textMuted, fontSize: 12 }}>✕</Text>
        </Pressable>
      )}
    </View>
  );
}

// ── Collapsible section wrapper ───────────────────────────────────────────────

function Section({ title, summary, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);

  function toggle() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((o) => !o);
  }

  return (
    <View style={styles.sectionCard}>
      {/* Header row — always visible */}
      <Pressable
        onPress={toggle}
        style={({ pressed }) => [
          styles.sectionHeader,
          pressed && { opacity: 0.85 },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {summary && !open ? (
            <Text style={styles.sectionSummary} numberOfLines={1}>
              {summary}
            </Text>
          ) : null}
        </View>
        <Text style={[styles.chevron, open && styles.chevronOpen]}>›</Text>
      </Pressable>

      {/* Body — rendered only when open so layout is always correct */}
      {open && <View style={styles.sectionBody}>{children}</View>}
    </View>
  );
}

// ── Helpers: sort code / account number formatting ────────────────────────────

function formatSortCode(raw) {
  const digits = raw.replace(/\D/g, "").slice(0, 6);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
}

// ── Payouts section ───────────────────────────────────────────────────────────

function PayoutsSection() {
  const { data, loading, refetch } = useQuery(MyWalletDocument, {
    fetchPolicy: "cache-and-network",
  });
  const [requestWithdrawal] = useMutation(RequestWithdrawalDocument);
  const [showTopup, setShowTopup] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);

  // Withdrawal form state
  const [wAmount, setWAmount] = useState("");
  const [wSortCode, setWSortCode] = useState("");
  const [wAccountNum, setWAccountNum] = useState("");
  const [wAccountName, setWAccountName] = useState("");
  const [wStatus, setWStatus] = useState(null);
  const [wLoading, setWLoading] = useState(false);

  const balance =
    data?.myWallet?.balance != null ? Number(data.myWallet.balance) : null;
  const balanceFmt = balance != null ? `£${balance.toFixed(2)}` : "—";
  const balancePence = balance != null ? Math.round(balance * 100) : 0;

  const amountPence = Math.round(parseFloat(wAmount || "0") * 100);
  const canWithdraw =
    amountPence >= 1000 && // min £10
    amountPence <= balancePence &&
    wSortCode.replace(/\D/g, "").length === 6 &&
    wAccountNum.replace(/\D/g, "").length === 8;

  async function handleWithdraw() {
    setWStatus(null);
    setWLoading(true);
    try {
      const { data: res } = await requestWithdrawal({
        variables: {
          amountPence,
          sortCode: wSortCode.replace(/-/g, ""),
          accountNumber: wAccountNum.replace(/\D/g, ""),
          accountName: wAccountName.trim() || null,
        },
      });
      if (res?.requestWithdrawal?.id) {
        setWStatus({
          type: "success",
          msg: `Withdrawal of £${(amountPence / 100).toFixed(2)} requested. Processed within 1–3 business days.`,
        });
        setWAmount("");
        setWSortCode("");
        setWAccountNum("");
        setWAccountName("");
        setShowWithdraw(false);
        refetch();
      } else {
        throw new Error("Withdrawal request failed.");
      }
    } catch (e) {
      setWStatus({
        type: "error",
        msg: e.message || "Failed to request withdrawal.",
      });
    } finally {
      setWLoading(false);
    }
  }

  return (
    <>
      <Section
        title="Payouts"
        summary={balance != null ? `Wallet: ${balanceFmt}` : "Wallet balance"}
        defaultOpen
      >
        <Text style={styles.hint}>
          When a buyer confirms receipt, your earnings (minus platform fee) are
          credited to your SixByFive wallet. Withdraw to your UK bank account at
          any time.
        </Text>

        {/* Balance card */}
        <View style={styles.balanceCard}>
          <View>
            <Text style={styles.balanceLabel}>Available balance</Text>
            {loading && balance === null ? (
              <ActivityIndicator
                color={COLORS.accent}
                size="small"
                style={{ marginTop: 4 }}
              />
            ) : (
              <Text style={styles.balanceAmount}>{balanceFmt}</Text>
            )}
          </View>
          <Pressable onPress={() => setShowTopup(true)} style={styles.topupBtn}>
            <Text style={styles.topupBtnText}>+ Top up</Text>
          </Pressable>
        </View>

        {/* Withdraw toggle button */}
        <Pressable
          onPress={() => {
            setShowWithdraw((s) => !s);
            setWStatus(null);
          }}
          style={styles.withdrawToggleBtn}
        >
          <Text style={styles.withdrawToggleText}>
            {showWithdraw ? "Cancel withdrawal" : "↓ Withdraw to bank"}
          </Text>
        </Pressable>

        {/* Withdrawal form — inline expand */}
        {showWithdraw && (
          <View style={styles.withdrawForm}>
            <Text style={[styles.hint, { marginBottom: 4 }]}>
              UK bank transfers only. Minimum £10. Processed within 1–3 business
              days.
            </Text>

            {wStatus && (
              <StatusMsg
                msg={wStatus.msg}
                type={wStatus.type}
                onClear={() => setWStatus(null)}
              />
            )}

            <FieldRow label="Amount (£)">
              <Input
                value={wAmount}
                onChangeText={(v) => setWAmount(v.replace(/[^0-9.]/g, ""))}
                placeholder="0.00"
                keyboardType="decimal-pad"
                autoCapitalize="none"
              />
              {balance != null && (
                <Text style={styles.hint}>Max: {balanceFmt}</Text>
              )}
            </FieldRow>

            <FieldRow label="Sort code">
              <Input
                value={wSortCode}
                onChangeText={(v) => setWSortCode(formatSortCode(v))}
                placeholder="00-00-00"
                keyboardType="numeric"
                autoCapitalize="none"
              />
            </FieldRow>

            <FieldRow label="Account number">
              <Input
                value={wAccountNum}
                onChangeText={(v) =>
                  setWAccountNum(v.replace(/\D/g, "").slice(0, 8))
                }
                placeholder="12345678"
                keyboardType="numeric"
                autoCapitalize="none"
              />
            </FieldRow>

            <FieldRow label="Account name (optional)">
              <Input
                value={wAccountName}
                onChangeText={setWAccountName}
                placeholder="Jane Smith"
              />
            </FieldRow>

            {amountPence > 0 && amountPence < 1000 && (
              <Text style={styles.withdrawValidationHint}>
                Minimum withdrawal is £10.00
              </Text>
            )}
            {amountPence > 0 && amountPence > balancePence && (
              <Text style={styles.withdrawValidationHint}>
                Amount exceeds your available balance
              </Text>
            )}

            <SaveButton
              onPress={handleWithdraw}
              loading={wLoading}
              disabled={!canWithdraw}
              label={`Withdraw £${amountPence > 0 ? (amountPence / 100).toFixed(2) : "—"}`}
            />
          </View>
        )}
      </Section>

      <WalletTopupSheet
        visible={showTopup}
        onClose={() => setShowTopup(false)}
        onSuccess={refetch}
      />
    </>
  );
}

// ── Address section ───────────────────────────────────────────────────────────

function AddressSection() {
  const { data, loading: queryLoading } = useQuery(SellerAddressDocument, {
    fetchPolicy: "cache-and-network",
  });
  const [updateAddress, { loading: saving }] = useMutation(
    UpdateSellerAddressDocument,
  );

  const [name, setName] = useState("");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [postcode, setPostcode] = useState("");
  const [country, setCountry] = useState("GB");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState(null);

  useEffect(() => {
    const a = data?.sellerAddress;
    if (!a) return;
    setName(a.name ?? "");
    setLine1(a.line1 ?? "");
    setLine2(a.line2 ?? "");
    setCity(a.city ?? "");
    setPostcode(a.postcode ?? "");
    setCountry(a.country ?? "GB");
    setPhone(a.phone ?? "");
    setEmail(a.email ?? "");
  }, [data]);

  const summary = line1 ? `${line1}${city ? `, ${city}` : ""}` : "Not set";
  const canSave =
    !!name.trim() && !!line1.trim() && !!city.trim() && !!postcode.trim();

  async function handleSave() {
    if (!canSave) {
      setStatus({
        type: "error",
        msg: "Name, address line 1, city and postcode are required.",
      });
      return;
    }
    setStatus(null);
    try {
      await updateAddress({
        variables: {
          input: {
            name,
            line1,
            line2,
            city,
            postcode: postcode.toUpperCase(),
            country,
            phone,
            email,
          },
        },
      });
      setStatus({ type: "success", msg: "Return address saved ✓" });
    } catch (e) {
      setStatus({ type: "error", msg: e.message });
    }
  }

  return (
    <Section
      title="Return Address"
      summary={queryLoading ? "Loading…" : summary}
    >
      <Text style={styles.hint}>
        Printed on Parcel2Go labels as the sender address.
      </Text>

      {status && (
        <StatusMsg
          msg={status.msg}
          type={status.type}
          onClear={() => setStatus(null)}
        />
      )}

      <View style={{ gap: 10 }}>
        <FieldRow label="Full name *">
          <Input value={name} onChangeText={setName} placeholder="Jane Smith" />
        </FieldRow>
        <FieldRow label="Address line 1 *">
          <Input
            value={line1}
            onChangeText={setLine1}
            placeholder="1 High Street"
          />
        </FieldRow>
        <FieldRow label="Address line 2">
          <Input
            value={line2}
            onChangeText={setLine2}
            placeholder="Flat 2 (optional)"
          />
        </FieldRow>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <FieldRow label="City *">
              <Input value={city} onChangeText={setCity} placeholder="London" />
            </FieldRow>
          </View>
          <View style={{ flex: 1 }}>
            <FieldRow label="Postcode *">
              <Input
                value={postcode}
                onChangeText={(v) => setPostcode(v.toUpperCase())}
                placeholder="SW1A 1AA"
                autoCapitalize="characters"
              />
            </FieldRow>
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <FieldRow label="Country">
              <Input
                value={country}
                onChangeText={setCountry}
                placeholder="GB"
                autoCapitalize="characters"
              />
            </FieldRow>
          </View>
          <View style={{ flex: 1 }}>
            <FieldRow label="Phone">
              <Input
                value={phone}
                onChangeText={setPhone}
                placeholder="+44 7700 900000"
                keyboardType="phone-pad"
              />
            </FieldRow>
          </View>
        </View>
        <FieldRow label="Email">
          <Input
            value={email}
            onChangeText={setEmail}
            placeholder="jane@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </FieldRow>
      </View>

      <SaveButton onPress={handleSave} loading={saving} disabled={!canSave} />
    </Section>
  );
}

// ── Shipping profiles section ─────────────────────────────────────────────────

function ShippingSection() {
  const [profiles, setProfiles] = useState(DEFAULT_PROFILES);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    readJson(KEYS.shippingProfiles).then((d) => {
      if (d) setProfiles(d);
    });
  }, []);

  function update(id, field, value) {
    setProfiles((p) =>
      p.map((x) => (x.id === id ? { ...x, [field]: value } : x)),
    );
    setSaved(false);
  }

  async function handleSave() {
    await writeJson(KEYS.shippingProfiles, profiles);
    setSaved(true);
  }

  const summary = `${profiles.length} profile${profiles.length !== 1 ? "s" : ""}`;

  return (
    <Section title="Shipping Profiles" summary={summary}>
      <Text style={styles.hint}>
        Shown to buyers at checkout. Stored locally on this device.
      </Text>

      <View style={styles.profileHeaderRow}>
        <Text style={[styles.fieldLabel, { flex: 3 }]}>Profile name</Text>
        <Text style={[styles.fieldLabel, { flex: 1, textAlign: "center" }]}>
          Price
        </Text>
        <Text style={[styles.fieldLabel, { flex: 1, textAlign: "center" }]}>
          Days
        </Text>
      </View>

      {profiles.map((p) => (
        <View key={p.id} style={styles.profileRow}>
          <Input
            value={p.name}
            onChangeText={(v) => update(p.id, "name", v)}
            placeholder="Name"
            style={{ flex: 3 }}
          />
          <Input
            value={p.price}
            onChangeText={(v) => update(p.id, "price", v)}
            placeholder="£"
            keyboardType="decimal-pad"
            autoCapitalize="none"
            style={{ flex: 1, textAlign: "center" }}
          />
          <Input
            value={p.days}
            onChangeText={(v) => update(p.id, "days", v)}
            placeholder="d"
            style={{ flex: 1, textAlign: "center" }}
          />
        </View>
      ))}

      {saved ? (
        <Text style={styles.savedText}>✓ Saved</Text>
      ) : (
        <SaveButton onPress={handleSave} />
      )}
    </Section>
  );
}

// ── Vacation mode section ─────────────────────────────────────────────────────

function VacationSection() {
  const [vacation, setVacation] = useState(DEFAULT_VACATION);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    readJson(KEYS.vacation).then((d) => {
      if (d) setVacation(d);
    });
  }, []);

  function update(field, value) {
    setVacation((v) => ({ ...v, [field]: value }));
    setSaved(false);
  }

  async function handleSave() {
    await writeJson(KEYS.vacation, vacation);
    setSaved(true);
  }

  const summary = vacation.enabled ? "On — listings paused" : "Off";

  return (
    <Section title="Holiday Mode" summary={summary}>
      <Text style={styles.hint}>
        Hides your listings while you're away. Stored locally on this device.
      </Text>

      <ToggleRow
        label="Enable holiday mode"
        hint="Pauses all active listings"
        value={vacation.enabled}
        onValueChange={(v) => update("enabled", v)}
      />

      {vacation.enabled && (
        <View style={{ gap: 10 }}>
          <FieldRow label="Return date (optional)">
            <Input
              value={vacation.endDate}
              onChangeText={(v) => update("endDate", v)}
              placeholder="e.g. 2026-07-01"
              autoCapitalize="none"
            />
          </FieldRow>
          <ToggleRow
            label="Auto-resume on return date"
            value={vacation.autoResume}
            onValueChange={(v) => update("autoResume", v)}
          />
          <FieldRow label="Message to buyers">
            <Input
              value={vacation.message}
              onChangeText={(v) => update("message", v)}
              placeholder="Back soon — thanks for your patience!"
              multiline
              style={{ minHeight: 60 }}
            />
          </FieldRow>
        </View>
      )}

      {saved ? (
        <Text style={styles.savedText}>✓ Saved</Text>
      ) : (
        <SaveButton onPress={handleSave} />
      )}
    </Section>
  );
}

// ── Trade settings section ────────────────────────────────────────────────────

const REGIONS = [
  { value: "UK", label: "UK only" },
  { value: "UK_EU", label: "UK + EU" },
  { value: "WORLDWIDE", label: "Worldwide" },
];

function TradeSection() {
  const [settings, setSettings] = useState(DEFAULT_TRADE);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    readJson(KEYS.tradeSettings).then((d) => {
      if (d) setSettings(d);
    });
  }, []);

  function update(field, value) {
    setSettings((s) => ({ ...s, [field]: value }));
    setSaved(false);
  }

  async function handleSave() {
    await writeJson(KEYS.tradeSettings, settings);
    setSaved(true);
  }

  const summary = settings.allowOffers
    ? `Accepting • ${REGIONS.find((r) => r.value === settings.tradeRegion)?.label ?? settings.tradeRegion}`
    : "Not accepting trades";

  return (
    <Section title="Trade Settings" summary={summary}>
      <Text style={styles.hint}>
        Controls who can trade with you. Stored locally on this device.
      </Text>

      <ToggleRow
        label="Accept trade offers"
        hint="Allow others to initiate trades with you"
        value={settings.allowOffers}
        onValueChange={(v) => update("allowOffers", v)}
      />

      <ToggleRow
        label="Accept PWE trades"
        hint="Plain white envelope — untracked, low-value cards only"
        value={settings.pweSupport}
        onValueChange={(v) => update("pweSupport", v)}
      />

      <FieldRow label="Minimum trade value (£, leave blank for none)">
        <Input
          value={settings.minTradeValue}
          onChangeText={(v) => update("minTradeValue", v)}
          placeholder="0.00"
          keyboardType="decimal-pad"
          autoCapitalize="none"
        />
      </FieldRow>

      <FieldRow label="Trade region">
        <View style={styles.chipRow}>
          {REGIONS.map((opt) => (
            <Pressable
              key={opt.value}
              onPress={() => update("tradeRegion", opt.value)}
              style={[
                styles.chip,
                settings.tradeRegion === opt.value && styles.chipActive,
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  settings.tradeRegion === opt.value && styles.chipTextActive,
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </FieldRow>

      {saved ? (
        <Text style={styles.savedText}>✓ Saved</Text>
      ) : (
        <SaveButton onPress={handleSave} />
      )}
    </Section>
  );
}

// ── Blocked users section ─────────────────────────────────────────────────────

function BlockedSection() {
  const [blocked, setBlocked] = useState([]);
  const [input, setInput] = useState("");

  useEffect(() => {
    readJson(KEYS.blockedUsers).then((d) => {
      if (d) setBlocked(d);
    });
  }, []);

  async function persist(list) {
    setBlocked(list);
    await writeJson(KEYS.blockedUsers, list);
  }

  async function handleAdd() {
    const u = input.trim().toLowerCase();
    if (!u || blocked.includes(u)) {
      setInput("");
      return;
    }
    await persist([...blocked, u]);
    setInput("");
  }

  function handleRemove(u) {
    Alert.alert("Unblock user", `Unblock @${u}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Unblock",
        style: "destructive",
        onPress: () => persist(blocked.filter((x) => x !== u)),
      },
    ]);
  }

  const summary =
    blocked.length === 0
      ? "None"
      : `${blocked.length} user${blocked.length !== 1 ? "s" : ""}`;

  return (
    <Section title="Blocked Users" summary={summary}>
      <Text style={styles.hint}>
        Blocked users can't message you or initiate trades. Stored locally on
        this device.
      </Text>

      <View style={{ flexDirection: "row", gap: 8 }}>
        <Input
          value={input}
          onChangeText={setInput}
          placeholder="Username to block"
          autoCapitalize="none"
          style={{ flex: 1 }}
        />
        <Pressable
          onPress={handleAdd}
          disabled={!input.trim()}
          style={[styles.addBtn, !input.trim() && { opacity: 0.4 }]}
        >
          <Text style={styles.addBtnText}>Block</Text>
        </Pressable>
      </View>

      {blocked.length === 0 ? (
        <Text style={[styles.hint, { fontStyle: "italic" }]}>
          No blocked users.
        </Text>
      ) : (
        blocked.map((u) => (
          <View key={u} style={styles.blockedRow}>
            <View style={styles.blockedAvatar}>
              <Text
                style={{
                  color: COLORS.textMuted,
                  fontWeight: "800",
                  fontSize: 13,
                }}
              >
                {u.charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.blockedName}>@{u}</Text>
            <Pressable
              onPress={() => handleRemove(u)}
              hitSlop={10}
              style={styles.removeBtn}
            >
              <Text style={styles.removeBtnText}>Unblock</Text>
            </Pressable>
          </View>
        ))
      )}
    </Section>
  );
}

// ── Main sheet ────────────────────────────────────────────────────────────────

export default function SellerSetupSheet({ visible, onClose }) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingBottom: insets.bottom }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Shop Settings</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <PayoutsSection />
          <AddressSection />
          <ShippingSection />
          <VacationSection />
          <TradeSection />
          <BlockedSection />
          <View style={{ height: 32 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  headerTitle: { color: COLORS.text, fontWeight: "800", fontSize: 17 },
  doneText: { color: COLORS.accent, fontWeight: "700", fontSize: 15 },

  body: { padding: 14, gap: 10 },

  // Section card
  sectionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    overflow: "hidden",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 12,
  },
  sectionTitle: { color: COLORS.text, fontWeight: "700", fontSize: 15 },
  sectionSummary: { color: COLORS.textMuted, fontSize: 12, marginTop: 1 },
  chevron: {
    color: COLORS.textMuted,
    fontSize: 20,
    fontWeight: "300",
    transform: [{ rotate: "0deg" }],
    lineHeight: 22,
  },
  chevronOpen: { transform: [{ rotate: "90deg" }] },
  sectionBody: {
    paddingHorizontal: 14,
    paddingBottom: 16,
    paddingTop: 4,
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },

  // Payouts
  balanceCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.alt,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  balanceLabel: { color: COLORS.textMuted, fontSize: 12, fontWeight: "600" },
  balanceAmount: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: "900",
    marginTop: 2,
  },
  topupBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  topupBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },

  // Inputs
  fieldLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  input: {
    backgroundColor: COLORS.alt,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: COLORS.text,
    fontSize: 14,
  },

  // Toggle
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 2,
  },
  toggleLabel: { color: COLORS.text, fontSize: 14, fontWeight: "600" },
  toggleHint: { color: COLORS.textMuted, fontSize: 11, marginTop: 1 },

  // Chips
  chipRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  chip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: COLORS.alt,
  },
  chipActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  chipText: { color: COLORS.textMuted, fontSize: 13, fontWeight: "600" },
  chipTextActive: { color: "#fff" },

  // Shipping profiles
  profileHeaderRow: { flexDirection: "row", gap: 8 },
  profileRow: { flexDirection: "row", gap: 6, alignItems: "center" },

  // Save / status
  saveBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 4,
  },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  savedText: {
    color: "#10b981",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 4,
  },
  statusMsg: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },

  // Withdraw
  withdrawToggleBtn: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center",
  },
  withdrawToggleText: { color: COLORS.accent, fontWeight: "700", fontSize: 13 },
  withdrawForm: {
    gap: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
  withdrawValidationHint: { color: "#f59e0b", fontSize: 12, fontWeight: "600" },

  // Misc
  hint: { color: COLORS.textMuted, fontSize: 12, lineHeight: 18 },

  // Blocked users
  addBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  blockedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  blockedAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.alt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  blockedName: { color: COLORS.text, fontSize: 14, fontWeight: "600", flex: 1 },
  removeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.3)",
  },
  removeBtnText: { color: "#ef4444", fontSize: 12, fontWeight: "700" },
});
