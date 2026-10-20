// عارض نصوص خفيف للخلاصات — عناوين + عريض + تعداد فقط (بلا مكتبات ثقيلة)
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText as Text } from '../../components/AppText';
import { useTheme, type ThemeColors } from '../../theme';
import { bidi, rtlTextStyle } from '../../utils/bidi';

interface Props {
  text: string;
}

function renderInline(s: string, keyBase: string): React.ReactNode[] {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const parts = s.split(/\*\*(.+?)\*\*/g);
  return parts.map((p, i) =>
    i % 2 === 1 ? (
      <Text key={`${keyBase}-${i}`} style={styles.bold}>
        {bidi(p)}
      </Text>
    ) : (
      <Text key={`${keyBase}-${i}`}>{bidi(p)}</Text>
    ),
  );
}

export default function Markdown({ text }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const blocks = useMemo(() => {
    const out: { key: string; kind: string; content: string }[] = [];
    const lines = String(text || '').split('\n');
    let buf: string[] = [];
    let kind = 'p';
    const flush = (k: number) => {
      if (buf.length) out.push({ key: `b${k}`, kind, content: buf.join('\n') });
      buf = [];
      kind = 'p';
    };
    let k = 0;
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) {
        flush(k++);
        continue;
      }
      if (/^#{2,4}\s/.test(line)) {
        flush(k++);
        out.push({ key: `b${k++}`, kind: 'h', content: line.replace(/^#{2,4}\s*/, '') });
        continue;
      }
      if (/^>\s?/.test(line)) {
        flush(k++);
        out.push({ key: `b${k++}`, kind: 'q', content: line.replace(/^>\s?/, '') });
        continue;
      }
      if (/^([-*•]|\d+[.)])\s/.test(line)) {
        if (kind !== 'li') flush(k++);
        kind = 'li';
        buf.push(line.replace(/^([-*•]|\d+[.)])\s*/, ''));
        continue;
      }
      if (kind === 'li') flush(k++);
      buf.push(line);
    }
    flush(k);
    return out;
  }, [text]);

  return (
    <View>
      {blocks.map(b => {
        if (b.kind === 'h')
          return (
            <Text key={b.key} style={styles.h}>
              {renderInline(b.content, b.key)}
            </Text>
          );
        if (b.kind === 'q')
          return (
            <View key={b.key} style={styles.quote}>
              <Text style={styles.quoteText}>{renderInline(b.content, b.key)}</Text>
            </View>
          );
        if (b.kind === 'li')
          return (
            <View key={b.key} style={styles.liRow}>
              <Text style={styles.liDot}>•</Text>
              <Text style={styles.liText}>{renderInline(b.content.replace(/\n/g, ' '), b.key)}</Text>
            </View>
          );
        return (
          <Text key={b.key} style={styles.p}>
            {renderInline(b.content, b.key)}
          </Text>
        );
      })}
    </View>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  h: {
    fontFamily: 'tajawal',
    fontSize: 16.5,
    fontWeight: '700',
    color: colors.burgundy,
    marginTop: 14,
    marginBottom: 6,
    ...rtlTextStyle,
  },
  p: {
    fontFamily: 'tajawal',
    fontSize: 14.5,
    lineHeight: 24,
    color: colors.text,
    marginBottom: 8,
    ...rtlTextStyle,
  },
  bold: {
          fontFamily: 'tajawal', fontWeight: '700', color: colors.title, ...rtlTextStyle },
  liRow: { flexDirection: 'row', marginBottom: 6, paddingEnd: 4 },
  liDot: {
           fontFamily: 'tajawal', color: colors.burgundyLight, fontSize: 14, marginTop: 2, width: 14, textAlign: 'center' },
  liText: {
    flex: 1,
    fontFamily: 'tajawal',
    fontSize: 14.5,
    lineHeight: 24,
    color: colors.text,
    ...rtlTextStyle,
  },
  quote: {
    borderRightWidth: 3,
    borderRightColor: colors.explainBorder,
    backgroundColor: colors.explainBg,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  quoteText: {},
});
