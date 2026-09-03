import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Mail, MessageCircle, ChevronRight } from 'lucide-react-native';
import AppHeader, { useHeaderPad } from '../../components/ui/AppHeader';
import { useHeaderScroll } from '../../hooks/useHeaderScroll';
import Avatar from '../../components/ui/Avatar';
import { useGetPublicUserQuery } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import { useBrandColor, useBrandTextColor } from '../../hooks/useBrandColor';
import { APP_VERSION } from '../../utils/appVersion';
import { ss } from '../../styles/shared';

/**
 * Who to write to when something's wrong.
 *
 * Two people rather than a support@ alias, because that's what the society
 * actually is — mail here is read by a founder, and saying so sets the right
 * expectation about both the tone and the wait.
 */
const CONTACTS = [
  {
    name: 'Matt',
    username: 'matt',
    role: 'Founder',
    email: 'matt@openroadsociety.co',
    blurb: 'The app, your account, bugs, anything technical.',
  },
  {
    name: 'Jessica',
    username: 'jessica',
    role: 'Founder',
    email: 'jessica@openroadsociety.co',
    blurb: 'Membership, events, groups and everything else.',
  },
];

/**
 * A mail draft with the boring part already filled in.
 *
 * The version and platform are what any answer has to start by asking for, and
 * they're the two things a member has no reason to know. Putting them under a
 * divider keeps them out of the way of what the person actually wants to say.
 */
function supportMailUrl(email: string) {
  const subject = 'Open Road Society — support';
  const body = [
    '',
    '',
    '—',
    `App version: ${APP_VERSION || 'unknown'}`,
    `Platform: ${Platform.OS} ${Platform.Version}`,
  ].join('\n');
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** One person, with the photo they already have on the site. */
function ContactCard({ contact }: { contact: (typeof CONTACTS)[number] }) {
  const c = useColors();
  const brand = useBrandColor();
  const brandText = useBrandTextColor();
  const { data: user } = useGetPublicUserQuery(contact.username);

  const write = async () => {
    const url = supportMailUrl(contact.email);
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      // A device with no mail account configured can't open a draft, so the
      // address itself is the fallback — it can still be copied by hand.
      Alert.alert('No mail app', `You can reach ${contact.name} at ${contact.email}`);
      return;
    }
    Linking.openURL(url);
  };

  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.borderDark }]}>
      <View style={styles.cardTop}>
        <Avatar user={user} name={contact.name} size={52} />
        <View style={styles.cardText}>
          <Text style={[styles.cardName, { color: c.fg }]}>{contact.name}</Text>
          <Text style={[styles.cardRole, { color: c.grey }]}>{contact.role}</Text>
        </View>
      </View>

      <Text style={[styles.cardBlurb, { color: c.grey }]}>{contact.blurb}</Text>

      <TouchableOpacity
        style={[styles.mailBtn, { backgroundColor: brand }]}
        onPress={write}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={`Email ${contact.name} at ${contact.email}`}
      >
        <Mail size={15} color={brandText} />
        <Text style={[styles.mailBtnText, { color: brandText }]}>Email {contact.name}</Text>
      </TouchableOpacity>

      <Text style={[styles.cardEmail, { color: c.grey }]}>{contact.email}</Text>
    </View>
  );
}

export default function SupportScreen() {
  const c = useColors();
  const headerPad = useHeaderPad();
  const onScroll = useHeaderScroll(headerPad);

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: c.cream }]} edges={['bottom']}>
      <AppHeader />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: headerPad }]}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { color: c.fg }]}>Support</Text>
        <Text style={[styles.intro, { color: c.grey }]}>
          Something broken, or a question the app doesn't answer? Write to one of
          us — it goes straight to a person, not a queue.
        </Text>

        {CONTACTS.map((contact) => (
          <ContactCard key={contact.email} contact={contact} />
        ))}

        <View style={[styles.tipCard, { backgroundColor: c.card, borderColor: c.borderDark }]}>
          <MessageCircle size={16} color={c.grey} />
          <Text style={[styles.tipText, { color: c.grey }]}>
            If it's a bug, telling us what you tapped and what happened instead
            is usually enough to find it. Your app version goes along
            automatically.
          </Text>
        </View>

        {APP_VERSION ? (
          <Text style={[styles.version, { color: c.grey }]}>Version {APP_VERSION}</Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll:   { paddingHorizontal: 14, paddingBottom: 48 },
  title:    { fontSize: 26, fontWeight: '800', letterSpacing: 0.3, marginBottom: 6 },
  intro:    { fontSize: 14, lineHeight: 20, marginBottom: 18 },

  card: {
    borderRadius: 14, borderWidth: 1,
    padding: 14, marginBottom: 12,
  },
  cardTop:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardText: { flex: 1 },
  cardName: { fontSize: 17, fontWeight: '800' },
  cardRole: { fontSize: 12, fontWeight: '600', marginTop: 1 },
  cardBlurb:{ fontSize: 13, lineHeight: 19, marginTop: 12 },
  mailBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, borderRadius: 999, marginTop: 14,
  },
  mailBtnText: { fontSize: 15, fontWeight: '800' },
  cardEmail: { fontSize: 12, textAlign: 'center', marginTop: 8 },

  tipCard: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    borderRadius: 14, borderWidth: 1, padding: 14, marginTop: 6,
  },
  tipText:  { flex: 1, fontSize: 13, lineHeight: 19 },

  version:  { fontSize: 12, textAlign: 'center', marginTop: 20 },
});
