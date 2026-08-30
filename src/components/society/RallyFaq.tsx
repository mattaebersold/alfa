import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, LayoutAnimation, Platform, UIManager } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { useColors } from '../../hooks/useColors';
import type { RallyFaqItem } from '../../types/api';

// LayoutAnimation is opt-in on Android's old architecture; harmless where it's
// already on.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/**
 * The rally's FAQ as expandable rows, in the order the admin arranged them.
 *
 * Several can be open at once: these are independent questions, and closing one
 * to read another would lose your place.
 *
 * Mirrors murray's components/pages/rallys/RallyFaq.js.
 */
export default function RallyFaq({ faqs = [] }: { faqs?: RallyFaqItem[] }) {
  const c = useColors();
  const [open, setOpen] = useState<Set<number>>(() => new Set());

  const items = faqs.filter((faq) => faq?.question);
  if (items.length === 0) return null;

  const toggle = (i: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  return (
    <View style={styles.section}>
      <Text style={[styles.heading, { color: c.fg }]}>FAQ</Text>

      <View style={[styles.list, { backgroundColor: c.card, borderColor: c.border }]}>
        {items.map((faq, i) => {
          const isOpen = open.has(i);
          return (
            <View
              key={i}
              style={[
                styles.item,
                i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
              ]}
            >
              <TouchableOpacity
                style={styles.question}
                onPress={() => toggle(i)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityState={{ expanded: isOpen }}
                accessibilityLabel={faq.question}
              >
                <Text style={[styles.questionText, { color: c.fg }]}>{faq.question}</Text>
                <ChevronDown
                  size={16}
                  color={c.grey}
                  style={{ transform: [{ rotate: isOpen ? '180deg' : '0deg' }] }}
                />
              </TouchableOpacity>

              {isOpen && faq.answer ? (
                // Line breaks typed into the admin form are the answer's only
                // structure, and Text keeps them as written.
                <Text style={[styles.answer, { color: c.muted }]}>{faq.answer}</Text>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section:  { paddingHorizontal: 16, paddingTop: 28 },
  heading:  { fontSize: 20, fontWeight: '800', marginBottom: 12 },
  list:     { borderRadius: 14, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  item:     {},
  question: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: 12, paddingHorizontal: 16, paddingVertical: 15,
  },
  questionText: { flex: 1, fontSize: 15, fontWeight: '700' },
  answer:       { fontSize: 14, lineHeight: 21, paddingHorizontal: 16, paddingBottom: 16, marginTop: -2 },
});
