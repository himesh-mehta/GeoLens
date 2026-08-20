"use client";

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useTranslation, LangCode } from '@/lib/i18n';

interface FAQ {
  question: Record<LangCode, string>;
  answer: Record<LangCode, string>;
}

export default function HelpPage() {
  const { t, lang } = useTranslation();

  const faqs: FAQ[] = [
    {
      question: {
        en: "What is satellite imagery?",
        hi: "उपग्रह चित्र क्या हैं?",
        mr: "उपग्रह छायाचित्रे म्हणजे काय?"
      },
      answer: {
        en: "Satellite imagery refers to pictures of the Earth taken from spacecraft orbiting our planet. These images show fields, forests, water bodies, and buildings from above, helping us see changes over time.",
        hi: "उपग्रह चित्र हमारी पृथ्वी की परिक्रमा करने वाले अंतरिक्ष यान से ली गई तस्वीरें हैं। ये चित्र ऊपर से खेत, जंगल, जल निकाय और इमारतें दिखाते हैं।",
        mr: "उपग्रह छायाचित्रे म्हणजे आपल्या पृथ्वीभोवती फिरणाऱ्या अंतराळ यानातून घेतलेली चित्रे. ही चित्रे वरून शेते, जंगले, जलाशय आणि इमारती दाखवतात."
      }
    },
    {
      question: {
        en: "What can this system tell me?",
        hi: "यह प्रणाली मुझे क्या बता सकती है?",
        mr: "ही प्रणाली मला काय सांगू शकते?"
      },
      answer: {
        en: "This system can help you notice changes in your chosen areas, such as whether vegetation has grown or dried up, if water bodies have shrunk or expanded, and if new buildings or roads have appeared.",
        hi: "यह प्रणाली आपके चुने गए क्षेत्रों में बदलाव देखने में मदद कर सकती है, जैसे वनस्पति बढ़ी है या सूखी है, या नई इमारतें बनी हैं।",
        mr: "ही प्रणाली आपल्या निवडलेल्या क्षेत्रांमधील बदल समजून घेण्यास मदत करू शकते, जसे की वनस्पती वाढली आहे की वाळली आहे, किंवा नवीन इमारती झाल्या आहेत."
      }
    },
    {
      question: {
        en: "How do I select an area?",
        hi: "मैं किसी क्षेत्र को कैसे चुनूं?",
        mr: "मी क्षेत्र कसे निवडू?"
      },
      answer: {
        en: "Go to the Home screen and click 'Choose from map'. A simple map view will appear where you can search for a location by name or draw a box around the field/area you are interested in monitoring.",
        hi: "होम स्क्रीन पर जाएं और 'मानचित्र से चुनें' पर क्लिक करें। एक मानचित्र दिखाई देगा जहाँ आप नाम से खोज सकते हैं या सीधे पिन चुन सकते हैं।",
        mr: "मुख्यपृष्ठावर जा आणि 'नकाशावरून निवडा' वर क्लिक करा. एक नकाशा दिसेल जिथे आपण नावाने शोधू शकता किंवा पिन निवडू शकता."
      }
    },
    {
      question: {
        en: "How do I ask questions?",
        hi: "मैं प्रश्न कैसे पूछूं?",
        mr: "मी प्रश्न कसे विचारू?"
      },
      answer: {
        en: "Once the satellite image is loaded, you will see a text box below it. You can type questions in simple English, Hindi, or Marathi, such as 'Is my crops' area green?' or 'Where did water levels go down?'",
        hi: "उपग्रह चित्र लोड होने के बाद, आप नीचे एक टेक्स्ट बॉक्स देखेंगे। आप अंग्रेजी, हिंदी या मराठी में प्रश्न टाइप कर सकते हैं।",
        mr: "उपग्रह छायाचित्र लोड झाल्यावर, खाली एक बॉक्स दिसेल. आपण इंग्रजी, हिंदी किंवा मराठीत सोपे प्रश्न टाइप करू शकता."
      }
    },
    {
      question: {
        en: "What do the results mean?",
        hi: "परिणामों का क्या अर्थ है?",
        mr: "निकाल काय दर्शवतात?"
      },
      answer: {
        en: "The system provides a list of simple findings (like 'Vegetation decreased'). Green badges mean completed or positive changes, blue badges show helpful details, amber represents processing, and red indicates errors or warnings.",
        hi: "प्रणाली सरल निष्कर्षों की एक सूची प्रदान करती है (जैसे 'वनस्पति घटी')। हरे रंग का मतलब सकारात्मक बदलाव या पूर्ण स्थिति है।",
        mr: "प्रणाली सोप्या निष्कर्षांची यादी देते (उदा. 'वनस्पती घटली'). हिरव्या रंगाचा अर्थ पूर्ण किंवा सकारात्मक बदल असा होतो."
      }
    }
  ];

  return (
    <div className="max-w-4xl mx-auto py-4 md:py-8 space-y-6">
      <div>
        <h3 className="text-xl md:text-2xl font-bold text-brand-neutral-900">{t('help.title')}</h3>
        <p className="text-sm md:text-base text-brand-neutral-700 mt-2">
          {t('help.subtitle')}
        </p>
      </div>

      <div className="space-y-4">
        {faqs.map((faq, index) => (
          <Card key={index}>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm md:text-base font-semibold text-brand-green-700">
                {faq.question[lang] || faq.question.en}
              </CardTitle>
            </CardHeader>
            <CardContent className="py-3 px-4 text-sm text-brand-neutral-900 leading-relaxed">
              {faq.answer[lang] || faq.answer.en}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
