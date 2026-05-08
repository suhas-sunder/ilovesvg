import * as React from "react";
import { Link } from "react-router";
import type { Route } from "./+types/pro-waitlist";
import SiteFooter from "~/client/components/navigation/SiteFooter";

const SITE_URL = "https://www.ilovesvg.com";
const WEB3FORMS_ENDPOINT = "https://api.web3forms.com/submit";
const WEB3FORMS_ACCESS_KEY = "f80d1c32-3a04-4523-9d54-a3292076e43b";
const MARKETING_CONSENT_TEXT =
  "I agree to receive iLoveSVG Pro updates, early-access news, possible trial offers, and occasional product offers. I can unsubscribe anytime.";

const title = "iLoveSVG Pro Waitlist";
const description =
  "Request early access to iLoveSVG Pro, a cleaner SVG conversion workspace planned for higher limits, larger batch workflows, saved custom presets, reusable export settings, and fewer interruptions.";
const canonical = `${SITE_URL}/pro-waitlist`;

const useCaseOptions = [
  "SVG conversion",
  "Cricut / cutting files",
  "Stickers or printables",
  "Batch SVG conversion",
  "Logo/icon work",
  "Web/design assets",
  "Other",
];

const expectedUsageOptions = [
  "A few files occasionally",
  "Weekly projects",
  "Large batches",
  "Business/creator workflow",
  "Not sure yet",
];

const mostWantedFeatureOptions = [
  "Higher limits",
  "Saved custom presets",
  "Multi-preset comparison",
  "Larger batch ZIP downloads",
  "Batch rename templates",
  "Optional recent output history",
  "No-ad workspace",
  "Desktop/local processing option",
  "Not sure yet",
];

type InfoTone = "sky" | "cyan" | "emerald" | "amber" | "violet" | "rose";

const toneStyles: Record<
  InfoTone,
  { border: string; bg: string; bar: string; text: string }
> = {
  sky: {
    border: "border-sky-200",
    bg: "bg-sky-50/90",
    bar: "bg-sky-500",
    text: "text-sky-800",
  },
  cyan: {
    border: "border-cyan-200",
    bg: "bg-cyan-50/90",
    bar: "bg-cyan-500",
    text: "text-cyan-800",
  },
  emerald: {
    border: "border-emerald-200",
    bg: "bg-emerald-50/90",
    bar: "bg-emerald-500",
    text: "text-emerald-800",
  },
  amber: {
    border: "border-amber-200",
    bg: "bg-amber-50/90",
    bar: "bg-amber-500",
    text: "text-amber-800",
  },
  violet: {
    border: "border-violet-200",
    bg: "bg-violet-50/90",
    bar: "bg-violet-500",
    text: "text-violet-800",
  },
  rose: {
    border: "border-rose-200",
    bg: "bg-rose-50/90",
    bar: "bg-rose-500",
    text: "text-rose-800",
  },
};

const coreBenefitItems = [
  "Higher conversion and batch limits",
  "Larger file and image size support",
  "Clean no-ad workspace",
  "Saved custom presets",
  "Reusable export settings",
  "Multi-preset comparison workflow",
];

const proIncludeItems: Array<{
  title: string;
  body: string;
  tone: InfoTone;
}> = [
  {
    title: "Larger batch ZIP downloads",
    body: "Package more SVG outputs cleanly when a project has many files.",
    tone: "sky",
  },
  {
    title: "Batch rename templates",
    body: "Keep large output sets organized with reusable naming patterns.",
    tone: "cyan",
  },
  {
    title: "Saved custom presets",
    body: "Reuse the settings that match your workflow without rebuilding them.",
    tone: "emerald",
  },
  {
    title: "Reusable export settings",
    body: "Carry preferred output choices across heavier conversion sessions.",
    tone: "amber",
  },
  {
    title: "Recent and pinned output history",
    body: "Optional history is planned for comparing and returning to useful results.",
    tone: "violet",
  },
  {
    title: "Desktop/local processing option",
    body: "A local processing version is under consideration, not guaranteed.",
    tone: "rose",
  },
];

const quickDetailItems: Array<{
  title: string;
  body: string;
  tone: InfoTone;
}> = [
  {
    title: "Same core converter",
    body: "The plan is to build around the existing iLoveSVG converter experience.",
    tone: "sky",
  },
  {
    title: "For heavier workflows",
    body: "Best suited for larger batches, repeated presets, and frequent SVG work.",
    tone: "cyan",
  },
  {
    title: "No commitment",
    body: "Joining only tells us you are interested and helps prioritize features.",
    tone: "emerald",
  },
  {
    title: "Optional updates",
    body: "Product updates, offers, and possible trial invitations require opt-in.",
    tone: "amber",
  },
];

type FormValues = {
  email: string;
  useCase: string;
  expectedUsage: string;
  mostWantedFeature: string;
  countryOrRegion: string;
  message: string;
  marketingConsent: boolean;
};

type FormErrors = Partial<Record<keyof FormValues, string>>;
type SubmitState = "idle" | "sending" | "success" | "error";

const emptyFormValues: FormValues = {
  email: "",
  useCase: "",
  expectedUsage: "",
  mostWantedFeature: "",
  countryOrRegion: "",
  message: "",
  marketingConsent: false,
};

export function meta({}: Route.MetaArgs) {
  return [
    { title },
    { name: "description", content: description },
    { name: "viewport", content: "width=device-width, initial-scale=1" },
    { name: "theme-color", content: "#0b2dff" },
    { tagName: "link", rel: "canonical", href: canonical },
    { property: "og:site_name", content: "iLoveSVG" },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { property: "og:url", content: canonical },
    { property: "og:locale", content: "en_US" },
    { name: "twitter:card", content: "summary" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
  ];
}

export default function ProWaitlist() {
  const [values, setValues] = React.useState<FormValues>(emptyFormValues);
  const [errors, setErrors] = React.useState<FormErrors>({});
  const [submitState, setSubmitState] = React.useState<SubmitState>("idle");
  const [statusMessage, setStatusMessage] = React.useState("");
  const [submissionLabel, setSubmissionLabel] = React.useState("");

  React.useEffect(() => {
    setSubmissionLabel(buildSubmissionLabel());
  }, []);

  function updateField<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
    if (submitState === "error") {
      setSubmitState("idle");
      setStatusMessage("");
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitState === "sending") return;

    const formData = new FormData(event.currentTarget);
    if (formData.get("botcheck")) return;

    const submittedValues = getSubmittedFormValues(formData);
    const trimmed = trimFormValues(submittedValues);
    const nextErrors = validateForm(trimmed);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setSubmitState("error");
      setStatusMessage("Please fix the highlighted fields and try again.");
      return;
    }

    setSubmitState("sending");
    setStatusMessage("Sending your request...");

    const payload = {
      access_key: WEB3FORMS_ACCESS_KEY,
      subject: "New iLoveSVG Pro waitlist signup",
      from_name: "iLoveSVG",
      site_name: "iLoveSVG",
      page_source: "pro-waitlist",
      form_type: "pro_waitlist",
      name: submissionLabel || buildSubmissionLabel(),
      email: trimmed.email,
      use_case: trimmed.useCase,
      expected_usage: trimmed.expectedUsage,
      most_wanted_feature: trimmed.mostWantedFeature,
      country_or_region: trimmed.countryOrRegion,
      message: trimmed.message,
      submitted_at: new Date().toISOString(),
      marketing_consent: trimmed.marketingConsent ? "yes" : "no",
      marketing_consent_text: MARKETING_CONSENT_TEXT,
      source_url: getSourceUrl(),
      referrer_path: getReferrerPath(),
      botcheck: false,
    };

    try {
      const response = await fetch(WEB3FORMS_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });
      const result = (await response.json().catch(() => null)) as
        | { success?: boolean }
        | null;

      if (!response.ok || result?.success === false) {
        throw new Error("waitlist request failed");
      }

      setValues(emptyFormValues);
      setSubmissionLabel(buildSubmissionLabel());
      setErrors({});
      setSubmitState("success");
      setStatusMessage(
        "Thanks, you’re on the waitlist. We’ll follow up when early access is ready.",
      );
    } catch {
      setSubmitState("error");
      setStatusMessage(
        "Something went wrong. Please try again, or email us directly if the issue continues.",
      );
    }
  }

  return (
    <>
      <main className="min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,#f7fbff_0%,#f8fafc_46%,#ffffff_100%)] text-slate-900">
        <section className="relative overflow-hidden border-b border-slate-200 bg-[linear-gradient(135deg,#effaff_0%,#ffffff_47%,#eef4ff_100%)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(14,165,233,0.18),transparent_28%),radial-gradient(circle_at_92%_14%,rgba(37,99,235,0.12),transparent_24%),linear-gradient(90deg,rgba(14,165,233,0.06)_1px,transparent_1px),linear-gradient(0deg,rgba(14,165,233,0.04)_1px,transparent_1px)] bg-[length:auto,auto,44px_44px,44px_44px]" />
          <div className="relative mx-auto grid max-w-6xl gap-7 px-4 py-8 sm:px-6 sm:py-10 lg:grid-cols-[minmax(0,1fr)_minmax(380px,0.68fr)] lg:items-start lg:px-8 lg:py-12">
            <div className="min-w-0">
              <p className="inline-flex items-center rounded-full border border-sky-200 bg-white/85 px-3 py-1 text-xs font-black uppercase text-sky-700 shadow-sm">
                Early access
              </p>
              <h1 className="mt-4 max-w-3xl text-3xl font-black leading-tight text-sky-950 sm:text-5xl lg:text-6xl">
                Request early access to iLoveSVG Pro
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-700 sm:text-lg">
                Join the waitlist for a cleaner SVG conversion workspace with
                higher limits, larger batch workflows, saved custom presets,
                reusable export settings, and faster ways to compare results.
              </p>

              <DesktopProInfo />
            </div>

            <WaitlistForm
              submissionLabel={submissionLabel}
              values={values}
              errors={errors}
              submitState={submitState}
              statusMessage={statusMessage}
              onSubmit={handleSubmit}
              onUpdate={updateField}
            />

            <div className="grid gap-3 text-sm font-bold text-slate-700 sm:grid-cols-2 lg:hidden">
              {coreBenefitItems.map((item) => (
                <div
                  key={item}
                  className="flex min-h-12 items-center rounded-2xl border border-sky-100 bg-white/85 px-3 py-2 shadow-sm"
                >
                  {item}
                </div>
              ))}
              <p className="rounded-2xl border border-sky-100 bg-white/75 px-4 py-3 text-sm font-semibold leading-6 text-slate-600 shadow-sm sm:col-span-2">
                Built for heavier SVG workflows. No AI claims. No quality
                overpromising. Just a cleaner, higher-limit workspace for
                people doing more SVG work.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-9 sm:px-6 sm:py-12 lg:hidden lg:px-8">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(300px,0.6fr)]">
            <section className="overflow-hidden rounded-[1.35rem] border border-sky-200 bg-white shadow-[0_14px_44px_rgba(15,23,42,0.08)]">
              <div className="h-1.5 bg-sky-500" />
              <div className="p-5 sm:p-7">
              <h2 className="text-2xl font-black leading-tight text-sky-950">
                What Pro may include
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
                Pro is planned for people who convert more files, compare more
                outputs, reuse settings, and want a quieter workspace around the
                same core iLoveSVG converter experience.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {[
                  "Larger batch ZIP downloads",
                  "Batch rename templates",
                  "Optional recent and pinned output history",
                  "Priority processing for heavier jobs",
                  "Multiple workflow spaces on a Pro dashboard",
                  "Possible desktop/local processing version under consideration",
                ].map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-700"
                  >
                    {item}
                  </div>
                ))}
              </div>
              <p className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold leading-6 text-emerald-900">
                Early-access users who opt into updates may receive a possible
                limited free trial offer. Updates, offers, and possible trial
                invitations are optional and only sent if you opt in.
              </p>
              </div>
            </section>

            <section className="overflow-hidden rounded-[1.35rem] border border-cyan-200 bg-white shadow-[0_14px_44px_rgba(15,23,42,0.08)]">
              <div className="h-1.5 bg-cyan-500" />
              <div className="p-5 sm:p-7">
              <h2 className="text-xl font-black text-sky-950">
                Quick details
              </h2>
              <div className="mt-4 space-y-4 text-sm leading-6 text-slate-700">
                <FaqItem
                  question="What is iLoveSVG Pro?"
                  answer="A planned early-access workspace for higher-limit SVG conversion workflows, larger batches, saved custom presets, reusable export settings, and fewer interruptions."
                />
                <FaqItem
                  question="Will Pro use the same converter?"
                  answer="The plan is to build around the existing iLoveSVG converter experience, with workflow improvements for heavier use."
                />
                <FaqItem
                  question="Does joining commit me to anything?"
                  answer="No. Joining only tells us you are interested in early access and helps us understand which workflows matter most."
                />
                <FaqItem
                  question="Can I opt out of updates?"
                  answer="Yes. Product updates, offers, and possible trial invitations are optional, and you can ask to be removed anytime."
                />
                <FaqItem
                  question="Will there be a desktop version?"
                  answer="A desktop or local processing option is under consideration. The waitlist helps prioritize that work."
                />
                <FaqItem
                  question="What could early-access users receive?"
                  answer="Early-access users who opt into updates may be invited to possible trial offers or product updates as Pro takes shape."
                />
              </div>
              </div>
            </section>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}

function DesktopProInfo() {
  return (
    <div className="mt-7 hidden space-y-4 lg:block">
      <section className="overflow-hidden rounded-[1.35rem] border border-sky-100 bg-white/90 shadow-[0_14px_44px_rgba(15,23,42,0.08)] backdrop-blur">
        <div className="h-1.5 bg-sky-500" />
        <div className="p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-950 text-sm font-black text-white">
              Pro
            </span>
            <div>
              <h2 className="text-lg font-black leading-tight text-sky-950">
                Built for heavier SVG workflows
              </h2>
              <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">
                No AI claims. No quality overpromising. Just a cleaner,
                higher-limit workspace for people doing more SVG work.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {coreBenefitItems.map((item, index) => {
              const tone = toneStyles[
                (["sky", "cyan", "emerald", "amber", "violet", "rose"] as const)[
                  index % 6
                ]
              ];
              return (
                <div
                  key={item}
                  className={[
                    "flex min-h-12 items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-extrabold leading-5 shadow-sm",
                    tone.border,
                    tone.bg,
                    tone.text,
                  ].join(" ")}
                >
                  <span
                    className={["h-2.5 w-2.5 shrink-0 rounded-full", tone.bar].join(
                      " ",
                    )}
                    aria-hidden="true"
                  />
                  <span>{item}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[1.35rem] border border-cyan-100 bg-white/90 shadow-[0_14px_44px_rgba(15,23,42,0.08)] backdrop-blur">
        <div className="h-1.5 bg-cyan-500" />
        <div className="p-4 sm:p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase text-cyan-700">
                Planned workspace
              </p>
              <h2 className="mt-1 text-xl font-black leading-tight text-sky-950">
                What Pro may include
              </h2>
            </div>
            <p className="max-w-xs text-xs font-semibold leading-5 text-slate-500">
              Pro is planned around repeated conversion work, not a separate
              conversion engine.
            </p>
          </div>

          <div className="mt-4 grid gap-3 xl:grid-cols-2">
            {proIncludeItems.map((item) => (
              <InfoCard key={item.title} {...item} />
            ))}
          </div>

          <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold leading-6 text-emerald-900">
            Early-access users who opt into updates may receive a possible
            limited free trial offer. Updates, offers, and possible trial
            invitations are optional and only sent if you opt in.
          </p>
        </div>
      </section>

      <section className="overflow-hidden rounded-[1.35rem] border border-slate-200 bg-white/90 shadow-[0_14px_44px_rgba(15,23,42,0.08)] backdrop-blur">
        <div className="h-1.5 bg-slate-900" />
        <div className="p-4 sm:p-5">
          <p className="text-xs font-black uppercase text-slate-500">
            Quick details
          </p>
          <h2 className="mt-1 text-xl font-black leading-tight text-sky-950">
            Practical context before joining
          </h2>
          <div className="mt-4 grid gap-3 xl:grid-cols-2">
            {quickDetailItems.map((item) => (
              <InfoCard key={item.title} {...item} compact />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function InfoCard({
  title,
  body,
  tone,
  compact = false,
}: {
  title: string;
  body: string;
  tone: InfoTone;
  compact?: boolean;
}) {
  const style = toneStyles[tone];

  return (
    <article
      className={[
        "relative overflow-hidden rounded-2xl border shadow-sm",
        compact ? "p-3" : "p-4",
        style.border,
        style.bg,
      ].join(" ")}
    >
      <span
        className={[
          "absolute left-0 top-0 h-full w-1.5",
          style.bar,
        ].join(" ")}
        aria-hidden="true"
      />
      <div className="pl-2">
        <h3 className={["text-sm font-black leading-5", style.text].join(" ")}>
          {title}
        </h3>
        <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">
          {body}
        </p>
      </div>
    </article>
  );
}

function WaitlistForm({
  submissionLabel,
  values,
  errors,
  submitState,
  statusMessage,
  onSubmit,
  onUpdate,
}: {
  submissionLabel: string;
  values: FormValues;
  errors: FormErrors;
  submitState: SubmitState;
  statusMessage: string;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onUpdate: <K extends keyof FormValues>(key: K, value: FormValues[K]) => void;
}) {
  const isSending = submitState === "sending";

  return (
    <form
      className="rounded-[1.35rem] border border-white/80 bg-white/95 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.14)] backdrop-blur sm:p-5"
      onSubmit={onSubmit}
      noValidate
      aria-describedby="waitlist-privacy-note waitlist-status"
    >
      <input
        type="checkbox"
        name="botcheck"
        className="hidden"
        style={{ display: "none" }}
        tabIndex={-1}
        aria-hidden="true"
      />
      <input type="hidden" name="name" value={submissionLabel} readOnly />

      <div>
        <h2 className="text-xl font-black text-sky-950">
          Join the Pro waitlist
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Add your email first, then share optional workflow details if you want
          Pro shaped around how you convert files.
        </p>
      </div>

      <div className="mt-5 grid gap-4">
        <TextField
          id="waitlist-email"
          name="email"
          label="Email"
          type="email"
          value={values.email}
          error={errors.email}
          required
          maxLength={160}
          autoComplete="email"
          onChange={(value) => onUpdate("email", value)}
        />

        <SelectField
          id="waitlist-use-case"
          name="use_case"
          label="Primary workflow / use case (optional)"
          value={values.useCase}
          options={useCaseOptions}
          onChange={(value) => onUpdate("useCase", value)}
        />

        <SelectField
          id="waitlist-expected-usage"
          name="expected_usage"
          label="Expected usage (optional)"
          value={values.expectedUsage}
          options={expectedUsageOptions}
          onChange={(value) => onUpdate("expectedUsage", value)}
        />

        <SelectField
          id="waitlist-most-wanted"
          name="most_wanted_feature"
          label="What do you want most from Pro? (optional)"
          value={values.mostWantedFeature}
          options={mostWantedFeatureOptions}
          onChange={(value) => onUpdate("mostWantedFeature", value)}
        />

        <TextField
          id="waitlist-country"
          name="country_or_region"
          label="Country or region (optional)"
          value={values.countryOrRegion}
          error={errors.countryOrRegion}
          maxLength={80}
          autoComplete="country-name"
          onChange={(value) => onUpdate("countryOrRegion", value)}
        />

        <TextareaField
          id="waitlist-message"
          label="What would make Pro useful for you? (optional)"
          value={values.message}
          error={errors.message}
          maxLength={600}
          onChange={(value) => onUpdate("message", value)}
        />

        <label className="flex cursor-pointer gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700">
          <input
            type="checkbox"
            name="marketing_consent"
            checked={values.marketingConsent}
            onChange={(event) =>
              onUpdate("marketingConsent", event.currentTarget.checked)
            }
            className="mt-1 h-4 w-4 cursor-pointer rounded border-slate-300 text-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          />
          <span>{MARKETING_CONSENT_TEXT}</span>
        </label>

        <p id="waitlist-privacy-note" className="text-xs leading-5 text-slate-500">
          We’ll use your email to respond about early access. Product updates,
          offers, and possible trial invitations are optional and only sent if
          you opt in. No spam. You can ask to be removed anytime. Read the{" "}
          <Link
            to="/privacy-policy"
            className="cursor-pointer font-semibold text-sky-700 underline underline-offset-4 hover:text-sky-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            privacy policy
          </Link>
          .
        </p>

        <button
          type="submit"
          disabled={isSending}
          className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-xl bg-sky-700 px-5 py-3 text-base font-extrabold text-white shadow-sm transition-colors hover:bg-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isSending ? "Sending..." : "Request early access"}
        </button>

        <div
          id="waitlist-status"
          role="status"
          aria-live="polite"
          className={[
            "min-h-6 text-sm font-semibold",
            submitState === "success"
              ? "text-emerald-700"
              : submitState === "error"
                ? "text-rose-700"
                : "text-slate-600",
          ].join(" ")}
        >
          {statusMessage}
        </div>
      </div>
    </form>
  );
}

function TextField({
  id,
  name,
  label,
  type = "text",
  value,
  error,
  required = false,
  maxLength,
  autoComplete,
  onChange,
}: {
  id: string;
  name: string;
  label: string;
  type?: string;
  value: string;
  error?: string;
  required?: boolean;
  maxLength: number;
  autoComplete?: string;
  onChange: (value: string) => void;
}) {
  const errorId = `${id}-error`;

  return (
    <div>
      <label htmlFor={id} className="text-sm font-extrabold text-slate-800">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        value={value}
        required={required}
        maxLength={maxLength}
        autoComplete={autoComplete}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => onChange(event.currentTarget.value)}
        className={fieldClass(Boolean(error))}
      />
      {error ? (
        <p id={errorId} className="mt-1 text-sm font-semibold text-rose-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function SelectField({
  id,
  name,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  name: string;
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-extrabold text-slate-800">
        {label}
      </label>
      <select
        id={id}
        name={name}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        className={`${fieldClass(false)} cursor-pointer`}
      >
        <option value="">Select one</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

function TextareaField({
  id,
  label,
  value,
  error,
  maxLength,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  error?: string;
  maxLength: number;
  onChange: (value: string) => void;
}) {
  const errorId = `${id}-error`;

  return (
    <div>
      <label htmlFor={id} className="text-sm font-extrabold text-slate-800">
        {label}
      </label>
      <textarea
        id={id}
        name="message"
        value={value}
        maxLength={maxLength}
        rows={4}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => onChange(event.currentTarget.value)}
        className={`${fieldClass(Boolean(error))} min-h-28 resize-y`}
      />
      <div className="mt-1 flex items-center justify-between gap-3 text-xs text-slate-500">
        {error ? (
          <p id={errorId} className="font-semibold text-rose-700">
            {error}
          </p>
        ) : (
          <span />
        )}
        <span>{value.length}/{maxLength}</span>
      </div>
    </div>
  );
}

function FaqItem({
  question,
  answer,
}: {
  question: string;
  answer: string;
}) {
  return (
    <div>
      <h3 className="font-extrabold text-slate-900">{question}</h3>
      <p className="mt-1 text-slate-600">{answer}</p>
    </div>
  );
}

function fieldClass(hasError: boolean) {
  return [
    "mt-1 w-full rounded-xl border bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 shadow-sm outline-none transition-colors",
    "placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20",
    hasError ? "border-rose-300" : "border-slate-200",
  ].join(" ");
}

function trimFormValues(values: FormValues): FormValues {
  return {
    ...values,
    email: values.email.trim(),
    useCase: values.useCase.trim(),
    expectedUsage: values.expectedUsage.trim(),
    mostWantedFeature: values.mostWantedFeature.trim(),
    countryOrRegion: values.countryOrRegion.trim(),
    message: values.message.trim(),
  };
}

function getSubmittedFormValues(formData: FormData): FormValues {
  return {
    email: getFormDataText(formData, "email"),
    useCase: getFormDataText(formData, "use_case"),
    expectedUsage: getFormDataText(formData, "expected_usage"),
    mostWantedFeature: getFormDataText(formData, "most_wanted_feature"),
    countryOrRegion: getFormDataText(formData, "country_or_region"),
    message: getFormDataText(formData, "message"),
    marketingConsent: formData.get("marketing_consent") === "on",
  };
}

function getFormDataText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function validateForm(values: FormValues): FormErrors {
  const nextErrors: FormErrors = {};

  if (!values.email) {
    nextErrors.email = "Enter your email.";
  } else if (values.email.length > 160) {
    nextErrors.email = "Email must be 160 characters or fewer.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
    nextErrors.email = "Enter a valid email address.";
  }

  if (values.countryOrRegion.length > 80) {
    nextErrors.countryOrRegion =
      "Country or region must be 80 characters or fewer.";
  }

  if (values.message.length > 600) {
    nextErrors.message = "Message must be 600 characters or fewer.";
  }

  return nextErrors;
}

function buildSubmissionLabel() {
  return `Waitlist Signup wls_${createShortId()}`;
}

function createShortId() {
  if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
    const bytes = new Uint8Array(4);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(36).padStart(2, "0"))
      .join("")
      .slice(0, 10);
  }

  return Math.random().toString(36).slice(2, 10);
}

function getSourceUrl() {
  if (typeof window === "undefined") return "";
  return window.location.href;
}

function getReferrerPath() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return "";
  }

  if (!document.referrer) return "";

  try {
    const referrer = new URL(document.referrer);
    return referrer.origin === window.location.origin
      ? `${referrer.pathname}${referrer.search}`
      : "";
  } catch {
    return "";
  }
}
