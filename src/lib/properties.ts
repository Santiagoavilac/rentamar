export type Property = {
  id: string;
  name: string;
  zone: string;
  guests?: number;
  bedrooms: number;
  priceFrom?: number;
  currency: string;
  image: string;
  alt: string;
};

export const properties: Property[] = [];
