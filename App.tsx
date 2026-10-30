import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Doomscroll, { type DailyRow, type HourlyRow, type Status } from './modules/doomscroll';
import { colors } from './src/theme';
import { addDays, todayKey } from './src/format';
import { buildModel } from './src/stats';
import TodayScreen from './src/screens/TodayScreen';
import TrendsScreen from './src/screens/TrendsScreen';
import AppsScreen from './src/screens/AppsScreen';
import SetupScreen from './src/screens/SetupScreen';

type Tab = 'today' | 'trends' | 'apps' | 'setup';
const TABS: { key: Tab; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'trends', label: 'Trends' },
  { key: 'apps', label: 'Apps' },
  { key: 'setup', label: 'Setup' },
];

export default function App() {
  const [tab, setTab] = useState<Tab>('today');
  const [rows, setRows] = useState<DailyRow[]>([]);
  const [hourly, setHourly] = useState<HourlyRow[]>([]);
  const [status, setStatus] = useState<Status | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [tick, setTick] = useState(0);
  const loading = useRef(false);

  const load = useCallback(async (showSpinner = false) => {
    if (loading.current) return;
    loading.current = true;
    if (showSpinner) setRefreshing(true);
    try {
      setStatus(Doomscroll.getStatus());
      await Doomscroll.syncUsage(7);
      const today = todayKey();
      const [d, h] = await Promise.all([Doomscroll.getDaily(addDays(today, -89), today), Doomscroll.getHourly(addDays(today, -15), today)]);
      setRows(d);
      setHourly(h);
      setTick((t) => t + 1);
    } catch (e) {
      console.warn('load failed', e);
    } finally {
      loading.current = false;
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') load();
    });
    const id = setInterval(() => load(), 60_000);
    return () => {
      sub.remove();
      clearInterval(id);
    };
  }, [load]);

  // Refresh when switching tabs (cheap) so numbers feel live.
  useEffect(() => {
    load();
  }, [tab, load]);

  const model = useMemo(() => buildModel(rows, hourly), [rows, hourly, tick]);
  const onRefresh = () => load(true);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <StatusBar style="light" />
        <View style={styles.headerRow}>
          <Text style={styles.header}>Doomscroll</Text>
          {model.streak >= 2 ? <Text style={styles.streak}>🔥 {model.streak}</Text> : null}
        </View>

        <View style={styles.tabBar}>
          {TABS.map((t) => (
            <Pressable key={t.key} onPress={() => setTab(t.key)} style={styles.tab}>
              <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
              <View style={[styles.tabIndicator, tab === t.key && styles.tabIndicatorActive]} />
            </Pressable>
          ))}
        </View>

        <View style={styles.body}>
          {tab === 'today' && <TodayScreen model={model} status={status} refreshing={refreshing} onRefresh={onRefresh} goSetup={() => setTab('setup')} />}
          {tab === 'trends' && <TrendsScreen model={model} refreshing={refreshing} onRefresh={onRefresh} />}
          {tab === 'apps' && <AppsScreen model={model} refreshing={refreshing} onRefresh={onRefresh} />}
          {tab === 'setup' && <SetupScreen status={status} refreshing={refreshing} onRefresh={onRefresh} />}
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  header: { color: colors.text, fontSize: 28, fontWeight: '700' },
  streak: { color: colors.warn, fontSize: 18, fontWeight: '700' },
  body: { flex: 1 },
  tabBar: { flexDirection: 'row', paddingHorizontal: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  tab: { flex: 1, alignItems: 'center', paddingTop: 8 },
  tabText: { color: colors.textDim, fontSize: 14, fontWeight: '500' },
  tabTextActive: { color: colors.text },
  tabIndicator: { height: 3, alignSelf: 'stretch', marginHorizontal: 14, borderTopLeftRadius: 2, borderTopRightRadius: 2, marginTop: 10, backgroundColor: 'transparent' },
  tabIndicatorActive: { backgroundColor: colors.accent },
});
