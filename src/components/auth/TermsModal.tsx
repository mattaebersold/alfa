import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { useColors } from '../../hooks/useColors';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** When provided, a footer "Accept & Close" button is shown that calls this then closes. */
  onAccept?: () => void;
};

/**
 * Terms of Service reader. Content mirrors murray's TermsOfService page
 * (https://openroadsociety.co/terms-and-conditions). Used on Login and Register.
 */
export default function TermsModal({ visible, onClose, onAccept }: Props) {
  const colors = useColors();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.modal} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={styles.title}>Terms of Service</Text>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <X size={20} color={colors.fg} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <Text style={[styles.meta, { color: colors.muted }]}>Last Updated: May 12, 2026</Text>

          <Text style={[styles.h2, { color: colors.fg }]}>Acceptance of Terms</Text>
          <Text style={[styles.body, { color: colors.muted }]}>
            By creating an account or using the Open Road Society mobile application or website (the "Service"), you agree to these Terms of Service. If you do not agree, do not use the Service.
          </Text>

          <Text style={[styles.h2, { color: colors.fg }]}>Who Can Use the Service</Text>
          <Text style={[styles.body, { color: colors.muted }]}>
            You must be at least 13 years old to use the Service. By using it, you represent that you meet this requirement.
          </Text>

          <Text style={[styles.h2, { color: colors.fg }]}>Your Account</Text>
          <Text style={[styles.body, { color: colors.muted }]}>
            You are responsible for maintaining the security of your account credentials and for all activity that occurs under your account. Notify us at matt@openroadsociety.co if you believe your account has been compromised.
          </Text>

          <Text style={[styles.h2, { color: colors.fg }]}>User-Generated Content</Text>
          <Text style={[styles.body, { color: colors.muted }]}>
            You retain full ownership of any content you post to the Service — photos, posts, car listings, modifications, or any other material ("Your Content"). We do not claim any ownership rights over Your Content.{'\n\n'}
            By posting content, you grant Open Road Society a limited license to display and distribute Your Content within the Service solely for the purpose of operating and providing the Service to other users. This license ends when you delete Your Content or your account.{'\n\n'}
            You are solely responsible for Your Content and agree not to post content that:{'\n'}
            {'  '}• Is unlawful, harassing, abusive, or threatening{'\n'}
            {'  '}• Infringes on the intellectual property rights of others{'\n'}
            {'  '}• Contains malware, spam, or deceptive material{'\n'}
            {'  '}• Violates the privacy of others{'\n\n'}
            We reserve the right to remove content that violates these terms.
          </Text>

          <Text style={[styles.h2, { color: colors.fg }]}>What We Do Not Do With Your Data</Text>
          <Text style={[styles.body, { color: colors.muted }]}>
            We do not:{'\n'}
            {'  '}• Sell, rent, or share your personal information with advertisers or third parties for marketing purposes{'\n'}
            {'  '}• Use your content or data for advertising targeting{'\n'}
            {'  '}• Claim ownership of any content you upload{'\n\n'}
            For full details on how we handle your data, see our Privacy Policy.
          </Text>

          <Text style={[styles.h2, { color: colors.fg }]}>Prohibited Conduct</Text>
          <Text style={[styles.body, { color: colors.muted }]}>
            You agree not to:{'\n'}
            {'  '}• Use the Service for any unlawful purpose{'\n'}
            {'  '}• Attempt to gain unauthorized access to any part of the Service or its infrastructure{'\n'}
            {'  '}• Scrape, crawl, or systematically extract data from the Service{'\n'}
            {'  '}• Impersonate another person or entity{'\n'}
            {'  '}• Interfere with other users' enjoyment of the Service
          </Text>

          <Text style={[styles.h2, { color: colors.fg }]}>Account Deletion</Text>
          <Text style={[styles.body, { color: colors.muted }]}>
            You may delete your account at any time from the Settings screen. Upon deletion, your data will be removed from our systems within a reasonable timeframe.
          </Text>

          <Text style={[styles.h2, { color: colors.fg }]}>Disclaimers</Text>
          <Text style={[styles.body, { color: colors.muted }]}>
            The Service is provided "as is" without warranties of any kind. We do not guarantee uninterrupted or error-free operation of the Service.
          </Text>

          <Text style={[styles.h2, { color: colors.fg }]}>Limitation of Liability</Text>
          <Text style={[styles.body, { color: colors.muted }]}>
            To the fullest extent permitted by law, Open Road Society shall not be liable for any indirect, incidental, or consequential damages arising from your use of the Service.
          </Text>

          <Text style={[styles.h2, { color: colors.fg }]}>Changes to These Terms</Text>
          <Text style={[styles.body, { color: colors.muted }]}>
            We may update these Terms from time to time. Continued use of the Service after changes are posted constitutes acceptance of the updated Terms. We will update the "Last Updated" date above when changes are made.
          </Text>

          <Text style={[styles.h2, { color: colors.fg }]}>Contact</Text>
          <Text style={[styles.body, { color: colors.muted }]}>
            Questions about these Terms? Contact us at matt@openroadsociety.co.
          </Text>
        </ScrollView>

        {onAccept && (
          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.acceptBtn, { backgroundColor: colors.primaryAlt }]}
              onPress={() => { onAccept(); onClose(); }}
            >
              <Text style={styles.acceptBtnText}>Accept & Close</Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal:  { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E0E0E0',
  },
  title:  { fontSize: 17, fontWeight: '700', color: '#000' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingVertical: 16, paddingBottom: 32 },
  meta:   { fontSize: 13, marginBottom: 16 },
  h2:     { fontSize: 15, fontWeight: '700', marginTop: 20, marginBottom: 6 },
  body:   { fontSize: 14, lineHeight: 22 },
  footer: { paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth },
  acceptBtn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  acceptBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
