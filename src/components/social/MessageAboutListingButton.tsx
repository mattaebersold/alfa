import React from 'react';
import { TouchableOpacity, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { MessageCircle } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useColors } from '../../hooks/useColors';

interface Props {
  sellerId: string;
  sellerUsername?: string;
  listingTitle?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

// "Message user about this" — opens a new message pre-filled with the listing
// referenced in both the subject and body. Shown on marketplace listings.
export default function MessageAboutListingButton({ sellerId, sellerUsername, listingTitle, size = 16, style }: Props) {
  const colors = useColors();
  const nav = useNavigation<any>();

  const label = listingTitle?.trim() || 'this listing';

  const handlePress = () => {
    nav.navigate('ComposeMessage', {
      userId: sellerId,
      username: sellerUsername,
      subject: `Re: ${label}`,
      initialBody: `Hi${sellerUsername ? ` @${sellerUsername}` : ''}, I'm interested in your listing "${label}".`,
    });
  };

  return (
    <TouchableOpacity
      style={[styles.btn, { borderColor: colors.primaryAlt, backgroundColor: colors.primaryAlt + '14' }, style]}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      <MessageCircle size={size} color={colors.primaryAlt} />
      <Text style={[styles.text, { color: colors.primaryAlt }]}>
        Message {sellerUsername ? `@${sellerUsername}` : 'seller'} about this
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 11, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1.5,
  },
  text: { fontSize: 14, fontWeight: '700' },
});
