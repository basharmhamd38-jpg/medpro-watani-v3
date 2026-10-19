// تفكيك الشرح الخماسي إلى أقسامه الخمسة — متسامح مع الصيغ المختلفة للعناوين
// يعتمد على الترقيم (1..5) لا على نص العنوان، فيدعم: «لماذا باقي الخيارات خاطئة؟»
// و«لماذا باقي الخيارات صحيحة؟» (أسئلة ما عدا) والصيغ القديمة.
import type { ExplanationParts, WrongOption } from './types';

const HEADER_RE = /^(\d+)\.\s*(.+)$/;
// سطر خيار: - **اسم الخيار:** السبب  أو  - اسم الخيار: السبب
const BULLET_RE = /^-\s*(?:\*\*(.+?)\*\*\s*:?\s*|\s*)(.+)$/;

const DEFAULT_TITLES = [
  'لماذا الإجابة صحيحة؟',
  'لماذا باقي الخيارات خاطئة؟',
  'خذها معك',
  'لماذا؟',
  'تصور بصري',
];

function cleanInline(s: string): string {
  return s.replace(/\*\*(.+?)\*\*/g, '$1').trim();
}

function parseWrongOptions(body: string): WrongOption[] {
  const out: WrongOption[] = [];
  for (const rawLine of body.split('\n')) {
    const line = rawLine.trim();
    if (!line.startsWith('-')) continue;
    const m = line.match(BULLET_RE);
    if (!m) continue;
    const option = cleanInline(m[1] || '').replace(/[:：]\s*$/, '');
    const reason = cleanInline(m[2] || '');
    if (option && reason) out.push({ option, reason });
    else if (reason) out.push({ option: '', reason });
  }
  return out;
}

export function parseExplanation(text: string): ExplanationParts {
  const sections: Record<number, { title: string; body: string }> = {};
  let current = 0;
  let buf: string[] = [];
  const titles = [...DEFAULT_TITLES];

  const flush = () => {
    if (current >= 1 && current <= 5) {
      const prev = sections[current];
      const body = buf.join('\n').trim();
      sections[current] = { title: prev?.title ?? '', body: prev ? `${prev.body}\n${body}`.trim() : body };
    }
    buf = [];
  };

  for (const rawLine of String(text || '').split('\n')) {
    const line = rawLine.trimEnd();
    const m = line.trim().match(HEADER_RE);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n >= 1 && n <= 5) {
        flush();
        current = n;
        titles[n - 1] = cleanInline(m[2]).replace(/[:：]\s*$/, '') || titles[n - 1];
        sections[n] = { title: titles[n - 1], body: '' };
        continue;
      }
    }
    if (current >= 1) buf.push(line);
  }
  flush();

  const s1 = sections[1]?.body ?? '';
  const s2 = sections[2]?.body ?? '';
  const wrongOptions = parseWrongOptions(s2);

  return {
    titles,
    whyCorrect: s1,
    whyOthersWrong: s2,
    wrongOptions,
    takeaway: sections[3]?.body ?? '',
    why: sections[4]?.body ?? '',
    visual: sections[5]?.body ?? '',
  };
}

// هل الشرح يحوي الأقسام الخمسة فعلًا؟
export function hasFullExplanation(text: string): boolean {
  if (!text) return false;
  const p = parseExplanation(text);
  return [p.whyCorrect, p.whyOthersWrong, p.takeaway, p.why, p.visual].filter(Boolean).length >= 3;
}
