import { useRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { appColors, APPS, colors } from './theme';
import { hourLabel, num, shortDate, weekday } from './format';
import { levelColor, type DayStats, type Totals } from './stats';
import type { AppId } from '../modules/doomscroll';

const pctW = (n: number) => `${Math.min(100, Math.max(0, n))}%` as const;

const CHART_H = 160;
const VALUE_H = 16;
const LABEL_H = 34;
const COL_H = VALUE_H + CHART_H + LABEL_H;

/** Daily reels bars, coloured vs average, with dashed average line. Scrolls when many days. */
export function DailyBars({ days, avg, today }: { days: DayStats[]; avg: number | null; today: string }) {
  const ref = useRef<ScrollView>(null);
  const max = Math.max(1, avg ?? 0, ...days.map((d) => d.reels)) * 1.1;
  const y = (v: number) => (v / max) * CHART_H;
  const colW = days.length <= 7 ? undefined : 30;

  return (
    <View style={{ height: COL_H }}>
      {avg ? (
        <View style={[st.avgLine, { bottom: LABEL_H + y(avg) }]}>
          <Text style={st.avgLabel}>avg {num(avg)}</Text>
        </View>
      ) : null}
      <ScrollView
        ref={ref}
        horizontal
        showsHorizontalScrollIndicator={false}
        onContentSizeChange={() => ref.current?.scrollToEnd({ animated: false })}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        {days.map((d) => {
          const isToday = d.day === today;
          const color = isToday ? colors.accent : levelColor(d.reels, avg, colors);
          return (
            <View key={d.day} style={[st.col, colW ? { width: colW } : { flex: 1 }]}>
              <Text style={st.val}>{d.reels ? num(d.reels) : ''}</Text>
              <View style={[st.bar, { height: Math.max(3, y(d.reels)), backgroundColor: color, opacity: isToday ? 0.7 : 1 }]} />
              <Text style={[st.lab, isToday && { color: colors.text }]}>
                {days.length <= 7 ? weekday(d.day) : shortDate(d.day).split(' ')[1]}
                {'\n'}
                {days.length <= 7 ? shortDate(d.day).split(' ')[1] : shortDate(d.day).split(' ')[0].slice(0, 3)}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

/** 24 small bars of average reels per hour. */
export function HourBars({ values, peak }: { values: number[]; peak: number | null }) {
  const max = Math.max(1, ...values);
  return (
    <View>
      <View style={st.hourRow}>
        {values.map((v, i) => (
          <View key={i} style={st.hourCol}>
            <View
              style={{
                height: Math.max(2, (v / max) * 70),
                borderRadius: 2,
                backgroundColor: i === peak ? colors.bad : colors.surfaceAlt,
              }}
            />
          </View>
        ))}
      </View>
      <View style={st.hourLabels}>
        {[0, 6, 12, 18].map((h) => (
          <Text key={h} style={st.hourLabel}>
            {hourLabel(h)}
          </Text>
        ))}
        <Text style={st.hourLabel}>12 AM</Text>
      </View>
    </View>
  );
}

/** One stacked bar showing how reels split across apps. */
export function AppSplit({ perApp, metric = 'reels' }: { perApp: Record<AppId, Totals>; metric?: keyof Totals }) {
  const total = APPS.reduce((s, a) => s + perApp[a][metric], 0);
  if (!total) return <View style={[st.split, { backgroundColor: colors.surfaceAlt }]} />;
  return (
    <View style={st.split}>
      {APPS.map((a) =>
        perApp[a][metric] > 0 ? <View key={a} style={{ flex: perApp[a][metric], backgroundColor: appColors[a] }} /> : null,
      )}
    </View>
  );
}

/** Horizontal progress bar: today vs a marker (usual by now). */
export function PaceBar({ value, marker, full }: { value: number; marker: number | null; full: number | null }) {
  const max = Math.max(1, value, marker ?? 0, full ?? 0) * 1.08;
  const color = levelColor(value, marker, colors);
  return (
    <View style={st.paceWrap}>
      <View style={st.paceTrack}>
        <View style={[st.paceFill, { width: pctW((value / max) * 100), backgroundColor: color }]} />
        {marker ? <View style={[st.paceMarker, { left: pctW((marker / max) * 100) }]} /> : null}
        {full ? <View style={[st.paceMarker, st.paceMarkerFull, { left: pctW((full / max) * 100) }]} /> : null}
      </View>
      <View style={st.paceLegend}>
        {marker ? <Text style={st.paceLegendText}>┃ usual by now {num(marker)}</Text> : null}
        {full ? <Text style={st.paceLegendText}>┆ daily avg {num(full)}</Text> : null}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  avgLine: { position: 'absolute', left: 0, right: 0, borderTopWidth: 1, borderStyle: 'dashed', borderTopColor: colors.textDim, zIndex: 1 },
  avgLabel: { position: 'absolute', right: 0, top: -15, color: colors.textDim, fontSize: 10 },
  col: { height: COL_H, alignItems: 'center', justifyContent: 'flex-end', paddingHorizontal: 3 },
  val: { color: colors.textDim, fontSize: 9, height: VALUE_H - 2, marginBottom: 2 },
  bar: { width: '70%', maxWidth: 28, minWidth: 10, borderTopLeftRadius: 5, borderTopRightRadius: 5, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 },
  lab: { color: colors.textDim, fontSize: 10, textAlign: 'center', height: LABEL_H - 6, marginTop: 6, lineHeight: 13 },
  hourRow: { flexDirection: 'row', alignItems: 'flex-end', height: 72, gap: 2 },
  hourCol: { flex: 1, justifyContent: 'flex-end' },
  hourLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  hourLabel: { color: colors.textDim, fontSize: 9 },
  split: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', gap: 2 },
  paceWrap: { marginTop: 14 },
  paceTrack: { height: 12, borderRadius: 6, backgroundColor: colors.surfaceAlt, overflow: 'visible', justifyContent: 'center' },
  paceFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 6 },
  paceMarker: { position: 'absolute', top: -4, bottom: -4, width: 2, marginLeft: -1, backgroundColor: colors.text },
  paceMarkerFull: { backgroundColor: colors.textDim, width: 1 },
  paceLegend: { flexDirection: 'row', gap: 14, marginTop: 8 },
  paceLegendText: { color: colors.textDim, fontSize: 11 },
});
