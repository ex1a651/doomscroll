import { ReactNode } from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, radius } from './theme';
import { pct } from './format';

export function Card({ children, style, title, right }: { children: ReactNode; style?: StyleProp<ViewStyle>; title?: string; right?: ReactNode }) {
  return (
    <View style={[s.card, style]}>
      {title ? (
        <View style={s.cardHead}>
          <Text style={s.cardTitle}>{title}</Text>
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}

/** Change badge where LOWER is better (down = green). */
export function Delta({ cur, base, size = 12 }: { cur: number; base: number | null | undefined; size?: number }) {
  if (base === null || base === undefined || base <= 0) return null;
  const f = (cur - base) / base;
  if (Math.abs(f) < 0.005) return <Text style={[s.delta, { color: colors.textDim, fontSize: size }]}>±0%</Text>;
  const good = f < 0;
  return (
    <Text style={[s.delta, { color: good ? colors.good : colors.bad, fontSize: size }]}>
      {good ? '▼' : '▲'} {pct(f).replace(/^[+−]/, '')}
    </Text>
  );
}

export function Tile({ label, value, sub, extra }: { label: string; value: string; sub?: string; extra?: ReactNode }) {
  return (
    <View style={s.tile}>
      <Text style={s.tileLabel}>{label}</Text>
      <Text style={s.tileValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {extra}
      {sub ? <Text style={s.tileSub}>{sub}</Text> : null}
    </View>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { key: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={s.seg}>
      {options.map((o) => (
        <Pressable key={o.key} onPress={() => onChange(o.key)} style={[s.segItem, value === o.key && s.segItemActive]}>
          <Text style={[s.segText, value === o.key && s.segTextActive]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Btn({ title, onPress, kind = 'primary' }: { title: string; onPress: () => void; kind?: 'primary' | 'ghost' }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.btn, kind === 'primary' ? s.btnPrimary : s.btnGhost, pressed && { opacity: 0.75 }]}>
      <Text style={[s.btnText, kind === 'ghost' && { color: colors.accent }]}>{title}</Text>
    </Pressable>
  );
}

export function Empty({ text }: { text: string }) {
  return <Text style={s.empty}>{text}</Text>;
}

export const s = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius, borderWidth: 1, borderColor: colors.border, padding: 16 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  cardTitle: { color: colors.textDim, fontSize: 12, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' },
  delta: { fontWeight: '700' },
  tile: { flex: 1, backgroundColor: colors.surface, borderRadius: radius, borderWidth: 1, borderColor: colors.border, padding: 12 },
  tileLabel: { color: colors.textDim, fontSize: 10, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase' },
  tileValue: { color: colors.text, fontSize: 22, fontWeight: '700', marginTop: 6 },
  tileSub: { color: colors.textDim, fontSize: 11, marginTop: 2 },
  seg: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 10, padding: 3, borderWidth: 1, borderColor: colors.border },
  segItem: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 8 },
  segItemActive: { backgroundColor: colors.surfaceAlt },
  segText: { color: colors.textDim, fontSize: 13, fontWeight: '600' },
  segTextActive: { color: colors.text },
  btn: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: 10, alignItems: 'center' },
  btnPrimary: { backgroundColor: colors.accent },
  btnGhost: { borderWidth: 1, borderColor: colors.border },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  empty: { color: colors.textDim, textAlign: 'center', paddingVertical: 16, lineHeight: 20 },
});
