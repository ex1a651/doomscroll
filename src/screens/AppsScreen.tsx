import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { appColors, appNames, APPS, colors } from '../theme';
import { dur, num } from '../format';
import { perAppSum, type Model, type Totals } from '../stats';
import { AppSplit } from '../charts';
import { Card, Segmented } from '../ui';
import type { AppId } from '../../modules/doomscroll';

type Range = 'today' | '7' | '30';
type Props = { model: Model; refreshing: boolean; onRefresh: () => void };

export default function AppsScreen({ model, refreshing, onRefresh }: Props) {
  const [range, setRange] = useState<Range>('today');
  const days = range === 'today' ? [model.today] : model.days.slice(-Number(range));
  const per = perAppSum(days);
  const nDays = Math.max(1, days.length);
  const ranked = [...APPS].sort((a, b) => per[b].opens - per[a].opens);
  const top = ranked[0];
  const perDay = range !== 'today';

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} progressBackgroundColor={colors.surface} />}
    >
      <Segmented
        options={[
          { key: 'today', label: 'Today' },
          { key: '7', label: '7 days' },
          { key: '30', label: '30 days' },
        ]}
        value={range}
        onChange={setRange}
      />

      <Card title="Opens share">
        <AppSplit perApp={per} metric="opens" />
        <Text style={styles.headline}>
          {per[top].opens > 0 ? (
            <>
              Most opened: <Text style={{ color: appColors[top] }}>{appNames[top]}</Text> · {num(per[top].opens)}×
              {perDay ? ` (${num(per[top].opens / nDays)}/day)` : ''}
            </>
          ) : (
            'No opens recorded yet.'
          )}
        </Text>
      </Card>

      {ranked.map((a) => (
        <AppCard key={a} app={a} t={per[a]} nDays={nDays} perDay={perDay} />
      ))}
    </ScrollView>
  );
}

function AppCard({ app, t, nDays, perDay }: { app: AppId; t: Totals; nDays: number; perDay: boolean }) {
  const avgSession = t.opens ? t.fgMs / t.opens : 0;
  const reelsPerOpen = t.opens ? t.reels / t.opens : 0;
  return (
    <Card>
      <View style={styles.head}>
        <View style={[styles.badge, { backgroundColor: appColors[app] }]}>
          <Text style={styles.badgeText}>{appNames[app][0]}</Text>
        </View>
        <Text style={styles.name}>{appNames[app]}</Text>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.big}>{num(t.opens)}</Text>
          <Text style={styles.bigLabel}>opens{perDay ? ` · ${num(t.opens / nDays)}/day` : ''}</Text>
        </View>
      </View>
      <View style={styles.grid}>
        <Cell label="Time" value={dur(t.fgMs)} sub={perDay ? `${dur(t.fgMs / nDays)}/day` : undefined} />
        <Cell label="Reels" value={num(t.reels)} sub={perDay ? `${num(t.reels / nDays)}/day` : undefined} />
        <Cell label="Swipes" value={num(t.swipes)} />
      </View>
      <View style={styles.grid}>
        <Cell label="Avg visit" value={t.opens ? dur(avgSession) : '–'} />
        <Cell label="Reels / open" value={t.opens ? reelsPerOpen.toFixed(1) : '–'} />
        <Cell label="Sessions" value={num(t.sessions)} sub="with swipes" />
      </View>
    </Card>
  );
}

function Cell({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.cellLabel}>{label}</Text>
      <Text style={styles.cellValue}>{value}</Text>
      {sub ? <Text style={styles.cellSub}>{sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, paddingBottom: 32 },
  headline: { color: colors.text, fontSize: 15, fontWeight: '600', marginTop: 12 },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  badge: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  badgeText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  name: { color: colors.text, fontSize: 17, fontWeight: '700', flex: 1 },
  big: { color: colors.text, fontSize: 26, fontWeight: '800' },
  bigLabel: { color: colors.textDim, fontSize: 11 },
  grid: { flexDirection: 'row', gap: 8, marginTop: 10 },
  cellLabel: { color: colors.textDim, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8 },
  cellValue: { color: colors.text, fontSize: 16, fontWeight: '600', marginTop: 2 },
  cellSub: { color: colors.textDim, fontSize: 11 },
});
