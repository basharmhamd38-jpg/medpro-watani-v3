// نص غني مشترك: يدعم **عريض** داخل النص (مستخرج من شاشتي البنوك — W44)
import React from 'react';
import { StyleSheet, type TextStyle } from 'react-native';
import { AppText as Text } from './AppText';

const styles = StyleSheet.create({
  bold: { fontFamily: 'tajawal', fontWeight: '800' },
});

export default function RichText({
  text,
  style,
}: {
  text: string;
  style?: TextStyle;
}) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <Text style={style}>
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**') ? (
          <Text key={i} style={styles.bold}>
            {p.slice(2, -2)}
          </Text>
        ) : (
          <Text key={i}>{p}</Text>
        ),
      )}
    </Text>
  );
}
