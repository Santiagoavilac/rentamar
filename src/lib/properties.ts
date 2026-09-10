import type { PropertyClass } from "./property-classes";

export type Property = {
  id: string;
  name: string;
  zone: string;
  /** null = todavía sin clasificar. */
  propertyClass: PropertyClass | null;
  guests?: number;
  bedrooms: number;
  priceFrom?: number;
  currency: string;
  image: string;
  alt: string;
};

export const properties: Property[] = [];
