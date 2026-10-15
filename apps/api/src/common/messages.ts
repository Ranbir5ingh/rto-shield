export interface DraftMessage {
  hindi: string;
  hinglish: string;
  english: string;
  prepaid_nudge: string;
  voice_script_hi: string;
  source: string;
}

export function safeVoiceScript(shop: string, amount: number): string {
  const shopName = shop.replace(/\s+/g, ' ').trim().slice(0, 40) || 'hamari dukaan';
  return `नमस्ते। ${shopName} से ${Math.round(amount)} रुपये के कैश ऑन डिलीवरी ऑर्डर की पुष्टि करनी है। डिलीवरी लेनी हो तो हाँ बोलिए। रद्द करना हो तो ना बोलिए।`;
}

export function templateMessage(shop: string, firstName: string, amount: number, product: string): DraftMessage {
  const name = firstName.trim().slice(0, 40) || 'ji';
  const shopName = shop.trim().slice(0, 40) || 'our shop';
  const item = product.trim().slice(0, 40) || 'order';
  const rupees = Math.round(amount);
  return {
    hindi: `नमस्ते ${name} जी, ${shopName} से। आपका ₹${rupees} का कैश ऑन डिलीवरी ऑर्डर (${item}) पैक हो गया है। डिलीवरी स्वीकार करेंगे तो YES लिखें, रद्द करना हो तो NO।`,
    hinglish: `Namaste ${name} ji, ${shopName} se. Aapka COD order ₹${rupees} (${item}) pack ho gaya hai. Delivery accept karoge toh YES reply kijiye, cancel karna ho toh NO.`,
    english: `Hi ${name}, this is ${shopName}. Your cash-on-delivery order of ₹${rupees} (${item}) is packed. Reply YES to accept delivery or NO to cancel, so we don't ship an order that would come back.`,
    prepaid_nudge: `Optional: pay ₹${rupees} by UPI now and we will mark this order prepaid so it is not refused at the door. Reply PREPAID and ${shopName} will share the UPI id.`,
    voice_script_hi: safeVoiceScript(shopName, rupees),
    source: 'template',
  };
}

const phonePattern = /(\+?\d[\d\-\s]{8,}\d)/;

export function assertSafeVoiceScript(script: string, shop: string, amount: number): string {
  if (phonePattern.test(script) || script.length > 500) return safeVoiceScript(shop, amount);
  return script;
}
