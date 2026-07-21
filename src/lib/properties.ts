export type Property = {
  id: string;
  name: string;
  zone: string;
  guests: number;
  bedrooms: number;
  priceFrom: number;
  currency: string;
  image: string;
  alt: string;
};

export const properties: Property[] = [
  {
    id: "departamento-laguna",
    name: "Departamento Laguna",
    zone: "Frente a la laguna",
    guests: 4,
    bedrooms: 2,
    priceFrom: 520,
    currency: "Bs",
    image:
      "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=70",
    alt: "Interior luminoso de un departamento",
  },
  {
    id: "casa-horizonte",
    name: "Casa Horizonte",
    zone: "Sector arboledas",
    guests: 8,
    bedrooms: 4,
    priceFrom: 1180,
    currency: "Bs",
    image:
      "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=70",
    alt: "Casa amplia con espacios abiertos",
  },
  {
    id: "suite-marina",
    name: "Suite Marina",
    zone: "Torre central",
    guests: 2,
    bedrooms: 1,
    priceFrom: 390,
    currency: "Bs",
    image:
      "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=70",
    alt: "Suite acogedora con cama amplia y luz cálida",
  },
  {
    id: "villa-palmeras",
    name: "Villa Palmeras",
    zone: "Borde de piscina",
    guests: 6,
    bedrooms: 3,
    priceFrom: 1450,
    currency: "Bs",
    image:
      "https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1200&q=70",
    alt: "Villa con piscina privada y palmeras al atardecer",
  },
];
