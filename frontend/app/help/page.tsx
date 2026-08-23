"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronUp, Mail, Compass, HelpCircle } from 'lucide-react';
import { useTranslation, LangCode } from '@/lib/i18n';
import { useTheme } from '@/lib/theme/theme-context';
import { AIAvatar } from '@/components/ui/ai-avatar';

interface FAQ {
  question: Record<LangCode, string>;
  answer: Record<LangCode, string>;
}

export default function HelpPage() {
  const router = useRouter();
  const { t, lang } = useTranslation();
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const [openIndices, setOpenIndices] = useState<number[]>([]);

  const toggleFaq = (index: number) => {
    setOpenIndices(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const steps = [
    {
      num: "1",
      title: t('help.step1Title') || "Select a Location",
      desc: t('help.step1Desc') || "Use the map explorer to search by city/address or click directly on any coordinate.",
    },
    {
      num: "2",
      title: t('help.step2Title') || "Configure Analysis",
      desc: t('help.step2Desc') || "Choose your desired Sentinel-2 date range and set the cloud coverage threshold.",
    },
    {
      num: "3",
      title: t('help.step3Title') || "Analyze Satellite Data",
      desc: t('help.step3Desc') || "Click 'Analyze Area' to generate instant land-cover predictions & 11+ spectral indices.",
    },
    {
      num: "4",
      title: t('help.step4Title') || "Ask AI Assistant",
      desc: t('help.step4Desc') || "Open the floating bot widget to get plain-language interpretations and answers.",
    },
  ];

  const faqs: FAQ[] = [
    {
      question: {
        en: "What is satellite imagery?",
        hi: "उपग्रह चित्र क्या हैं?",
        mr: "उपग्रह छायाचित्रे म्हणजे काय?"
      },
      answer: {
        en: "Satellite imagery refers to pictures of the Earth taken from orbit. These images show fields, forests, water bodies, and buildings from above, enabling multi-spectral environmental monitoring.",
        hi: "उपग्रह चित्र हमारी पृथ्वी की परिक्रमा करने वाले अंतरिक्ष यान से ली गई तस्वीरें हैं। ये चित्र ऊपर से खेत, जंगल और जल निकाय दिखाते हैं।",
        mr: "उपग्रह छायाचित्रे म्हणजे आपल्या पृथ्वीभोवती फिरणाऱ्या अंतराळ यानातून घेतलेली चित्रे. ही चित्रे शेते आणि जलाशय दाखवतात."
      }
    },
    {
      question: {
        en: "What do NDVI, NDWI, and NDBI mean?",
        hi: "NDVI, NDWI और NDBI का क्या अर्थ है?",
        mr: "NDVI, NDWI आणि NDBI म्हणजे काय?"
      },
      answer: {
        en: "NDVI (Normalized Difference Vegetation Index) measures crop and forest health. NDWI measures surface water and moisture levels. NDBI highlights urban built-up structures and pavement.",
        hi: "NDVI फसल और जंगल के स्वास्थ्य को मापता है। NDWI जल स्तर को मापता है। NDBI शहरी इमारतों को दर्शाता है।",
        mr: "NDVI पिकांच्या आणि जंगलाच्या आरोग्याचे मोजमाप करते. NDWI पाण्याचे प्रमाण मोजते. NDBI इमारती दर्शवते."
      }
    },
    {
      question: {
        en: "Can I compare two time periods?",
        hi: "क्या मैं दो समय अवधियों की तुलना कर सकता हूँ?",
        mr: "मी दोन कालावधींची तुलना करू शकतो का?"
      },
      answer: {
        en: "Yes! Use the Compare page to select Period 1 (e.g. 2018) and Period 2 (e.g. 2024) to visualize land-cover shifts and spectral deltas over time.",
        hi: "हाँ! तुलना पृष्ठ का उपयोग करके आप दो वर्षों (जैसे 2018 और 2024) के बीच भूमि उपयोग में बदलाव देख सकते हैं।",
        mr: "होय! तुलना पृष्ठाचा वापर करून आपण दोन वर्षांमधील भू-वापरातील बदल पाहू शकता."
      }
    },
    {
      question: {
        en: "What languages are supported?",
        hi: "कौन सी भाषाएं समर्थित हैं?",
        mr: "कोणत्या भाषा समर्थित आहेत?"
      },
      answer: {
        en: "GeoLens fully supports English, Hindi (हिन्दी), and Marathi (मराठी) across the navigation UI, AI Assistant chat responses, and PDF reports.",
        hi: "GeoLens नेविगेशन, AI सहायक चैट और रिपोर्ट में अंग्रेजी, हिंदी और मराठी का पूरी तरह से समर्थन करता है।",
        mr: "GeoLens नेव्हिगेशन, AI सहाय्यक चॅट आणि अहवालांमध्ये इंग्रजी, हिंदी आणि मराठीला पूर्ण पाठिंबा देते."
      }
    },
    {
      question: {
        en: "What can this system tell me?",
        hi: "यह प्रणाली मुझे क्या बता सकती है?",
        mr: "ही प्रणाली मला काय सांगू शकते?"
      },
      answer: {
        en: "This system detects changes in chosen areas, such as whether vegetation has grown or dried up, if water bodies have shrunk or expanded, and if new buildings or roads have appeared.",
        hi: "यह प्रणाली आपके चुने गए क्षेत्रों में बदलाव देखने में मदद करती है, जैसे वनस्पति बढ़ी है या सूखी है।",
        mr: "ही प्रणाली आपल्या क्षेत्रामधील बदल समजून घेण्यास मदत करते."
      }
    },
    {
      question: {
        en: "How do I select an area?",
        hi: "मैं किसी क्षेत्र को कैसे चुनूं?",
        mr: "मी क्षेत्र कसे निवडू?"
      },
      answer: {
        en: "Navigate to Map Explorer and search for a city or address, or click directly on the interactive map to place a pin or draw a custom bounding box.",
        hi: "मानचित्र अन्वेषक पर जाएं और शहर खोजें या सीधे मानचित्र पर क्लिक करें।",
        mr: "नकाशा एक्सप्लोररवर जा आणि नावाने शोधा किंवा नकाशावर क्लिक करा."
      }
    },
    {
      question: {
        en: "What do the confidence percentages mean?",
        hi: "आत्मविश्वास प्रतिशत का क्या अर्थ है?",
        mr: "विश्वासार्हता टक्केवारीचा काय अर्थ आहे?"
      },
      answer: {
        en: "Confidence percentages reflect the machine-learning model's probability distribution for that specific pixel or region based on 26 Sentinel-2 spectral bands.",
        hi: "आत्मविश्वास प्रतिशत 26 बैंडों के आधार पर मॉडल की संभावना दर्शाता है।",
        mr: "विश्वासार्हता टक्केवारी मॉडेलची संभाव्यता दर्शवते."
      }
    }
  ];

  return (
    <div className="w-full py-4 px-4 md:px-6 space-y-6">
      {/* ── GETTING STARTED GUIDE ── */}
      <div
        className={`p-6 rounded-2xl border transition-all ${
          isLight
            ? 'bg-[#FAFAF7] border-[#E5E7DE] text-[#2D3B27]'
            : 'bg-[#0F172A] border-[#1E293B] text-[#F1F5F9]'
        }`}
      >
        <div className="flex items-center gap-2 mb-4">
          <div className={`p-2 rounded-xl border ${isLight ? 'bg-[#4C7A3D]/10 border-[#4C7A3D]/30 text-[#4C7A3D]' : 'bg-[#14B8A6]/10 border-[#14B8A6]/30 text-[#14B8A6]'}`}>
            <Compass className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-base">
              {t('help.gettingStartedTitle') || 'Getting Started'}
            </h3>
            <p className={`text-xs ${isLight ? 'text-[#6B7568]' : 'text-slate-400'}`}>
              {t('help.gettingStartedSub') || 'Follow these 4 simple steps to analyze any area on Earth'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {steps.map((s, idx) => (
            <div
              key={idx}
              className={`p-3.5 rounded-xl border space-y-1.5 ${
                isLight ? 'bg-white border-[#E5E7DE]' : 'bg-[#131B2E] border-[#1E293B]'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center text-white ${
                  isLight ? 'bg-[#4C7A3D]' : 'bg-[#14B8A6]'
                }`}>
                  {s.num}
                </span>
                <h4 className="font-bold text-xs">{s.title}</h4>
              </div>
              <p className={`text-[11px] leading-relaxed ${isLight ? 'text-[#6B7568]' : 'text-slate-400'}`}>
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── FREQUENTLY ASKED QUESTIONS (ACCORDION) ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <HelpCircle className={`h-4 w-4 ${isLight ? 'text-[#4C7A3D]' : 'text-[#14B8A6]'}`} />
          <h3 className={`font-extrabold text-sm uppercase tracking-wider ${isLight ? 'text-[#2D3B27]' : 'text-[#F1F5F9]'}`}>
            {t('help.faqSectionTitle') || 'Frequently Asked Questions'}
          </h3>
        </div>

        <div className="space-y-2">
          {faqs.map((faq, index) => {
            const isOpen = openIndices.includes(index);
            const qText = faq.question[lang] || faq.question.en;
            const aText = faq.answer[lang] || faq.answer.en;

            return (
              <div
                key={index}
                className={`rounded-2xl border transition-all overflow-hidden ${
                  isLight
                    ? 'bg-white border-[#E5E7DE] hover:border-[#4C7A3D]/50'
                    : 'bg-[#0F172A] border-[#1E293B] hover:border-[#14B8A6]/50'
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleFaq(index)}
                  className={`w-full p-4 text-left flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                    isOpen
                      ? isLight ? 'bg-[#F0F2EB]' : 'bg-[#131B2E]'
                      : isLight ? 'bg-white hover:bg-[#FAFAF7]' : 'bg-[#0F172A] hover:bg-[#131B2E]'
                  }`}
                >
                  <span className={`text-xs sm:text-sm font-bold ${
                    isOpen
                      ? isLight ? 'text-[#4C7A3D]' : 'text-[#14B8A6]'
                      : isLight ? 'text-[#2D3B27]' : 'text-[#F1F5F9]'
                  }`}>
                    {qText}
                  </span>
                  {isOpen ? (
                    <ChevronUp className={`h-4 w-4 flex-shrink-0 ${isLight ? 'text-[#4C7A3D]' : 'text-[#14B8A6]'}`} />
                  ) : (
                    <ChevronDown className={`h-4 w-4 flex-shrink-0 ${isLight ? 'text-[#6B7568]' : 'text-[#94A3B8]'}`} />
                  )}
                </button>

                {isOpen && (
                  <div className={`p-4 pt-1 border-t text-xs sm:text-sm leading-relaxed ${
                    isLight
                      ? 'border-[#E5E7DE] text-[#6B7568] bg-white'
                      : 'border-[#1E293B] text-slate-300 bg-[#0F172A]'
                  }`}>
                    {aText}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── STILL NEED HELP / CONTACT ── */}
      <div
        className={`p-6 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-4 ${
          isLight
            ? 'bg-white border-[#E5E7DE]'
            : 'bg-[#0F172A] border-[#1E293B]'
        }`}
      >
        <div className="space-y-1 text-center sm:text-left">
          <h4 className={`font-extrabold text-sm ${isLight ? 'text-[#2D3B27]' : 'text-[#F1F5F9]'}`}>
            {t('help.stillNeedHelpTitle') || 'Still need help?'}
          </h4>
          <p className={`text-xs ${isLight ? 'text-[#6B7568]' : 'text-slate-400'}`}>
            {t('help.stillNeedHelpSub') || 'Have specific questions or feedback about satellite datasets? Reach out anytime.'}
          </p>
          <div className="pt-1">
            <a
              href="mailto:support@geolens.app"
              className={`inline-flex items-center gap-1.5 text-xs font-bold hover:underline ${
                isLight ? 'text-[#4C7A3D]' : 'text-[#14B8A6]'
              }`}
            >
              <Mail className="h-3.5 w-3.5" />
              <span>support@geolens.app</span>
            </a>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            router.push('/explorer?open_ai=true');
          }}
          className={`py-2.5 px-5 rounded-full text-xs font-bold text-white transition-all cursor-pointer flex items-center justify-center gap-2.5 shadow-md hover:scale-105 active:scale-95 ${
            isLight ? 'bg-[#4C7A3D] hover:bg-[#3D6330]' : 'bg-[#14B8A6] hover:bg-[#0F766E]'
          }`}
        >
          <AIAvatar size="xs" className="w-5 h-5 flex-shrink-0 border-white/40" />
          <span>{t('help.chatWithAiBtn') || 'Chat with AI Assistant'}</span>
        </button>
      </div>
    </div>
  );
}
