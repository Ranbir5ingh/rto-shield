export type TourLang = 'english' | 'hindi' | 'hinglish';

export function isTourLang(value: string | null | undefined): value is TourLang {
  return value === 'english' || value === 'hindi' || value === 'hinglish';
}

interface Line {
  title: string;
  body: string;
  mobileBody?: string;
}

const COPY: Record<string, Record<TourLang, Line>> = {
  'shopify-connect': {
    english: {
      title: 'Connect Shopify',
      body: 'Enter the shop domain. Shopify sends the orders. You do not have to upload a sheet first.',
    },
    hindi: {
      title: 'Shopify जोड़ें',
      body: 'शॉप डोमेन डालें। Shopify ऑर्डर भेज देगा। शीट पहले अपलोड करने की ज़रूरत नहीं।',
    },
    hinglish: {
      title: 'Connect Shopify',
      body: 'Shop domain daalo. Shopify orders bhej dega. Sheet pehle upload karne ki zaroorat nahi.',
    },
  },
  'import-alternatives': {
    english: {
      title: 'Other ways in',
      body: 'A CSV or the sample shop still works if Shopify is not ready.',
    },
    hindi: {
      title: 'और तरीके',
      body: 'Shopify तैयार न हो तो CSV या सैंपल शॉप भी चलती है।',
    },
    hinglish: {
      title: 'Other ways in',
      body: 'Shopify ready na ho to CSV ya sample shop bhi chalega.',
    },
  },
  'shopify-connected': {
    english: {
      title: 'Shopify, connected',
      body: 'This store is already connected. Shopify sends the orders. There is nothing to connect on this screen.',
    },
    hindi: {
      title: 'Shopify जुड़ा है',
      body: 'यह स्टोर पहले से जुड़ा है। Shopify ऑर्डर भेजता है। यहाँ जोड़ने को कुछ नहीं है।',
    },
    hinglish: {
      title: 'Shopify, connected',
      body: 'Yeh store pehle se connected hai. Shopify orders bhejta hai. Yahan connect karne ko kuch nahi.',
    },
  },
  'queue-list': {
    english: {
      title: 'The queue',
      body: 'Each row is one order. The number is the risk score. Red means look twice before you ship.',
    },
    hindi: {
      title: 'कतार',
      body: 'हर पंक्ति एक ऑर्डर है। नंबर रिस्क स्कोर है। लाल हो तो भेजने से पहले दोबारा देखें।',
    },
    hinglish: {
      title: 'The queue',
      body: 'Har row ek order hai. Number risk score hai. Red matlab ship se pehle do baar dekho.',
    },
  },
  'all-open': {
    english: {
      title: 'All open',
      body: 'Needs action is only High and Medium. All open is on now, so the quiet Low orders are in the list too.',
    },
    hindi: {
      title: 'सभी खुले',
      body: 'Needs action में सिर्फ High और Medium हैं। All open चालू है, इसलिए Low ऑर्डर भी सूची में हैं।',
    },
    hinglish: {
      title: 'All open',
      body: 'Needs action sirf High aur Medium hai. All open on hai, isliye Low orders bhi list mein hain.',
    },
  },
  'band-low': {
    english: {
      title: 'Low',
      body: 'All open stays on, so this Low tab is here. It was hidden on Needs action.',
    },
    hindi: {
      title: 'Low',
      body: 'All open चालू रहता है, इसलिए यह Low टैब यहाँ है। Needs action पर यह छिपा था।',
    },
    hinglish: {
      title: 'Low',
      body: 'All open on rehta hai, isliye yeh Low tab yahan hai. Needs action par yeh chhipa tha.',
    },
  },
  'message-language': {
    english: {
      title: 'Message language',
      body: 'Message language is open. Hinglish, Hindi, or English. The draft changes as soon as you pick one.',
    },
    hindi: {
      title: 'संदेश की भाषा',
      body: 'Message language खुला है। Hinglish, Hindi, या English। चुनते ही ड्राफ्ट बदल जाता है।',
    },
    hinglish: {
      title: 'Message language',
      body: 'Message language khula hai. Hinglish, Hindi, ya English. Pick karte hi draft badal jaata hai.',
    },
  },
  'lang-hinglish': {
    english: {
      title: 'Hinglish',
      body: 'Hinglish is the usual pick. The menu stays open so you can see the other two.',
    },
    hindi: {
      title: 'Hinglish',
      body: 'Hinglish आम चुनाव है। मेनू खुला रहता है ताकि बाकी दो दिखें।',
    },
    hinglish: {
      title: 'Hinglish',
      body: 'Hinglish usual pick hai. Menu khula rehta hai taaki baaki do dikhein.',
    },
  },
  'lang-hindi': {
    english: {
      title: 'Hindi',
      body: 'Hindi is the next line in the same menu.',
    },
    hindi: {
      title: 'Hindi',
      body: 'Hindi उसी मेनू की अगली पंक्ति है।',
    },
    hinglish: {
      title: 'Hindi',
      body: 'Hindi usi menu ki next line hai.',
    },
  },
  'lang-english': {
    english: {
      title: 'English',
      body: 'English is the last line. Picking one would change the draft. This step does not pick.',
    },
    hindi: {
      title: 'English',
      body: 'English आखिरी पंक्ति है। चुनने से ड्राफ्ट बदलता। यह स्टेप नहीं चुनता।',
    },
    hinglish: {
      title: 'English',
      body: 'English last line hai. Pick karne se draft badalta. Yeh step pick nahi karta.',
    },
  },
  'why-flagged': {
    english: {
      title: 'Why it was flagged',
      body: 'These chips are facts from the order, not a paragraph the model wrote. The score sits beside them.',
      mobileBody: 'This order is open. The chips are facts from the order, not a paragraph the model wrote.',
    },
    hindi: {
      title: 'क्यों फ्लैग हुआ',
      body: 'ये चिप ऑर्डर के तथ्य हैं, मॉडल का पैराग्राफ नहीं। स्कोर उनके पास है।',
      mobileBody: 'यह ऑर्डर खुला है। चिप ऑर्डर के तथ्य हैं, मॉडल का पैराग्राफ नहीं।',
    },
    hinglish: {
      title: 'Why it was flagged',
      body: 'Yeh chips order ke facts hain, model ka paragraph nahi. Score unke paas hai.',
      mobileBody: 'Yeh order khula hai. Chips order ke facts hain, model ka paragraph nahi.',
    },
  },
  'message-draft': {
    english: {
      title: 'Message draft',
      body: 'This is the WhatsApp draft for this order. It changes when the message language changes.',
    },
    hindi: {
      title: 'मैसेज ड्राफ्ट',
      body: 'यह इस ऑर्डर का WhatsApp ड्राफ्ट है। संदेश की भाषा बदलते ही यह बदलता है।',
    },
    hinglish: {
      title: 'Message draft',
      body: 'Yeh is order ka WhatsApp draft hai. Message language badalte hi yeh badal jaata hai.',
    },
  },
  'copy-draft': {
    english: {
      title: 'Copy',
      body: 'Copy puts this draft on the clipboard.',
    },
    hindi: {
      title: 'Copy',
      body: 'Copy इस ड्राफ्ट को क्लिपबोर्ड पर रख देता है।',
    },
    hinglish: {
      title: 'Copy',
      body: 'Copy is draft ko clipboard par rakh deta hai.',
    },
  },
  'send-whatsapp': {
    english: {
      title: 'Send on WhatsApp',
      body: 'Send on WhatsApp sends only this order. Select rows when you want to send several.',
    },
    hindi: {
      title: 'Send on WhatsApp',
      body: 'Send on WhatsApp सिर्फ यह ऑर्डर भेजता है। कई भेजने हों तो पंक्तियाँ चुनें।',
    },
    hinglish: {
      title: 'Send on WhatsApp',
      body: 'Send on WhatsApp sirf yeh order bhejta hai. Kai bhejne hon to rows select karo.',
    },
  },
  conversation: {
    english: {
      title: 'Conversation',
      body: 'Queued, sent, delivered, read. The lines under that are the WhatsApp thread.',
    },
    hindi: {
      title: 'Conversation',
      body: 'Queued, sent, delivered, read। उसके नीचे की पंक्तियाँ WhatsApp थ्रेड हैं।',
    },
    hinglish: {
      title: 'Conversation',
      body: 'Queued, sent, delivered, read. Neeche ki lines WhatsApp thread hain.',
    },
  },
  'hold-approve': {
    english: {
      title: 'Hold for review',
      body: 'This button is the action this order needs. It can ask for a landmark, offer prepaid, hold the order, or approve it.',
    },
    hindi: {
      title: 'Hold for review',
      body: 'यह बटन इस ऑर्डर का अगला काम है। लैंडमार्क माँगना, प्रीपेड ऑफर, होल्ड, या अप्रूव।',
    },
    hinglish: {
      title: 'Hold for review',
      body: 'Yeh button is order ka agla kaam hai. Landmark, prepaid, hold, ya approve.',
    },
  },
  'more-menu': {
    english: {
      title: 'More',
      body: 'More is open. Each item under it gets its own step. Nothing here is pressed until Call the buyer.',
    },
    hindi: {
      title: 'More',
      body: 'More खुला है। हर आइटम का अपना स्टेप है। Call the buyer तक कुछ दबाया नहीं जाता।',
    },
    hinglish: {
      title: 'More',
      body: 'More khula hai. Har item ka apna step hai. Call the buyer tak kuch press nahi hota.',
    },
  },
  'menu-confirmed': {
    english: {
      title: 'Confirmed',
      body: 'Confirmed means the buyer said yes. The tour is only showing the button.',
    },
    hindi: {
      title: 'Confirmed',
      body: 'Confirmed मतलब खरीदार ने हाँ कहा। यह स्टेप सिर्फ बटन दिखा रहा है।',
    },
    hinglish: {
      title: 'Confirmed',
      body: 'Confirmed matlab buyer ne haan kaha. Yeh step sirf button dikha raha hai.',
    },
  },
  'menu-cancelled': {
    english: {
      title: 'Cancelled',
      body: 'Cancelled means the buyer said no. The order is not cancelled by this step.',
    },
    hindi: {
      title: 'Cancelled',
      body: 'Cancelled मतलब खरीदार ने ना कहा। यह स्टेप ऑर्डर रद्द नहीं करता।',
    },
    hinglish: {
      title: 'Cancelled',
      body: 'Cancelled matlab buyer ne naa kaha. Yeh step order cancel nahi karta.',
    },
  },
  'menu-skip': {
    english: {
      title: 'Skip',
      body: 'Skip is for no answer yet. The order stays open.',
    },
    hindi: {
      title: 'Skip',
      body: 'Skip तब है जब अभी जवाब नहीं आया। ऑर्डर खुला रहता है।',
    },
    hinglish: {
      title: 'Skip',
      body: 'Skip tab hai jab abhi jawab nahi aaya. Order khula rehta hai.',
    },
  },
  'menu-prepaid': {
    english: {
      title: 'Offer prepaid',
      body: 'Offer prepaid makes a checkout link. Cash on delivery stays until they pay. This step does not send it.',
    },
    hindi: {
      title: 'Offer prepaid',
      body: 'Offer prepaid चेकआउट लिंक बनाता है। भुगतान तक कैश ऑन डिलीवरी रहती है। यह स्टेप नहीं भेजता।',
    },
    hinglish: {
      title: 'Offer prepaid',
      body: 'Offer prepaid checkout link banata hai. Payment tak COD rehti hai. Yeh step bhejta nahi.',
    },
  },
  'menu-voice': {
    english: {
      title: 'Play Hindi',
      body: 'Play Hindi reads the draft aloud. This step only shows the button.',
    },
    hindi: {
      title: 'Play Hindi',
      body: 'Play Hindi ड्राफ्ट ज़ोर से पढ़ता है। यह स्टेप सिर्फ बटन दिखाता है।',
    },
    hinglish: {
      title: 'Play Hindi',
      body: 'Play Hindi draft padh kar sunata hai. Yeh step sirf button dikhata hai.',
    },
  },
  'menu-pin': {
    english: {
      title: 'Check pincode',
      body: 'Check pincode shows the area for this address. A pincode is not a ban, and this step does not look it up.',
    },
    hindi: {
      title: 'Check pincode',
      body: 'Check pincode इस पते का इलाका दिखाता है। पिनकोड बैन नहीं है, और यह स्टेप खोज नहीं करता।',
    },
    hinglish: {
      title: 'Check pincode',
      body: 'Check pincode is address ka area dikhata hai. Pincode ban nahi hai, aur yeh step lookup nahi karta.',
    },
  },
  'call-buyer': {
    english: {
      title: 'Call the buyer',
      body: 'Call the buyer stays in this browser. Allow the microphone. The number stays on the server.',
    },
    hindi: {
      title: 'Call the buyer',
      body: 'Call the buyer इस ब्राउज़र में रहता है। माइक की अनुमति दें। नंबर सर्वर पर रहता है।',
    },
    hinglish: {
      title: 'Call the buyer',
      body: 'Call the buyer is browser mein rehta hai. Mic allow karo. Number server par rehta hai.',
    },
  },
  'call-panel': {
    english: {
      title: 'Call the buyer',
      body: 'Calls are included. This panel stays in the browser. Allow the microphone. The number stays on the server.',
    },
    hindi: {
      title: 'Call the buyer',
      body: 'कॉल शामिल हैं। यह पैनल ब्राउज़र में रहता है। माइक की अनुमति दें। नंबर सर्वर पर रहता है।',
    },
    hinglish: {
      title: 'Call the buyer',
      body: 'Calls included hain. Yeh panel browser mein rehta hai. Mic allow karo. Number server par rehta hai.',
    },
  },
  'whatsapp-setup': {
    english: {
      title: 'WhatsApp',
      body: 'Optional. Messages use RTO Shield’s number. Your own number is in the setup guide.',
    },
    hindi: {
      title: 'WhatsApp',
      body: 'ज़रूरी नहीं। मैसेज RTO Shield के नंबर से जाते हैं। अपना नंबर सेटअप गाइड में है।',
    },
    hinglish: {
      title: 'WhatsApp',
      body: 'Optional hai. Messages RTO Shield ke number se jaate hain. Apna number setup guide mein hai.',
    },
  },
  'whatsapp-card': {
    english: {
      title: 'WhatsApp',
      body: 'The demo sends from RTO Shield’s number. A shop can add its own later.',
    },
    hindi: {
      title: 'WhatsApp',
      body: 'डेमो RTO Shield के नंबर से भेजता है। शॉप बाद में अपना नंबर जोड़ सकती है।',
    },
    hinglish: {
      title: 'WhatsApp',
      body: 'Demo RTO Shield ke number se bhejta hai. Shop baad mein apna number jod sakti hai.',
    },
  },
  'history-list': {
    english: {
      title: 'History',
      body: 'Delivered, RTO, and cancelled orders teach the model. A confirm you tap in the app is not a training label.',
    },
    hindi: {
      title: 'History',
      body: 'Delivered, RTO, और cancelled ऑर्डर मॉडल को सिखाते हैं। ऐप में किया कन्फर्म ट्रेनिंग लेबल नहीं है।',
    },
    hinglish: {
      title: 'History',
      body: 'Delivered, RTO, aur cancelled orders model ko sikhate hain. App ka confirm training label nahi hai.',
    },
  },
  autopilot: {
    english: {
      title: 'Autopilot',
      body: 'It is on. The shop asks for the address, sends the payment link, and confirms. Hold is the default if nobody replies.',
    },
    hindi: {
      title: 'ऑटोपायलट',
      body: 'यह चालू है। शॉप पता पूछती है, पेमेंट लिंक भेजती है, और कन्फर्म करती है। जवाब न आए तो होल्ड।',
    },
    hinglish: {
      title: 'Autopilot',
      body: 'Yeh on hai. Shop address maangti hai, payment link bhejti hai, aur confirm karti hai. Koi reply na ho to hold.',
    },
  },
  exceptions: {
    english: {
      title: 'Exceptions',
      body: 'Only the orders that stopped. A sent message waiting on the buyer is not in this list.',
    },
    hindi: {
      title: 'अपवाद',
      body: 'सिर्फ वही ऑर्डर जो रुक गए। भेजा हुआ मैसेज, जिसका जवाब आना बाकी है, यहाँ नहीं है।',
    },
    hinglish: {
      title: 'Exceptions',
      body: 'Sirf woh orders jo ruk gaye. Bheja hua message, jiska jawab baaki hai, yahan nahi.',
    },
  },
  'exception-order': {
    english: {
      title: 'One stopped order',
      body: 'The reason is on the card. Template pending means Meta has not approved it yet. Not sent means the message failed.',
    },
    hindi: {
      title: 'एक रुका ऑर्डर',
      body: 'वजह कार्ड पर है। Template pending का मतलब Meta ने अभी मंज़ूरी नहीं दी। Not sent का मतलब मैसेज फेल हुआ।',
    },
    hinglish: {
      title: 'One stopped order',
      body: 'Wajah card pe hai. Template pending matlab Meta ne abhi approve nahi kiya. Not sent matlab message fail hua.',
    },
  },
  'exception-action': {
    english: {
      title: 'The next action',
      body: 'Confirm, cancel, or use the buyer reply as the address. The rest stays on autopilot.',
    },
    hindi: {
      title: 'अगला कदम',
      body: 'कन्फर्म करें, रद्द करें, या खरीदार के जवाब को पता बनाएँ। बाकी ऑटोपायलट पर है।',
    },
    hinglish: {
      title: 'The next action',
      body: 'Confirm karo, cancel karo, ya buyer ke reply ko address banao. Baaki autopilot pe hai.',
    },
  },
  activity: {
    english: {
      title: 'Activity',
      body: 'A log of what the shop already did. Uploads stay on the start page.',
    },
    hindi: {
      title: 'गतिविधि',
      body: 'शॉप जो कर चुकी है उसकी सूची। अपलोड स्टार्ट पेज पर रहते हैं।',
    },
    hinglish: {
      title: 'Activity',
      body: 'Shop jo kar chuki hai uski list. Uploads start page pe rehte hain.',
    },
  },
  'results-home': {
    english: {
      title: 'Back to results',
      body: 'Rupees prevented, conversions, address fixes, and confirmations. That is the morning view.',
    },
    hindi: {
      title: 'नतीजों पर वापस',
      body: 'बचे रुपये, कन्वर्ज़न, पता सुधार, और कन्फर्मेशन। यही सुबह का नज़ारा है।',
    },
    hinglish: {
      title: 'Back to results',
      body: 'Bache rupaye, conversions, address fixes, aur confirmations. Yahi subah ka view hai.',
    },
  },
  impact: {
    english: {
      title: 'Impact',
      body: 'Rupees that did not go back, plus prepaid checkouts, address fixes, and confirmations.',
    },
    hindi: {
      title: 'Impact',
      body: 'जो रुपये वापस नहीं गए, साथ में प्रीपेड चेकआउट, पता सुधार, और कन्फर्मेशन।',
    },
    hinglish: {
      title: 'Impact',
      body: 'Jo rupaye wapas nahi gaye, saath mein prepaid, address fixes, aur confirmations.',
    },
  },
};

export function tourText(id: string, lang: TourLang, mobile = false): { title: string; body: string } | null {
  const row = COPY[id]?.[lang];
  if (!row) return null;
  if (mobile && row.mobileBody) return { title: row.title, body: row.mobileBody };
  return { title: row.title, body: row.body };
}
