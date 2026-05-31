export type AffiliateProviderId = "printify" | "stickerMule" | "cricut";

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
    id: "printify",
    label: "Printify",
    enabled: true,
    status: "active",
  },
  {
    id: "stickerMule",
    label: "Sticker Mule",
    enabled: false,
    status: "disabled",
  },
  {
    id: "cricut",
    label: "Cricut",
    enabled: false,
    status: "pending",
  },
];

export const ACTIVE_AFFILIATE_PROVIDER_IDS: AffiliateProviderId[] = ["printify"];

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

