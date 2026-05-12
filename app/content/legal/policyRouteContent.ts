export type LegalSectionCopy = {
  title: string;
  paragraphs: string[];
};

export type LegalExternalLink = {
  label: string;
  href: string;
};

export type RelatedSiteCopy = {
  id: string;
  name: string;
  url: string;
  description: string;
};

export const TERMS_OF_SERVICE_COPY = {
  lastUpdated: "Last updated January 10, 2026",
  sections: [
    {
      title: "1. OUR SERVICES",
      paragraphs: [
        "The Services provide tools, converters, generators, and educational content related to SVG graphics, vector design, and web-friendly visual assets. The information provided when using the Services is not intended for distribution to or use by any person or entity in any jurisdiction or country where such distribution or use would be contrary to law or regulation or which would subject us to any registration requirement within such jurisdiction or country.",
      ],
    },
    {
      title: "16. PRIVACY POLICY",
      paragraphs: [
        "We care about data privacy and security. Please review our Privacy Policy: https://www.ilovesvg.com/privacy. By using the Services, you agree to be bound by our Privacy Policy, which is incorporated into these Legal Terms.",
      ],
    },
    {
      title: "30. CONTACT US",
      paragraphs: [
        "In order to resolve a complaint regarding the Services or to receive further information regarding use of the Services, please contact us at:",
        "https://www.ilovesvg.com",
        "Toronto, Ontario",
        "Canada",
        "admin@ilovesvg.com",
      ],
    },
  ] satisfies LegalSectionCopy[],
};

export const COOKIE_POLICY_COPY = {
  lastUpdated: "Last updated January 10, 2026",
  introParagraphs: [
    'This Cookie Policy explains how https://www.ilovesvg.com ("Company", "we", "us", and "our") uses cookies and similar technologies to recognize you when you visit our website at https://www.ilovesvg.com ("Website"). It explains what these technologies are and why we use them, as well as your rights to control our use of them.',
    "In some cases we may use cookies and similar technologies to collect personal information, or that becomes personal information if we combine it with other information. For more information about how we handle personal information, please see our Privacy Policy.",
  ],
  cookieBasics: {
    title: "What are cookies?",
    paragraphs: [
      "Cookies are small data files that are placed on your computer or mobile device when you visit a website. Cookies are widely used by website owners in order to make their websites work, or to work more efficiently, as well as to provide reporting information.",
      'Cookies set by the website owner (in this case, https://www.ilovesvg.com) are called "first-party cookies." Cookies set by parties other than the website owner are called "third-party cookies." Third-party cookies enable third-party features or functionality to be provided on or through the website (for example, advertising, interactive content, and analytics). The parties that set these third-party cookies can recognize your device both when it visits the website in question and also when it visits certain other websites.',
    ],
  },
  whyUseCookies: {
    title: "Why do we use cookies?",
    paragraphs: [
      'We use first- and third-party cookies for several reasons. Some cookies are required for technical reasons in order for our Website to operate, and we refer to these as "essential" or "strictly necessary" cookies. Other cookies enable us to understand how our Website is used and to improve performance and user experience. We may also use cookies for advertising purposes, including serving ads and measuring ad performance. This is described in more detail below.',
    ],
  },
  analytics: {
    title: "Analytics and performance cookies",
    paragraphs: [
      "These cookies (and similar technologies) collect information that is used either in aggregate form to help us understand how our Website is being used, to improve site performance, and to help diagnose errors. We currently use PostHog for analytics, which may set cookies or use similar identifiers depending on your browser and our configuration.",
      "Note: The specific cookies and identifiers used can vary over time (for example, based on configuration changes or vendor updates).",
    ],
  },
  advertising: {
    title: "Advertising cookies",
    paragraphs: [
      "We may display advertisements on our Website through Google AdSense and/or other advertising partners. Advertising providers may use cookies or similar technologies to serve ads, limit ad frequency, measure ad performance, and deliver ads that may be relevant to your interests.",
    ],
    googleTitle: "Google advertising cookies",
    googleParagraph:
      "Google uses cookies to help serve the ads it displays on the websites of its partners, such as websites displaying Google ads or participating in Google certified ad networks. When users visit a Google partner website, a cookie may be dropped on that user's browser.",
    links: [
      {
        label: "Find out how Google uses cookies...",
        href: "https://policies.google.com/technologies/cookies",
      },
      {
        label: "Manage Google Ads Settings...",
        href: "https://adssettings.google.com/",
      },
      {
        label: "Opt out via aboutads.info...",
        href: "https://optout.aboutads.info/?c=2&lang=EN",
      },
    ] satisfies LegalExternalLink[],
  },
  cookieControls: {
    title: "How can I control cookies?",
    paragraphs: [
      "You have the right to decide whether to accept or reject cookies. You can usually exercise your cookie rights by setting your preferences in a cookie banner or consent manager (if we display one), or by changing your browser settings.",
      "Please note that essential cookies cannot be rejected in some cases because they are strictly necessary to provide you with core site functionality. If you choose to reject cookies, you may still use our Website, though your access to some functionality and areas of our Website may be restricted.",
    ],
  },
  browserControls: {
    title: "How can I control cookies on my browser?",
    paragraphs: [
      "The means by which you can refuse cookies through your browser controls vary from browser to browser, so you should visit your browser's help menu for more information.",
    ],
    prompt: "Useful starting points:",
    browsers: "Chrome, Firefox, Safari, Edge, Opera",
  },
  otherTracking: {
    title: "What about other tracking technologies, like web beacons?",
    paragraphs: [
      'Cookies are not the only way to recognize or track visitors to a website. We may use other, similar technologies from time to time, like web beacons (sometimes called "tracking pixels" or "clear gifs"). These are tiny graphics files that contain a unique identifier that enables us to recognize when someone has visited our Website or interacted with our content. In many instances, these technologies rely on cookies to function properly, so declining cookies may impair their functioning.',
    ],
  },
  localStorage: {
    title: "Do you use local storage or similar technologies?",
    paragraphs: [
      "Some site features and third-party tools may use local storage (such as Local Storage, Session Storage, IndexedDB, or similar) to store information on your device. These technologies are used for purposes similar to cookies, such as remembering preferences, improving site performance, and measuring usage.",
      "You can typically clear or control local storage through your browser settings. Disabling or clearing it may impact certain website functionality.",
    ],
  },
  updates: {
    title: "How often will you update this Cookie Policy?",
    paragraphs: [
      "We may update this Cookie Policy from time to time in order to reflect changes to the cookies and technologies we use or for other operational, legal, or regulatory reasons. Please revisit this Cookie Policy regularly to stay informed about our use of cookies and related technologies.",
      "The date at the top of this Cookie Policy indicates when it was last updated.",
    ],
  },
  contact: {
    title: "Where can I get further information?",
    paragraphs: [
      "If you have any questions about our use of cookies or other technologies, please contact us at: admin@ilovesvg.com.",
    ],
  },
};

export const COOKIE_RELATED_SITES = [
  {
    id: "freetypingcamp",
    name: "FreeTypingCamp",
    url: "https://freetypingcamp.com/",
    description:
      "Typing practice with clean drills and simple progress tracking. Good if you want to improve speed and accuracy without signups.",
  },
  {
    id: "emojikitchengame",
    name: "EmojiKitchenGame",
    url: "https://emojikitchengame.com/",
    description:
      "Mix and match emoji-style combos and explore fun results. Quick, lightweight, and easy to share.",
  },
  {
    id: "ilovecoloringpage",
    name: "ILoveColoringPage",
    url: "https://ilovecoloringpage.com/",
    description:
      "Printable coloring pages and creative activities. Built for quick browsing and easy downloads.",
  },
  {
    id: "alltextconverters",
    name: "AllTextConverters",
    url: "https://alltextconverters.com/",
    description:
      "A toolbox for formatting and transforming text. Handy for developers, writers, and anyone cleaning up content.",
  },
  {
    id: "morsewords",
    name: "MorseWords",
    url: "https://morsewords.com/",
    description:
      "Learn and practice Morse code with simple tools and bite-size lessons. Great for curiosity and skill-building.",
  },
  {
    id: "mythologyschool",
    name: "MythologySchool",
    url: "https://mythologyschool.com/",
    description:
      "Mythology explained in a clear, structured way. Good for students, writers, and quick research rabbit holes.",
  },
  {
    id: "wordmythology",
    name: "WordMythology",
    url: "https://wordmythology.com/",
    description:
      "Word origins and mythology-inspired language notes. Useful if you like etymology and story lore.",
  },
  {
    id: "ilovetimers",
    name: "ILoveTimers",
    url: "https://ilovetimers.com/",
    description:
      "Minimal timers you can start instantly. Great for studying, workouts, cooking, or focus sprints.",
  },
  {
    id: "allplantcare",
    name: "AllPlantCare",
    url: "https://allplantcare.com/",
    description:
      "Plant care guides with quick answers and practical tips. Helpful when you just want to keep a plant alive.",
  },
  {
    id: "focusclimber",
    name: "FocusClimber",
    url: "https://focusclimber.com/",
    description:
      "Focus and habit tools that stay out of your way. Built for simple routines and momentum.",
  },
  {
    id: "ilovesteps",
    name: "ILoveSteps",
    url: "https://ilovesteps.com/",
    description:
      "Step tracking tools and simple walking goals. Good for keeping motivation light and consistent.",
  },
] satisfies RelatedSiteCopy[];
