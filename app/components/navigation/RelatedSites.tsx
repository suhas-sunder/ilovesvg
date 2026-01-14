import * as React from "react";

type RelatedSite = {
  id: string;
  name: string;
  url: string;
  description: string;
};

export function RelatedSites() {
  return (
    <section className="border-t border-slate-200 bg-slate-50">
      <div className="max-w-[1180px] mx-auto px-4 py-10">
        <h2 className="text-base font-bold text-slate-900">Related projects</h2>
        <p className="mt-1 text-sm text-slate-600 max-w-[80ch]">
          A small collection of related projects you may find useful or enjoy,
          covering learning tools, simple games, and everyday utilities.
        </p>

        <ul className="mt-6 grid gap-4 md:grid-cols-2">
          {SITES.map((site) => (
            <li key={site.id}>
              <a
                href={site.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-xl border border-slate-200 bg-white p-5 transition
                           hover:border-slate-300 hover:shadow-sm cursor-pointer
                           focus:outline-none focus:ring-2 focus:ring-slate-400"
              >
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-semibold text-slate-900">
                    {site.name}
                  </span>
                  <p className="text-sm text-slate-600">{site.description}</p>
                </div>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const SITES: RelatedSite[] = [
  {
    id: "freetypingcamp",
    name: "FreeTypingCamp",
    url: "https://freetypingcamp.com",
    description:
      "A free typing practice site with structured lessons and real-time feedback, designed to improve speed and accuracy without distractions.",
  },
  {
    id: "emoji-kitchen-game",
    name: "Emoji Kitchen Game",
    url: "https://emojikitchengame.com",
    description:
      "Explore and generate creative emoji combinations inspired by Google’s Emoji Kitchen, with fast previews and easy sharing.",
  },
  {
    id: "i-love-coloring-page",
    name: "I Love Coloring Page",
    url: "https://ilovecoloringpage.com",
    description:
      "Printable coloring pages for kids and adults, focused on clean outlines and easy downloads for offline use.",
  },
  {
    id: "all-text-converters",
    name: "All Text Converters",
    url: "https://alltextconverters.com",
    description:
      "A collection of simple text transformation tools including case converters, formatters, and text utilities for everyday tasks.",
  },
  {
    id: "morse-words",
    name: "Morse Words",
    url: "https://morsewords.com",
    description:
      "Learn and practice Morse code by translating words and phrases, with instant visual and audio feedback.",
  },
  {
    id: "mythology-school",
    name: "Mythology School",
    url: "https://mythologyschool.com",
    description:
      "Educational content exploring myths, gods, and legends from different cultures, written for clarity rather than academic density.",
  },
  {
    id: "word-mythology",
    name: "Word Mythology",
    url: "https://wordmythology.com",
    description:
      "Discover the mythological roots behind modern words, names, and symbols through short, focused explanations.",
  },
  {
    id: "i-love-timers",
    name: "I Love Timers",
    url: "https://ilovetimers.com",
    description:
      "Simple online timers for studying, cooking, workouts, and focus sessions, with no setup or sign-up required.",
  },
  {
    id: "all-plant-care",
    name: "All Plant Care",
    url: "https://allplantcare.com",
    description:
      "Straightforward care guides for common houseplants, covering watering, light, and basic maintenance.",
  },
  {
    id: "focus-climber",
    name: "Focus Climber",
    url: "https://focusclimber.com",
    description:
      "A minimal productivity tool that turns focused work sessions into visible progress, without gamification overload.",
  },
  {
    id: "i-love-steps",
    name: "I Love Steps",
    url: "https://ilovesteps.com",
    description:
      "Step counters and walking-related tools designed for simplicity and quick daily use.",
  },
];
