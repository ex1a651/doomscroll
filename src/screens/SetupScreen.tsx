import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Doomscroll, { type DebugEntry, type Status } from '../../modules/doomscroll';
import { appNames, colors } from '../theme';
import { Btn, Card } from '../ui';

type Props = { status: Status | null; refreshing: boolean; onRefresh: () => void };

export default function SetupScreen({ status, refreshing, onRefresh }: Props) {
  const [log, setLog] = useState<DebugEntry[]>([]);
  const [settle, setSettle] = useState(400);

  const loadLog = useCallback(() => {
    try {
      setLog(Doomscroll.getDebugLog());
      setSettle(Doomscroll.getSettleMs());
    } catch {}
  }, []);

  useEffect(() => {
    loadLog();
    const id = setInterval(loadLog, 2000);
    return () => clearInterval(id);
  }, [loadLog]);

  const changeSettle = (delta: number) => setSettle(Doomscroll.setSettleMs(settle + delta));

  const counted = log.filter((e) => e.counted).length;
  const a11yState = !status ? 'unknown' : status.serviceRunning ? 'ok' : status.accessibilityEnabled ? 'warn' : 'off';

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} progressBackgroundColor={colors.surface} />}
    >
      {status?.crash ? (
        <Card title="⚠ Last crash">
          <Text selectable style={styles.crash}>
            {status.crash}
          </Text>
          <View style={{ marginTop: 10, alignSelf: 'flex-start' }}>
            <Btn
              title="Clear"
              kind="ghost"
              onPress={() => {
                Doomscroll.clearCrash();
                onRefresh();
              }}
            />
          </View>
        </Card>
      ) : null}

      <Card title="1 · Usage access">
        <Step
          state={status?.usageAccess ? 'ok' : 'off'}
          text="Lets the app count opens and time spent per app."
          action={<Btn title={status?.usageAccess ? 'Open' : 'Grant'} onPress={() => Doomscroll.openUsageAccessSettings()} kind={status?.usageAccess ? 'ghost' : 'primary'} />}
        />
        <Text style={styles.hint}>Find "Doomscroll" in the list → allow usage access.</Text>
      </Card>

      <Card title="2 · Swipe counting (Accessibility)">
        <Step
          state={a11yState}
          text={
            a11yState === 'ok'
              ? 'Running. Swipes in Instagram, YouTube and Facebook are being counted.'
              : a11yState === 'warn'
                ? 'Enabled but not running. Turn it off and on again.'
                : 'Counts swipes while Instagram, YouTube or Facebook is open.'
          }
          action={<Btn title={a11yState === 'ok' ? 'Open' : 'Turn on'} onPress={() => Doomscroll.openAccessibilitySettings()} kind={a11yState === 'ok' ? 'ghost' : 'primary'} />}
        />
        <Text style={styles.hint}>
          Accessibility → Downloaded apps → Doomscroll counter → On.{'\n'}
          If it's greyed out or says "Restricted setting": open App info → ⋮ (top right) → "Allow restricted settings", then try again.
        </Text>
        {status?.startupError ? <Text style={styles.error}>Service error: {status.startupError}</Text> : null}
        <View style={{ marginTop: 10, alignSelf: 'flex-start' }}>
          <Btn title="Open App info" kind="ghost" onPress={() => Doomscroll.openAppDetails()} />
        </View>
      </Card>

      <Card title="3 · Keep it alive (OnePlus)">
        <Step
          state={status?.batteryUnrestricted ? 'ok' : 'off'}
          text="Battery: allow running in the background so OxygenOS doesn't stop the counter."
          action={<Btn title={status?.batteryUnrestricted ? 'Done' : 'Allow'} onPress={() => Doomscroll.requestBatteryUnrestricted()} kind={status?.batteryUnrestricted ? 'ghost' : 'primary'} />}
        />
        <Text style={styles.hint}>
          Also in App info → Battery: choose "Unrestricted" / allow background activity, and turn on Auto-launch if shown.{'\n'}
          Then open Recents, and lock the Doomscroll card (long-press or swipe down on it → Lock).
        </Text>
      </Card>

      <Card
        title="Live test"
        right={<Text style={styles.counted}>{counted} counted / {log.length} events</Text>}
      >
        <Text style={styles.hint}>
          Open Instagram, YouTube or Facebook, swipe through 5 reels, come back here. Each swipe should show one "+1" (the first one "+2"). If one swipe shows
          several +1s, raise the merge window. If separate swipes are missed, lower it.
        </Text>
        <View style={styles.settleRow}>
          <Text style={styles.settleLabel}>Merge window</Text>
          <Btn title="−" kind="ghost" onPress={() => changeSettle(-100)} />
          <Text style={styles.settleValue}>{settle} ms</Text>
          <Btn title="+" kind="ghost" onPress={() => changeSettle(100)} />
        </View>
        <View style={styles.log}>
          {log.length ? (
            log.slice(0, 25).map((e, i) => (
              <View key={i} style={styles.logRow}>
                <Text style={styles.logTime}>{new Date(e.t).toLocaleTimeString()}</Text>
                <Text style={styles.logApp}>{appNames[e.app] ?? e.app}</Text>
                <Text style={[styles.logNote, { color: e.counted ? colors.good : colors.textDim }]}>{e.note}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.hint}>No scroll events yet{status?.serviceRunning ? '' : ' (swipe counting is not running)'}.</Text>
          )}
        </View>
        <View style={{ marginTop: 10, alignSelf: 'flex-start' }}>
          <Btn
            title="Clear log"
            kind="ghost"
            onPress={() => {
              Doomscroll.clearDebugLog();
              loadLog();
            }}
          />
        </View>
      </Card>

      <Card title="Privacy">
        <Text style={styles.hint}>
          Only scroll and app-switch events from Instagram, YouTube and Facebook are counted. No screen text is read, nothing is tapped for you, and all numbers stay on
          this phone. Nothing is uploaded anywhere.
        </Text>
      </Card>
    </ScrollView>
  );
}

type State = 'ok' | 'warn' | 'off' | 'unknown';
function Step({ state, text, action }: { state: State; text: string; action: ReactNode }) {
  const color = state === 'ok' ? colors.good : state === 'warn' ? colors.warn : state === 'off' ? colors.bad : colors.textDim;
  const label = state === 'ok' ? 'On' : state === 'warn' ? 'Check' : state === 'off' ? 'Off' : '…';
  return (
    <View style={styles.step}>
      <View style={[styles.pill, { borderColor: color }]}>
        <Text style={[styles.pillText, { color }]}>{label}</Text>
      </View>
      <Text style={styles.stepText}>{text}</Text>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, paddingBottom: 32 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pill: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, minWidth: 48, alignItems: 'center' },
  pillText: { fontSize: 12, fontWeight: '700' },
  stepText: { color: colors.text, fontSize: 14, flex: 1, lineHeight: 19 },
  hint: { color: colors.textDim, fontSize: 12, lineHeight: 18, marginTop: 10 },
  error: { color: colors.bad, fontSize: 12, marginTop: 8 },
  crash: { color: colors.bad, fontSize: 11, fontFamily: 'monospace', lineHeight: 15 },
  counted: { color: colors.textDim, fontSize: 11 },
  settleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  settleLabel: { color: colors.text, fontSize: 14, flex: 1 },
  settleValue: { color: colors.text, fontSize: 14, fontWeight: '700', minWidth: 64, textAlign: 'center' },
  log: { marginTop: 12, backgroundColor: colors.bg, borderRadius: 10, padding: 10 },
  logRow: { flexDirection: 'row', paddingVertical: 3 },
  logTime: { color: colors.textDim, fontSize: 12, width: 92 },
  logApp: { color: colors.text, fontSize: 12, width: 84 },
  logNote: { fontSize: 12, flex: 1 },
});
