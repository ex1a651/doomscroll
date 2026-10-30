import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import { dur, hourLabel, num, shortDate, todayKey, weekday } from '../format';
import { mean, type Model, type Totals } from '../stats';
import { DailyBars, HourBars } from '../charts';
import { Card, Delta, Empty, Segmented, Tile } from '../ui';

type Range = '7' | '14' | '30';
type Props = { model: Model; refreshing: boolean; onRefresh: () => void };

export default function TrendsScreen({ model, refreshing, onRefresh }: Props) {
  const [range, setRange] = useState<Range>('7');
  const n = Number(range);
  const shown = model.days.slice(-n);
  const rangeAvg = mean(model.completed.slice(-n));
  const { week } = model;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} progressBackgroundColor={colors.surface} />}
    >
      <Segmented
        options={[
          { key: '7', label: '7 days' },
          { key: '14', label: '14 days' },
          { key: '30', label: '30 days' },
        ]}
        value={range}
        onChange={setRange}
      />

      <Card title="Reels per day" right={<Text style={styles.legend}>green = under avg</Text>}>
        {model.hasData ? <DailyBars days={shown} avg={rangeAvg?.reels ?? null} today={todayKey()} /> : <Empty text="No data yet. Swipe some reels and come back." />}
      </Card>

      <Card title="Daily averages">
        <AvgRow label="Reels" pick={(t) => num(t.reels)} model={model} />
        <AvgRow label="Time" pick={(t) => dur(t.fgMs)} model={model} />
        <AvgRow label="Opens" pick={(t) => num(t.opens)} model={model} />
        <AvgRow label="Swipes" pick={(t) => num(t.swipes)} model={model} last />
      </Card>

      <Card title="This week vs last week">
        {week.prev ? (
          <>
            <CompareRow label="Reels / day" cur={week.cur.reels} prev={week.prev.reels} fmt={num} />
            <CompareRow label="Time / day" cur={week.cur.fgMs} prev={week.prev.fgMs} fmt={dur} />
            <CompareRow label="Opens / day" cur={week.cur.opens} prev={week.prev.opens} fmt={num} last />
            <Text style={styles.note}>
              Last {week.curDays} full days vs the {week.prevDays} before
            </Text>
          </>
        ) : (
          <Empty text="Needs 8+ days of history. Keep going!" />
        )}
      </Card>

      <View style={styles.tiles}>
        <Tile
          label="Best day 🏆"
          value={model.best ? num(model.best.reels) : '–'}
          sub={model.best ? `${weekday(model.best.day)} ${shortDate(model.best.day)}` : 'needs history'}
        />
        <Tile
          label="Worst day"
          value={model.worst ? num(model.worst.reels) : '–'}
          sub={model.worst ? `${weekday(model.worst.day)} ${shortDate(model.worst.day)}` : 'needs history'}
        />
        <Tile label="Streak 🔥" value={`${model.streak}`} sub="days ≤ avg" />
      </View>

      <Card title="When you scroll">
        {model.peakHour !== null ? (
          <>
            <Text style={styles.peak}>
              Peak hour: <Text style={{ color: colors.bad }}>{hourLabel(model.peakHour)}</Text>
            </Text>
            <Text style={styles.note}>Average reels per hour, last 14 days. Your danger zone is red.</Text>
            <View style={{ marginTop: 12 }}>
              <HourBars values={model.hourlyAvg} peak={model.peakHour} />
            </View>
          </>
        ) : (
          <Empty text="Hourly pattern appears after your first full day." />
        )}
      </Card>
    </ScrollView>
  );
}

function AvgRow({ label, pick, model, last }: { label: string; pick: (t: Totals) => string; model: Model; last?: boolean }) {
  const cell = (t: Totals | null) => <Text style={styles.avgCell}>{t ? pick(t) : '–'}</Text>;
  return (
    <>
      {label === 'Reels' ? (
        <View style={styles.avgHead}>
          <Text style={[styles.avgLabel, { flex: 1.2 }]} />
          <Text style={styles.avgHeadCell}>7 days</Text>
          <Text style={styles.avgHeadCell}>30 days</Text>
          <Text style={styles.avgHeadCell}>All time</Text>
        </View>
      ) : null}
      <View style={[styles.avgRow, !last && styles.rowBorder]}>
        <Text style={[styles.avgLabel, { flex: 1.2 }]}>{label}</Text>
        {cell(model.avg7)}
        {cell(model.avg30)}
        {cell(model.avgAll)}
      </View>
    </>
  );
}

function CompareRow({ label, cur, prev, fmt, last }: { label: string; cur: number; prev: number; fmt: (n: number) => string; last?: boolean }) {
  return (
    <View style={[styles.cmpRow, !last && styles.rowBorder]}>
      <Text style={styles.cmpLabel}>{label}</Text>
      <Text style={styles.cmpPrev}>{fmt(prev)}</Text>
      <Text style={styles.cmpArrow}>→</Text>
      <Text style={styles.cmpCur}>{fmt(cur)}</Text>
      <View style={styles.cmpDelta}>
        <Delta cur={cur} base={prev} size={13} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, paddingBottom: 32 },
  legend: { color: colors.textDim, fontSize: 11 },
  tiles: { flexDirection: 'row', gap: 8 },
  avgHead: { flexDirection: 'row', paddingBottom: 6 },
  avgHeadCell: { flex: 1, color: colors.textDim, fontSize: 11, textAlign: 'right' },
  avgRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  avgLabel: { color: colors.textDim, fontSize: 14 },
  avgCell: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '600', textAlign: 'right' },
  cmpRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  cmpLabel: { color: colors.textDim, fontSize: 14, flex: 1 },
  cmpPrev: { color: colors.textDim, fontSize: 14, width: 64, textAlign: 'right' },
  cmpArrow: { color: colors.textDim, width: 22, textAlign: 'center' },
  cmpCur: { color: colors.text, fontSize: 15, fontWeight: '700', width: 64 },
  cmpDelta: { width: 58, alignItems: 'flex-end' },
  note: { color: colors.textDim, fontSize: 11, marginTop: 8 },
  peak: { color: colors.text, fontSize: 18, fontWeight: '700' },
});
