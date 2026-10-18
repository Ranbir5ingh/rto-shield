/**
 * Spoken tour lines. Captions live in the web tour card.
 * Tags are for eleven_v3 and apply to the next few words. Keep each line short.
 */
export const TOUR_VOICE_ID = '0muxiGNHAVvmM1qWRtyV';
export const TOUR_TTS_MODEL = 'eleven_v3';

export const NARRATION: Record<string, string> = {
  'shopify-connect': '[warm] Shop domain daalo. Shopify orders bhej dega. Sheet baad mein.',
  'import-alternatives': '[curious] CSV ya sample shop bhi chalega, jab tak Shopify ready nahi.',
  'shopify-connected': '[warm] Yeh demo store connected hai. Asli shop ek click mein judti hai.',
  'queue-list': '[curious] Har row ek order hai. Number risk score hai. Red matlab do baar dekho.',
  'all-open': '[warm] Needs action sirf High aur Medium hai. All open mein Low orders bhi hain.',
  'band-low': '[curious] Low tab ab dikhta hai. Chhote risk wale orders yahin hain.',
  'lang-hinglish': '[warm] Hinglish. Zyada tar buyers ke liye yahi.',
  'lang-hindi': '[warm] Hindi. Seedha aur saaf.',
  'lang-english': '[curious] English. Jab buyer English mein baat kare.',
  'why-flagged': '[curious] Yeh chips order ke facts hain. Model ne essay nahi likha.',
  'why-flagged-mobile': '[warm] Main yeh order khol raha hoon. Chips order ke facts hain, essay nahi.',
  'message-draft': '[warm] Yeh WhatsApp draft hai. Copy karo, ya green button se bhejo.',
  'message-language': '[excited] Hinglish, Hindi, ya English. Pick karte hi draft badal jaata hai.',
  conversation: '[curious] Queued, sent, delivered, read. Neeche asli WhatsApp thread hai.',
  'hold-approve': '[warm] Green button yahi action hai. Hold, landmark, prepaid, ya send.',
  'more-menu': '[curious] More khul gaya. Har button ka apna step hai. Abhi kuch press nahi hota.',
  'menu-confirmed': '[warm] Confirmed. Buyer ne haan bola.',
  'menu-cancelled': '[sighs] Cancelled. Buyer ne naa bola.',
  'menu-skip': '[curious] Skip. Abhi koi jawab nahi.',
  'menu-voice': '[excited] Play Hindi. Draft sun lo, phir bhejo.',
  'menu-pin': '[curious] Pincode. Courier ka area. Ban nahi.',
  'call-buyer': '[warm] Yeh panel browser mein call karega. Mic allow karo. Number server par rehta hai.',
  'prepaid-offer': '[excited] Offer prepaid checkout link banata hai. COD tab tak rehta hai jab tak payment nahi.',
  'whatsapp-setup': '[warm] Yeh aapka Cloud API number hai. Guide Meta tak le jaayegi.',
  'whatsapp-card': '[warm] Demo pe Meta ka test number hai. Asli shop apna token paste karti hai.',
  'history-list': '[curious] Delivered, RTO, aur cancelled model ko sikhate hain. App ka confirm training nahi hai.',
  impact: '[excited] Yeh rupaye wapas nahi gaye. Prepaid, address, aur confirmations yahin hain.',
};

export function narrationFor(stepId: string): string | null {
  if (!/^[a-z0-9-]{1,64}$/.test(stepId)) return null;
  return NARRATION[stepId] ?? null;
}
