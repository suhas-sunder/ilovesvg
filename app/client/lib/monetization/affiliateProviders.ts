export type AffiliateProviderId = "amazon";

export type AffiliateProviderStatus =
  | "active"
  | "inactive"
  | "pending"
  | "disabled";

export type AffiliateProvider = {
  id: AffiliateProviderId;
  label: string;
  enabled: boolean;
  status: AffiliateProviderStatus;
};

export const AFFILIATE_PROVIDERS: AffiliateProvider[] = [
  {
    id: "amazon",
    label: "Amazon",
    enabled: true,
    status: "active",
  },
];

export const ACTIVE_AFFILIATE_PROVIDER_IDS: AffiliateProviderId[] = ["amazon"];

const activeProviderIdSet = new Set<string>(ACTIVE_AFFILIATE_PROVIDER_IDS);

export function isAffiliateProviderActive(
  providerId: unknown,
): providerId is AffiliateProviderId {
  return typeof providerId === "string" && activeProviderIdSet.has(providerId);
}

export function getActiveAffiliateProviders() {
  return AFFILIATE_PROVIDERS.filter(
    (provider) =>
      provider.enabled &&
      provider.status === "active" &&
      isAffiliateProviderActive(provider.id),
  );
}

