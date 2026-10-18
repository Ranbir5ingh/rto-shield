/**
 * Spoken tour lines. Captions live in the web tour card.
 * Tags are for eleven_v3 and apply to the next few words. Keep each line short.
 */
export const TOUR_VOICE_ID = '0muxiGNHAVvmM1qWRtyV';
export const TOUR_TTS_MODEL = 'eleven_v3';

export type NarrationLang = 'english' | 'hindi' | 'hinglish';

export const NARRATION: Record<string, Record<NarrationLang, string>> = {
  'shopify-connect': {
    english: '[warm] Enter the shop domain. Shopify sends the orders.',
    hindi: '[warm] शॉप डोमेन डालें। Shopify ऑर्डर भेज देगा।',
    hinglish: '[warm] Shop domain daalo. Shopify orders bhej dega. Sheet baad mein.',
  },
  'import-alternatives': {
    english: '[curious] A CSV or the sample shop still works.',
    hindi: '[curious] CSV या सैंपल शॉप भी चलती है।',
    hinglish: '[curious] CSV ya sample shop bhi chalega, jab tak Shopify ready nahi.',
  },
  'shopify-connected': {
    english: '[warm] This store is already connected. Shopify sends the orders.',
    hindi: '[warm] यह स्टोर पहले से जुड़ा है। Shopify ऑर्डर भेजता है।',
    hinglish: '[warm] Yeh store pehle se connected hai. Shopify orders bhejta hai.',
  },
  'queue-list': {
    english: '[curious] Each row is one order. The number is the risk score. Red means look twice.',
    hindi: '[curious] हर पंक्ति एक ऑर्डर है। नंबर रिस्क स्कोर है। लाल हो तो दोबारा देखें।',
    hinglish: '[curious] Har row ek order hai. Number risk score hai. Red matlab do baar dekho.',
  },
  'all-open': {
    english: '[warm] Needs action is High and Medium. All open includes the Low orders too.',
    hindi: '[warm] Needs action में High और Medium हैं। All open में Low ऑर्डर भी हैं।',
    hinglish: '[warm] Needs action sirf High aur Medium hai. All open mein Low orders bhi hain.',
  },
  'band-low': {
    english: '[curious] This is the Low tab. The quieter orders are here.',
    hindi: '[curious] यह Low टैब है। शांत ऑर्डर यहाँ हैं।',
    hinglish: '[curious] Low tab ab dikhta hai. Chhote risk wale orders yahin hain.',
  },
  'lang-hinglish': {
    english: '[warm] Hinglish. The usual pick.',
    hindi: '[warm] Hinglish। आम चुनाव।',
    hinglish: '[warm] Hinglish. Zyada tar buyers ke liye yahi.',
  },
  'lang-hindi': {
    english: '[warm] Hindi. Straight and clear.',
    hindi: '[warm] Hindi। सीधा और साफ।',
    hinglish: '[warm] Hindi. Seedha aur saaf.',
  },
  'lang-english': {
    english: '[curious] English. When the buyer writes in English.',
    hindi: '[curious] English। जब खरीदार अंग्रेज़ी में लिखे।',
    hinglish: '[curious] English. Jab buyer English mein baat kare.',
  },
  'why-flagged': {
    english: '[curious] These chips are facts from the order. The model did not write an essay.',
    hindi: '[curious] ये चिप ऑर्डर के तथ्य हैं। मॉडल ने निबंध नहीं लिखा।',
    hinglish: '[curious] Yeh chips order ke facts hain. Model ne essay nahi likha.',
  },
  'why-flagged-mobile': {
    english: '[warm] This order is open. The chips are facts, not an essay.',
    hindi: '[warm] यह ऑर्डर खुला है। चिप तथ्य हैं, निबंध नहीं।',
    hinglish: '[warm] Main yeh order khol raha hoon. Chips order ke facts hain, essay nahi.',
  },
  'message-draft': {
    english: '[warm] This is the WhatsApp draft. It changes with the message language.',
    hindi: '[warm] यह WhatsApp ड्राफ्ट है। संदेश की भाषा से यह बदलता है।',
    hinglish: '[warm] Yeh WhatsApp draft hai. Message language badalte hi words badal jaate hain.',
  },
  'copy-draft': {
    english: '[warm] Copy. The draft goes on the clipboard.',
    hindi: '[warm] Copy। ड्राफ्ट क्लिपबोर्ड पर चला जाता है।',
    hinglish: '[warm] Copy. Draft clipboard par chala jaata hai.',
  },
  'send-whatsapp': {
    english: '[excited] Send on WhatsApp. Only this order. Select rows to send several.',
    hindi: '[excited] Send on WhatsApp। सिर्फ यह ऑर्डर। कई के लिए पंक्तियाँ चुनें।',
    hinglish: '[excited] Send on WhatsApp. Sirf yeh order. Kai orders ke liye rows select karo.',
  },
  conversation: {
    english: '[curious] Queued, sent, delivered, read. Under that is the WhatsApp thread.',
    hindi: '[curious] Queued, sent, delivered, read। नीचे WhatsApp थ्रेड है।',
    hinglish: '[curious] Queued, sent, delivered, read. Neeche asli WhatsApp thread hai.',
  },
  'hold-approve': {
    english: '[warm] This button is the action. Landmark, prepaid, hold, or approve.',
    hindi: '[warm] यह बटन अगला काम है। लैंडमार्क, प्रीपेड, होल्ड, या अप्रूव।',
    hinglish: '[warm] Yeh button is order ka action hai. Landmark, prepaid, hold, ya approve.',
  },
  'more-menu': {
    english: '[curious] More is open. Each item has its own step. Nothing is pressed yet.',
    hindi: '[curious] More खुला है। हर आइटम का अपना स्टेप है। अभी कुछ नहीं दबता।',
    hinglish: '[curious] More khul gaya. Har button ka apna step hai. Abhi kuch press nahi hota.',
  },
  'menu-confirmed': {
    english: '[warm] Confirmed. The buyer said yes.',
    hindi: '[warm] Confirmed। खरीदार ने हाँ कहा।',
    hinglish: '[warm] Confirmed. Buyer ne haan bola.',
  },
  'menu-cancelled': {
    english: '[sighs] Cancelled. The buyer said no.',
    hindi: '[sighs] Cancelled। खरीदार ने ना कहा।',
    hinglish: '[sighs] Cancelled. Buyer ne naa bola.',
  },
  'menu-skip': {
    english: '[curious] Skip. No answer yet.',
    hindi: '[curious] Skip। अभी कोई जवाब नहीं।',
    hinglish: '[curious] Skip. Abhi koi jawab nahi.',
  },
  'menu-voice': {
    english: '[excited] Play Hindi. Hear the draft, then send it.',
    hindi: '[excited] Play Hindi। ड्राफ्ट सुनें, फिर भेजें।',
    hinglish: '[excited] Play Hindi. Draft sun lo, phir bhejo.',
  },
  'menu-pin': {
    english: '[curious] Check pincode. It shows the area. Not a ban, and not a score.',
    hindi: '[curious] Check pincode। इलाका दिखाता है। बैन नहीं, स्कोर नहीं।',
    hinglish: '[curious] Check pincode. Area dikhata hai. Ban nahi. Score nahi.',
  },
  'call-buyer': {
    english: '[warm] This panel calls in the browser. Allow the mic. The number stays on the server.',
    hindi: '[warm] यह पैनल ब्राउज़र में कॉल करता है। माइक दें। नंबर सर्वर पर रहता है।',
    hinglish: '[warm] Yeh panel browser mein call karega. Mic allow karo. Number server par rehta hai.',
  },
  'prepaid-offer': {
    english: '[excited] Offer prepaid makes a checkout link. Cash on delivery stays until they pay.',
    hindi: '[excited] Offer prepaid चेकआउट लिंक बनाता है। भुगतान तक कैश ऑन डिलीवरी रहती है।',
    hinglish: '[excited] Offer prepaid checkout link banata hai. COD tab tak rehta hai jab tak payment nahi.',
  },
  'whatsapp-setup': {
    english: '[warm] Setup guide. It walks through Meta.',
    hindi: '[warm] Setup guide। यह Meta तक ले जाता है।',
    hinglish: '[warm] Setup guide. Meta tak le jaayegi.',
  },
  'whatsapp-card': {
    english: "[warm] The demo uses Meta's test number. A real shop pastes its own token.",
    hindi: '[warm] डेमो पर Meta का टेस्ट नंबर है। असली शॉप अपना टोकन डालती है।',
    hinglish: '[warm] Demo pe Meta ka test number hai. Asli shop apna token paste karti hai.',
  },
  'history-list': {
    english: '[curious] Delivered, RTO, and cancelled orders teach the model. A confirm in the app is not training.',
    hindi: '[curious] Delivered, RTO, और cancelled मॉडल को सिखाते हैं। ऐप का कन्फर्म ट्रेनिंग नहीं है।',
    hinglish: '[curious] Delivered, RTO, aur cancelled model ko sikhate hain. App ka confirm training nahi hai.',
  },
  autopilot: {
    english: '[warm] Autopilot is on. Address, payment link, then confirm. Hold if nobody replies.',
    hindi: '[warm] ऑटोपायलट चालू है। पता, पेमेंट लिंक, फिर कन्फर्म। जवाब न आए तो होल्ड।',
    hinglish: '[warm] Autopilot on hai. Address, payment link, phir confirm. Reply na aaye to hold.',
  },
  exceptions: {
    english: '[curious] Only orders that stopped. Waiting on the buyer is not an exception.',
    hindi: '[curious] सिर्फ रुके हुए ऑर्डर। खरीदार के जवाब का इंतज़ार अपवाद नहीं है।',
    hinglish: '[curious] Sirf ruke hue orders. Buyer ke reply ka intezaar exception nahi hai.',
  },
  'exception-order': {
    english: '[matter] One stopped order. Template pending is not the same as not sent.',
    hindi: '[matter] एक रुका ऑर्डर। Template pending और not sent अलग हैं।',
    hinglish: '[matter] Ek ruka order. Template pending aur not sent alag hain.',
  },
  'exception-action': {
    english: '[warm] Confirm, cancel, or use this reply as the address.',
    hindi: '[warm] कन्फर्म करें, रद्द करें, या इस जवाब को पता बनाएँ।',
    hinglish: '[warm] Confirm karo, cancel karo, ya is reply ko address banao.',
  },
  activity: {
    english: '[curious] The log of what the shop already did.',
    hindi: '[curious] शॉप जो कर चुकी है उसकी सूची।',
    hinglish: '[curious] Shop jo kar chuki hai uski list.',
  },
  'results-home': {
    english: '[excited] Back to results. This is the morning view.',
    hindi: '[excited] नतीजों पर वापस। यही सुबह का नज़ारा है।',
    hinglish: '[excited] Results pe wapas. Yahi subah ka view hai.',
  },
  impact: {
    english: '[excited] Rupees that did not go back. Prepaid, address fixes, and confirmations.',
    hindi: '[excited] जो रुपये वापस नहीं गए। प्रीपेड, पता, और कन्फर्मेशन।',
    hinglish: '[excited] Yeh rupaye wapas nahi gaye. Prepaid, address, aur confirmations yahin hain.',
  },
};

const LANGS: NarrationLang[] = ['english', 'hindi', 'hinglish'];

export function narrationFor(stepId: string, lang: string = 'english'): string | null {
  if (!/^[a-z0-9-]{1,64}$/.test(stepId)) return null;
  const row = NARRATION[stepId];
  if (!row) return null;
  if (lang !== 'english' && lang !== 'hindi' && lang !== 'hinglish') return null;
  return row[lang];
}

export function narrationJobs(): Array<{ id: string; lang: NarrationLang }> {
  return Object.keys(NARRATION).flatMap((id) => LANGS.map((lang) => ({ id, lang })));
}
