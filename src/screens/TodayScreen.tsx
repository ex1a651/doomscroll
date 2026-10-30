import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { appColors, appNames, APPS, colors } from '../theme';
import { dur, num } from '../format';
import { levelColor, type Model } from '../stats';
import type { Status } from '../../modules/doomscroll';
import { AppSplit, PaceBar } from '../charts';
import { Card, Delta, Tile } from '../ui';

type Props = { model: Model; status: Status | null; refreshing: boolean; onRefresh: () => void; goSetup: () => void };

export default function TodayScreen({ model, status, refreshing, onRefresh, goSetup }: Props) {
  const { today, usualByNow, avg7, wins } = model;
  const trackingOff = status && (!status.serviceRunning || !status.usageAccess);
  const heroColor = usualByNow !== null ? levelColor(today.reels, usualByNow, colors) : colors.text;

  let paceText = 'Your averages appear after your first full day.';
  if (usualByNow !== null) {
    const diff = today.reels - usualByNow;
    if (Math.abs(diff) < 1) paceText = 'Right on your usual pace';
    else if (diff < 0) paceText = `${num(-diff)} fewer than usual by this time 👏`;
    else paceText = `${num(diff)} more than usual by this time`;
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} progressBackgroundColor={colors.surface} />}
    >
      {trackingOff ? (
        <Pressable onPress={goSetup} style={styles.banner}>
          <Text style={styles.bannerTitle}>Tracking isn't fully on</Text>
          <Text style={styles.bannerText}>Tap to finish setup in the Setup tab →</Text>
        </Pressable>
      ) : null}

      <Card>
        <Text style={styles.heroLabel}>TODAY SO FAR</Text>
        <View style={styles.heroRow}>
          <Text style={[styles.heroNum, { color: heroColor }]}>{num(today.reels)}</Text>
          <Text style={styles.heroUnit}>reels{'\n'}watched</Text>
        </View>
        <Text style={[styles.pace, { color: usualByNow !== null && today.reels < usualByNow ? colors.good : colors.textDim }]}>{paceText}</Text>
        <PaceBar value={today.reels} marker={usualByNow} full={avg7?.reels ?? null} />
      </Card>

      <View style={styles.tiles}>
        <Tile label="Time" value={dur(today.fgMs)} sub={avg7 ? `avg ${dur(avg7.fgMs)}` : undefined} />
        <Tile label="Opens" value={num(today.opens)} sub={avg7 ? `avg ${num(avg7.opens)}` : undefined} />
        <Tile label="Swipes" value={num(today.swipes)} sub={avg7 ? `avg ${num(avg7.swipes)}` : undefined} />
      </View>

      <Card title="Wins">
        {wins.length ? (
          wins.map((w, i) => (
            <View key={i} style={[styles.win, i > 0 && styles.winBorder]}>
              <Text style={styles.winIcon}>{w.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.winTitle}>{w.title}</Text>
                <Text style={styles.winDetail}>{w.detail}</Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.noWins}>
            {model.completed.length
              ? 'No wins yet today. Stay under your usual pace to earn one.'
              : 'Wins unlock once you have a day of history: streaks, lowest days, week-over-week drops.'}
          </Text>
        )}
      </Card>

      <Card title="Today by app">
        <AppSplit perApp={today.perApp} />
        <View style={{ marginTop: 12, gap: 10 }}>
          {APPS.map((a) => {
            const t = today.perApp[a];
            return (
              <View key={a} style={styles.appRow}>
                <View style={[styles.dot, { backgroundColor: appColors[a] }]} />
                <Text style={styles.appName}>{appNames[a]}</Text>
                <Text style={styles.appStat}>{num(t.reels)} reels</Text>
                <Text style={styles.appStatDim}>{dur(t.fgMs)}</Text>
                <Text style={styles.appStatDim}>{num(t.opens)}×</Text>
              </View>
            );
          })}
        </View>
      </Card>

      {model.yesterday ? (
        <Card title="Yesterday">
          <View style={styles.yRow}>
            <YStat label="Reels" value={num(model.yesterday.reels)} cur={model.yesterday.reels} base={avg7?.reels} />
            <YStat label="Time" value={dur(model.yesterday.fgMs)} cur={model.yesterday.fgMs} base={avg7?.fgMs} />
            <YStat label="Opens" value={num(model.yesterday.opens)} cur={model.yesterday.opens} base={avg7?.opens} />
          </View>
          <Text style={styles.yNote}>vs your 7-day average</Text>
        </Card>
      ) : null}
    </ScrollView>
  );
}

function YStat({ label, value, cur, base }: { label: string; value: string; cur: number; base: number | undefined }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.yLabel}>{label}</Text>
      <Text style={styles.yValue}>{value}</Text>
      <Delta cur={cur} base={base} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, paddingBottom: 32 },
  banner: { backgroundColor: '#3A2A12', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#6B4B16' },
  bannerTitle: { color: colors.warn, fontWeight: '700' },
  bannerText: { color: colors.text, fontSize: 13, marginTop: 2 },
  heroLabel: { color: colors.textDim, fontSize: 12, fontWeight: '600', letterSpacing: 1 },
  heroRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 4 },
  heroNum: { fontSize: 64, fontWeight: '800', lineHeight: 70 },
  heroUnit: { color: colors.textDim, fontSize: 14, marginBottom: 10, lineHeight: 18 },
  pace: { fontSize: 14, fontWeight: '600', marginTop: 2 },
  tiles: { flexDirection: 'row', gap: 8 },
  win: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  winBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  winIcon: { fontSize: 24 },
  winTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  winDetail: { color: colors.textDim, fontSize: 12, marginTop: 1 },
  noWins: { color: colors.textDim, lineHeight: 20 },
  appRow: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  appName: { color: colors.text, fontSize: 14, flex: 1 },
  appStat: { color: colors.text, fontSize: 14, fontWeight: '600', width: 80, textAlign: 'right' },
  appStatDim: { color: colors.textDim, fontSize: 13, width: 58, textAlign: 'right' },
  yRow: { flexDirection: 'row', gap: 8 },
  yLabel: { color: colors.textDim, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8 },
  yValue: { color: colors.text, fontSize: 20, fontWeight: '700', marginVertical: 2 },
  yNote: { color: colors.textDim, fontSize: 11, marginTop: 10 },
});
